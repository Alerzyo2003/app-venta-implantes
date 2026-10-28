-- =============================================================================
-- 0900 · Funciones de apoyo al panel administrativo
--   - Regla de publicación: un producto publicado debe tener al menos una variante activa.
--   - Archivar o restaurar productos exige 'catalog.delete' (eliminar o archivar).
--   - Ingresos y ajustes de inventario idempotentes (un reenvío no duplica el movimiento).
--   - Resumen operativo del inicio del panel (solo las secciones que el usuario puede ver).
--   - Búsqueda de productos para el personal (incluye borradores y archivados).
--   - Vista de inventario por variante y libro de movimientos con el nombre del responsable.
--   Todas exigen permisos (y MFA del personal) en el servidor: el panel solo adapta la interfaz.
-- =============================================================================

insert into public.app_settings (key, value, is_public, description) values
  ('inventory.expiry_warning_days', '90'::jsonb, false, 'Días de anticipación para alertar lotes próximos a vencer.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Publicación con al menos una variante activa
-- -----------------------------------------------------------------------------
create function private.has_active_variant(p_product_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.product_variants where product_id = p_product_id and status = 'active'
  )
$$;
grant execute on function private.has_active_variant(uuid) to authenticated, service_role;

create or replace function private.products_publication() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not (private.has_permission('catalog.publish') or private.is_trusted_session()) then
      perform private.raise_forbidden('PERMISSION_DENIED', 'catalog.publish');
    end if;
    -- Lo publicado debe poder comprarse. Las cargas directas a la base (migraciones, importaciones
    -- con credenciales de base de datos) crean el producto antes que sus variantes y quedan exentas.
    if not private.is_trusted_session() and not private.has_active_variant(new.id) then
      perform private.raise_error('NO_ACTIVE_VARIANT');
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  -- Archivar (o sacar de archivados) equivale a retirar el producto del catálogo.
  if tg_op = 'UPDATE' and (new.status = 'archived') is distinct from (old.status = 'archived')
     and not (private.has_permission('catalog.delete') or private.is_trusted_session()) then
    perform private.raise_forbidden('PERMISSION_DENIED', 'catalog.delete');
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Ingresos y ajustes idempotentes
--   El formulario envía un identificador de solicitud (UUID). Si la respuesta se pierde y el
--   usuario reintenta, se devuelve el movimiento ya registrado en vez de duplicarlo.
-- -----------------------------------------------------------------------------
create table public.inventory_requests (
  request_id uuid primary key,
  movement_id bigint not null references public.stock_movements (id) on delete restrict,
  actor_id uuid,
  created_at timestamptz not null default now()
);
comment on table public.inventory_requests is 'Solicitudes de movimiento ya aplicadas (idempotencia del panel).';
alter table public.inventory_requests enable row level security;
-- Solo la usan las funciones de inventario (security definer); sin acceso directo desde la API.
revoke all on public.inventory_requests from anon, authenticated;

-- Devuelve el movimiento ya aplicado para la solicitud, o null si es nueva. Bloquea la
-- solicitud hasta el fin de la transacción para que dos reenvíos simultáneos no se dupliquen.
create function private.inventory_request_replay(
  p_request_id uuid,
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_quantity int,
  p_type text
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_variant uuid;
  v_warehouse uuid;
  v_quantity int;
  v_type text;
  v_actor uuid;
begin
  if p_request_id is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('inventory_request:' || p_request_id::text, 0));
  select m.id, m.variant_id, m.warehouse_id, m.quantity, m.movement_type, r.actor_id
    into v_id, v_variant, v_warehouse, v_quantity, v_type, v_actor
    from public.inventory_requests r
    join public.stock_movements m on m.id = r.movement_id
   where r.request_id = p_request_id;
  if not found then
    return null;
  end if;
  -- El mismo identificador con otros datos (u otro usuario) no es un reintento.
  if v_variant <> p_variant_id or v_warehouse <> p_warehouse_id or v_quantity <> p_quantity
     or v_type <> p_type or v_actor is distinct from auth.uid() then
    perform private.raise_error('DUPLICATE_REQUEST');
  end if;
  return v_id;
end
$$;

drop function public.inventory_receive(uuid, uuid, int, text, date, text);
create function public.inventory_receive(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_quantity int,
  p_lot_number text default null,
  p_expiry_date date default null,
  p_reason text default null,
  p_request_id uuid default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_lot public.inventory_lots;
  v_movement_id bigint;
begin
  perform private.require_permission('inventory.receive');
  if p_quantity is null or p_quantity <= 0 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  v_movement_id := private.inventory_request_replay(p_request_id, p_variant_id, p_warehouse_id, p_quantity, 'receipt');
  if v_movement_id is not null then
    return v_movement_id;
  end if;

  select p.* into v_product
    from public.product_variants pv join public.products p on p.id = pv.product_id
   where pv.id = p_variant_id;
  if not found then
    perform private.raise_error('NOT_FOUND', 'variante');
  end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and is_active) then
    perform private.raise_error('NOT_FOUND', 'bodega');
  end if;

  if v_product.tracks_lots then
    if nullif(trim(p_lot_number), '') is null then
      perform private.raise_error('LOT_REQUIRED');
    end if;
    if v_product.tracks_expiry and p_expiry_date is null then
      perform private.raise_error('EXPIRY_REQUIRED');
    end if;
    select * into v_lot from public.inventory_lots
     where variant_id = p_variant_id and lot_number = trim(p_lot_number)
     for update;
    if not found then
      insert into public.inventory_lots (variant_id, lot_number, expiry_date)
      values (p_variant_id, trim(p_lot_number), p_expiry_date)
      returning * into v_lot;
    elsif v_lot.expiry_date is distinct from p_expiry_date and p_expiry_date is not null then
      perform private.raise_error('LOT_EXPIRY_MISMATCH',
        format('El lote %s ya existe con vencimiento %s', v_lot.lot_number, v_lot.expiry_date));
    end if;
  end if;

  v_movement_id := private.apply_stock_movement(p_variant_id, p_warehouse_id, v_lot.id, p_quantity,
                                                'receipt', p_reason, 'manual', null);
  if p_request_id is not null then
    insert into public.inventory_requests (request_id, movement_id, actor_id)
    values (p_request_id, v_movement_id, auth.uid());
  end if;
  return v_movement_id;
end
$$;

drop function public.inventory_adjust(uuid, uuid, int, text, uuid);
create function public.inventory_adjust(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_delta int,
  p_reason text,
  p_lot_id uuid default null,
  p_request_id uuid default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tracks_lots boolean;
  v_movement_id bigint;
begin
  perform private.require_permission('inventory.adjust');
  if p_delta is null or p_delta = 0 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  if nullif(trim(p_reason), '') is null then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  v_movement_id := private.inventory_request_replay(p_request_id, p_variant_id, p_warehouse_id, p_delta, 'adjustment');
  if v_movement_id is not null then
    return v_movement_id;
  end if;

  select p.tracks_lots into v_tracks_lots
    from public.product_variants pv join public.products p on p.id = pv.product_id
   where pv.id = p_variant_id;
  if not found then
    perform private.raise_error('NOT_FOUND', 'variante');
  end if;
  if v_tracks_lots and p_lot_id is null then
    perform private.raise_error('LOT_REQUIRED');
  end if;
  if p_lot_id is not null and not exists (
    select 1 from public.inventory_lots where id = p_lot_id and variant_id = p_variant_id
  ) then
    perform private.raise_error('NOT_FOUND', 'lote');
  end if;
  v_movement_id := private.apply_stock_movement(p_variant_id, p_warehouse_id, p_lot_id, p_delta,
                                                'adjustment', trim(p_reason), 'manual', null);
  if p_request_id is not null then
    insert into public.inventory_requests (request_id, movement_id, actor_id)
    values (p_request_id, v_movement_id, auth.uid());
  end if;
  return v_movement_id;
end
$$;

revoke execute on function
  public.inventory_receive(uuid, uuid, int, text, date, text, uuid),
  public.inventory_adjust(uuid, uuid, int, text, uuid, uuid)
from public, anon;
grant execute on function
  public.inventory_receive(uuid, uuid, int, text, date, text, uuid),
  public.inventory_adjust(uuid, uuid, int, text, uuid, uuid)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Resumen operativo
-- -----------------------------------------------------------------------------
create function public.admin_dashboard_summary() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_threshold int := private.setting_int('inventory.low_stock_threshold', 5);
  v_expiry_days int := private.setting_int('inventory.expiry_warning_days', 90);
  v_catalog boolean := private.has_permission('catalog.read');
  v_inventory boolean := private.has_permission('inventory.read');
  v_orders boolean := private.has_permission('orders.read');
  v_verifications boolean := private.has_permission('verifications.review');
begin
  if not (v_catalog or v_inventory or v_orders or v_verifications) then
    -- Lanza el error que corresponda: sin sesión, MFA pendiente o sin permiso.
    perform private.require_permission('orders.read');
  end if;

  if v_catalog then
    v_result := v_result || jsonb_build_object('products', (
      select jsonb_build_object(
        'draft', count(*) filter (where p.status = 'draft'),
        'published', count(*) filter (where p.status = 'published'),
        'archived', count(*) filter (where p.status = 'archived'),
        'published_without_active_variant',
          count(*) filter (where p.status = 'published' and not private.has_active_variant(p.id))
      )
      from public.products p));
  end if;

  if v_inventory then
    v_result := v_result || jsonb_build_object('inventory', (
      with avail as (
        select private.available_qty(pv.id) as qty
          from public.product_variants pv
          join public.products p on p.id = pv.product_id
         where p.status = 'published' and pv.status = 'active'
      )
      select jsonb_build_object(
        'low_stock_threshold', v_threshold,
        'expiry_warning_days', v_expiry_days,
        'out_of_stock', count(*) filter (where qty <= 0),
        'low_stock', count(*) filter (where qty > 0 and qty <= v_threshold),
        'expiring_lots', (
          select count(*) from public.inventory_lots l
           where l.status = 'available'
             and l.expiry_date between current_date and current_date + v_expiry_days
             and exists (select 1 from public.lot_balances lb where lb.lot_id = l.id and lb.on_hand > 0)),
        'expired_lots_with_stock', (
          select count(*) from public.inventory_lots l
           where l.expiry_date < current_date
             and exists (select 1 from public.lot_balances lb where lb.lot_id = l.id and lb.on_hand > 0)),
        'blocked_lots_with_stock', (
          select count(*) from public.inventory_lots l
           where l.status in ('quarantine', 'recalled')
             and exists (select 1 from public.lot_balances lb where lb.lot_id = l.id and lb.on_hand > 0))
      )
      from avail));
  end if;

  if v_orders then
    v_result := v_result || jsonb_build_object('orders', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
        from (select o.status, count(*) as n from public.orders o group by o.status) s));
  end if;

  if v_verifications then
    v_result := v_result || jsonb_build_object('pending_verifications', (
      select count(*) from public.professional_verifications where status = 'pending'));
  end if;

  return v_result;
end
$$;

-- -----------------------------------------------------------------------------
-- Búsqueda de productos para el personal (respeta RLS: security invoker)
-- -----------------------------------------------------------------------------
create function public.admin_search_products(
  p_query text default null,
  p_status text default null,
  p_category_id uuid default null,
  p_limit int default 25,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  slug text,
  status text,
  product_kind text,
  category_name text,
  brand_name text,
  variant_count int,
  active_variant_count int,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_text text := nullif(lower(private.f_unaccent(trim(coalesce(p_query, '')))), '');
  v_pattern text;
  v_code text := nullif(private.normalize_code(p_query), '');
  v_digits text := nullif(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '');
begin
  perform private.require_permission('catalog.read');
  if p_status is not null and p_status not in ('draft', 'published', 'archived') then
    perform private.raise_error('INVALID_INPUT', 'status');
  end if;
  -- El texto del usuario es literal: se escapan los comodines de LIKE.
  v_pattern := '%' || replace(replace(replace(v_text, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select p.id, p.name, p.slug, p.status, p.product_kind, c.name, b.name,
         (select count(*)::int from public.product_variants pv where pv.product_id = p.id),
         (select count(*)::int from public.product_variants pv where pv.product_id = p.id and pv.status = 'active'),
         p.updated_at,
         count(*) over ()
    from public.products p
    join public.categories c on c.id = p.category_id
    left join public.brands b on b.id = p.brand_id
   where (p_status is null or p.status = p_status)
     and (p_category_id is null or p.category_id in (select private.category_descendants(p_category_id)))
     and (v_text is null
          or p.search_text like v_pattern
          or exists (
            select 1 from public.product_variants pv
             where pv.product_id = p.id
               and ((v_code is not null and (pv.sku_norm like v_code || '%' or pv.manufacturer_ref_norm like v_code || '%'))
                    or (v_digits is not null and length(v_digits) between 8 and 14 and pv.gtin = lpad(v_digits, 14, '0')))))
   order by p.updated_at desc, p.id
   limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end
$$;

-- -----------------------------------------------------------------------------
-- Inventario por variante (totales de todas las bodegas o de una)
-- -----------------------------------------------------------------------------
create function public.admin_inventory_overview(
  p_query text default null,
  p_warehouse_id uuid default null,
  p_alerts_only boolean default false,
  p_limit int default 25,
  p_offset int default 0
) returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  product_status text,
  sku text,
  variant_label text,
  variant_status text,
  tracks_lots boolean,
  tracks_expiry boolean,
  on_hand int,
  reserved int,
  committed int,
  available int,
  next_expiry date,
  stock_status text,
  total_count bigint
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_threshold int := private.setting_int('inventory.low_stock_threshold', 5);
  v_text text := nullif(lower(private.f_unaccent(trim(coalesce(p_query, '')))), '');
  v_pattern text;
  v_code text := nullif(private.normalize_code(p_query), '');
begin
  perform private.require_permission('inventory.read');
  v_pattern := '%' || replace(replace(replace(v_text, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with base as (
    select pv.id as v_id, p.id as p_id, p.name as p_name, p.status as p_status, pv.sku as v_sku,
           pv.label as v_label, pv.status as v_status, p.tracks_lots as v_lots, p.tracks_expiry as v_expiry,
           coalesce(sum(sb.on_hand), 0)::int as v_on_hand,
           coalesce(sum(sb.reserved), 0)::int as v_reserved,
           coalesce(sum(sb.committed), 0)::int as v_committed,
           case
             when p_warehouse_id is null then private.available_qty(pv.id)
             else greatest(private.sellable_on_hand(pv.id, p_warehouse_id)
                           - coalesce(sum(sb.reserved), 0)::int - coalesce(sum(sb.committed), 0)::int, 0)
           end as v_available
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      left join public.stock_balances sb
        on sb.variant_id = pv.id and (p_warehouse_id is null or sb.warehouse_id = p_warehouse_id)
     where (v_text is null
            or p.search_text like v_pattern
            or (v_code is not null and (pv.sku_norm like v_code || '%' or pv.manufacturer_ref_norm like v_code || '%')))
     group by pv.id, p.id
  ), enriched as (
    select b.*,
           (select min(l.expiry_date)
              from public.inventory_lots l
              join public.lot_balances lb on lb.lot_id = l.id
             where l.variant_id = b.v_id
               and lb.on_hand > 0
               and (p_warehouse_id is null or lb.warehouse_id = p_warehouse_id)) as v_next_expiry,
           case
             when b.v_available <= 0 then 'out_of_stock'
             when b.v_available <= v_threshold then 'low_stock'
             else 'in_stock'
           end as v_stock_status
      from base b
  )
  select e.v_id, e.p_id, e.p_name, e.p_status, e.v_sku, e.v_label, e.v_status, e.v_lots, e.v_expiry,
         e.v_on_hand, e.v_reserved, e.v_committed, e.v_available, e.v_next_expiry, e.v_stock_status,
         count(*) over ()
    from enriched e
   where not coalesce(p_alerts_only, false)
      or (e.p_status = 'published' and e.v_status = 'active' and e.v_stock_status <> 'in_stock')
   order by e.p_name, e.v_sku
   limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end
$$;

-- -----------------------------------------------------------------------------
-- Libro de movimientos con responsable (el personal de inventario no necesita
-- permiso de clientes para saber quién registró un movimiento)
-- -----------------------------------------------------------------------------
create function public.admin_stock_movements(
  p_variant_id uuid default null,
  p_warehouse_id uuid default null,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id bigint,
  occurred_at timestamptz,
  variant_id uuid,
  sku text,
  product_name text,
  warehouse_code text,
  lot_number text,
  quantity int,
  movement_type text,
  reason text,
  reference_type text,
  reference_id uuid,
  on_hand_after int,
  actor_name text,
  total_count bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_permission('inventory.read');
  return query
  select m.id, m.occurred_at, m.variant_id, pv.sku, p.name, w.code, l.lot_number, m.quantity, m.movement_type,
         m.reason, m.reference_type, m.reference_id, m.on_hand_after,
         case when m.actor_id is null then null else coalesce(nullif(pr.full_name, ''), 'Usuario sin nombre') end,
         count(*) over ()
    from public.stock_movements m
    join public.product_variants pv on pv.id = m.variant_id
    join public.products p on p.id = pv.product_id
    join public.warehouses w on w.id = m.warehouse_id
    left join public.inventory_lots l on l.id = m.lot_id
    left join public.profiles pr on pr.id = m.actor_id
   where (p_variant_id is null or m.variant_id = p_variant_id)
     and (p_warehouse_id is null or m.warehouse_id = p_warehouse_id)
   order by m.occurred_at desc, m.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end
$$;

-- Las funciones del panel no se exponen a usuarios anónimos.
revoke execute on function
  public.admin_dashboard_summary(),
  public.admin_search_products(text, text, uuid, int, int),
  public.admin_inventory_overview(text, uuid, boolean, int, int),
  public.admin_stock_movements(uuid, uuid, int, int)
from public, anon;
grant execute on function
  public.admin_dashboard_summary(),
  public.admin_search_products(text, text, uuid, int, int),
  public.admin_inventory_overview(text, uuid, boolean, int, int),
  public.admin_stock_movements(uuid, uuid, int, int)
to authenticated, service_role;
