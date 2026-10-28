-- =============================================================================
-- 0400 · Precios, costos e inventario (saldos, lotes, movimientos y reservas)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listas de precios (montos netos en CLP enteros)
-- -----------------------------------------------------------------------------
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  kind text not null default 'base' check (kind in ('base', 'customer', 'organization', 'tier')),
  currency char(3) not null default 'CLP' check (currency = 'CLP'),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to > valid_from)
);
create unique index price_lists_single_default on public.price_lists (is_default) where is_default;
create trigger price_lists_updated_at before update on public.price_lists
  for each row execute function private.set_updated_at();
create trigger price_lists_audit after insert or update or delete on public.price_lists
  for each row execute function private.audit_row();

create table public.price_list_items (
  price_list_id uuid not null references public.price_lists (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  min_quantity int not null default 1 check (min_quantity >= 1),
  unit_price_net bigint not null check (unit_price_net > 0),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (price_list_id, variant_id, min_quantity)
);
create index price_list_items_variant_idx on public.price_list_items (variant_id);

create function private.price_list_items_stamp() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end
$$;
create trigger price_list_items_stamp before insert or update on public.price_list_items
  for each row execute function private.price_list_items_stamp();
-- PRC-03: historial de cambios de precio.
create trigger price_list_items_audit after insert or update or delete on public.price_list_items
  for each row execute function private.audit_row('price_list_id,variant_id,min_quantity', 'updated_by');

alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
create policy price_lists_select on public.price_lists for select to authenticated
  using ((select private.has_permission('prices.read')));
create policy price_lists_write on public.price_lists for all to authenticated
  using ((select private.has_permission('prices.update')))
  with check ((select private.has_permission('prices.update')));
create policy price_list_items_select on public.price_list_items for select to authenticated
  using ((select private.has_permission('prices.read')));
create policy price_list_items_write on public.price_list_items for all to authenticated
  using ((select private.has_permission('prices.update')))
  with check ((select private.has_permission('prices.update')));

-- Precio unitario neto vigente para una cantidad (lista por defecto; listas por cliente en F4).
create function private.unit_price_for(p_variant_id uuid, p_quantity int)
returns table (price_list_id uuid, unit_price_net bigint)
language sql stable security definer
set search_path = ''
as $$
  select pli.price_list_id, pli.unit_price_net
    from public.price_list_items pli
    join public.price_lists pl on pl.id = pli.price_list_id
   where pl.is_default
     and pl.status = 'active'
     and (pl.valid_from is null or pl.valid_from <= now())
     and (pl.valid_to is null or pl.valid_to > now())
     and pli.variant_id = p_variant_id
     and pli.min_quantity <= greatest(p_quantity, 1)
   order by pli.min_quantity desc
   limit 1
$$;

-- ¿Puede el usuario actual ver precios? ('public' | 'authenticated' | 'verified_professionals')
create function private.can_view_prices() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.has_permission('prices.read') or
    case private.setting_text('pricing.visibility', 'authenticated')
      when 'public' then true
      when 'authenticated' then auth.uid() is not null
      when 'verified_professionals' then exists (
        select 1 from public.profiles where id = auth.uid() and professional_status = 'verified')
      else false
    end
$$;
grant execute on function private.can_view_prices() to anon, authenticated, service_role;

create function private.iva_rate() returns numeric
language sql stable
set search_path = ''
as $$ select private.setting_numeric('tax.iva_rate', 0.19) $$;

-- Precios visibles para el usuario actual (solo variantes que puede ver por RLS).
create function public.get_variant_prices(p_variant_ids uuid[])
returns table (
  variant_id uuid,
  price_visible boolean,
  tax_class text,
  unit_price_net bigint,
  unit_price_gross bigint,
  tiers jsonb
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_visible boolean := private.can_view_prices();
  v_rate numeric := private.iva_rate();
begin
  return query
  with visible as (
    select pv.id, p.tax_class
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = any (p_variant_ids)
       and ((p.status = 'published' and pv.status <> 'inactive' and private.catalog_visible())
            or private.has_permission('catalog.read'))
  )
  select vis.id,
         v_visible,
         vis.tax_class,
         case when v_visible then up.unit_price_net end,
         case when v_visible then
           case when vis.tax_class = 'iva' then round(up.unit_price_net * (1 + v_rate))::bigint
                else up.unit_price_net end
         end,
         case when v_visible then (
           select coalesce(jsonb_agg(jsonb_build_object('min_quantity', pli.min_quantity,
                                                        'unit_price_net', pli.unit_price_net)
                                     order by pli.min_quantity), '[]'::jsonb)
             from public.price_list_items pli
            where pli.variant_id = vis.id and pli.price_list_id = up.price_list_id
         ) end
    from visible vis
    left join lateral private.unit_price_for(vis.id, 1) up on true;
end
$$;

-- -----------------------------------------------------------------------------
-- Costos de adquisición (información sensible: solo 'costs.read')
-- -----------------------------------------------------------------------------
create table public.variant_costs (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  supplier_id uuid,
  unit_cost numeric(14, 4) not null check (unit_cost > 0),
  cost_currency char(3) not null default 'CLP' check (cost_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(14, 6) not null default 1 check (exchange_rate > 0),
  unit_cost_clp bigint generated always as (round(unit_cost * exchange_rate)::bigint) stored,
  valid_from timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'purchase_order', 'import')),
  notes text check (length(notes) <= 500),
  recorded_by uuid,
  created_at timestamptz not null default now(),
  check (cost_currency <> 'CLP' or exchange_rate = 1)
);
create index variant_costs_variant_idx on public.variant_costs (variant_id, valid_from desc);
create trigger variant_costs_audit after insert or update or delete on public.variant_costs
  for each row execute function private.audit_row();

create function private.variant_costs_stamp() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := auth.uid();
  return new;
end
$$;
create trigger variant_costs_stamp before insert on public.variant_costs
  for each row execute function private.variant_costs_stamp();

alter table public.variant_costs enable row level security;
create policy variant_costs_select on public.variant_costs for select to authenticated
  using ((select private.has_permission('costs.read')));
create policy variant_costs_insert on public.variant_costs for insert to authenticated
  with check ((select private.has_permission('costs.update')));
-- El historial de costos no se modifica: se agregan nuevos registros.
revoke update, delete, truncate on public.variant_costs from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Bodegas
-- -----------------------------------------------------------------------------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text not null check (length(name) between 2 and 120),
  address_line text check (length(address_line) <= 200),
  comuna_code text references public.comunas (code),
  is_active boolean not null default true,
  is_sellable boolean not null default true,
  is_pickup_point boolean not null default false,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger warehouses_updated_at before update on public.warehouses
  for each row execute function private.set_updated_at();
create trigger warehouses_audit after insert or update or delete on public.warehouses
  for each row execute function private.audit_row();

alter table public.warehouses enable row level security;
-- Los puntos de retiro activos son visibles para todos (checkout); el resto solo para el personal.
create policy warehouses_select on public.warehouses for select to anon, authenticated
  using ((is_active and is_pickup_point) or (select private.has_permission('inventory.read')));
create policy warehouses_write on public.warehouses for all to authenticated
  using ((select private.has_permission('warehouses.manage')))
  with check ((select private.has_permission('warehouses.manage')));

-- -----------------------------------------------------------------------------
-- Saldos, lotes, movimientos y reservas (ADR-0006)
-- -----------------------------------------------------------------------------
create table public.stock_balances (
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  on_hand int not null default 0,
  reserved int not null default 0,
  committed int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (variant_id, warehouse_id),
  -- Sin stock negativo ni sobreventa (D-12).
  constraint stock_balances_non_negative check (
    on_hand >= 0 and reserved >= 0 and committed >= 0 and reserved + committed <= on_hand
  )
);
create index stock_balances_warehouse_idx on public.stock_balances (warehouse_id);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  lot_number text not null check (length(lot_number) between 1 and 40),
  expiry_date date,
  manufactured_date date,
  supplier_id uuid,
  received_at timestamptz not null default now(),
  status text not null default 'available' check (status in ('available', 'quarantine', 'recalled', 'expired')),
  document_id uuid references public.documents (id),
  notes text check (length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, lot_number)
);
create index inventory_lots_expiry_idx on public.inventory_lots (expiry_date) where expiry_date is not null;
create trigger inventory_lots_updated_at before update on public.inventory_lots
  for each row execute function private.set_updated_at();
create trigger inventory_lots_audit after insert or update or delete on public.inventory_lots
  for each row execute function private.audit_row();

create table public.lot_balances (
  lot_id uuid not null references public.inventory_lots (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  on_hand int not null default 0 check (on_hand >= 0),
  location text check (length(location) <= 40),
  updated_at timestamptz not null default now(),
  primary key (lot_id, warehouse_id)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  lot_id uuid references public.inventory_lots (id) on delete restrict,
  quantity int not null check (quantity <> 0),
  movement_type text not null check (movement_type in (
    'receipt', 'adjustment', 'sale_dispatch', 'return_restock', 'transfer_out', 'transfer_in', 'write_off')),
  reason text check (length(reason) <= 500),
  reference_type text check (reference_type in ('order', 'purchase_order', 'return', 'transfer', 'manual', 'count')),
  reference_id uuid,
  actor_id uuid,
  on_hand_after int not null,
  check (movement_type not in ('adjustment', 'write_off') or reason is not null)
);
comment on table public.stock_movements is 'Libro inmutable de movimientos de inventario (INV-02).';
create index stock_movements_variant_idx on public.stock_movements (variant_id, occurred_at desc);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id);
create index stock_movements_lot_idx on public.stock_movements (lot_id) where lot_id is not null;

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  quantity int not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'committed', 'consumed', 'released')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stock_reservations_order_idx on public.stock_reservations (order_id);
create index stock_reservations_active_idx on public.stock_reservations (expires_at) where status = 'active';
create trigger stock_reservations_updated_at before update on public.stock_reservations
  for each row execute function private.set_updated_at();

alter table public.stock_balances enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.lot_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_reservations enable row level security;
create policy stock_balances_select on public.stock_balances for select to authenticated
  using ((select private.has_permission('inventory.read')));
create policy inventory_lots_select on public.inventory_lots for select to authenticated
  using ((select private.has_permission('inventory.read')));
create policy lot_balances_select on public.lot_balances for select to authenticated
  using ((select private.has_permission('inventory.read')));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select private.has_permission('inventory.read')));
create policy stock_reservations_select on public.stock_reservations for select to authenticated
  using ((select private.has_permission('inventory.read')));
-- El inventario solo cambia mediante funciones (RPC); nunca por escritura directa.
revoke insert, update, delete, truncate on public.stock_balances, public.inventory_lots, public.lot_balances,
  public.stock_movements, public.stock_reservations from anon, authenticated;

-- ¿El lote se puede vender hoy? (disponible y no vencido; margen mínimo configurable)
create function private.lot_is_sellable(p_status text, p_expiry date) returns boolean
language sql stable
set search_path = ''
as $$
  select p_status = 'available'
     and (p_expiry is null
          or p_expiry > current_date + private.setting_int('inventory.min_days_to_expiry_for_sale', 0))
$$;

-- Stock físico vendible de una variante en una bodega (excluye lotes en cuarentena, retirados o vencidos).
create function private.sellable_on_hand(p_variant_id uuid, p_warehouse_id uuid) returns int
language sql stable security definer
set search_path = ''
as $$
  select case
    when p.tracks_lots then coalesce((
      select sum(lb.on_hand)::int
        from public.lot_balances lb
        join public.inventory_lots l on l.id = lb.lot_id
       where l.variant_id = p_variant_id
         and lb.warehouse_id = p_warehouse_id
         and private.lot_is_sellable(l.status, l.expiry_date)
    ), 0)
    else coalesce((
      select sb.on_hand from public.stock_balances sb
       where sb.variant_id = p_variant_id and sb.warehouse_id = p_warehouse_id
    ), 0)
  end
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
   where pv.id = p_variant_id
$$;

-- Disponible para la venta = Σ bodegas vendibles (vendible − reservado − comprometido), mínimo 0.
create function private.available_qty(p_variant_id uuid) returns int
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(greatest(private.sellable_on_hand(sb.variant_id, sb.warehouse_id) - sb.reserved - sb.committed, 0)), 0)::int
    from public.stock_balances sb
    join public.warehouses w on w.id = sb.warehouse_id
   where sb.variant_id = p_variant_id
     and w.is_active
     and w.is_sellable
$$;

-- Movimiento de inventario atómico: actualiza saldos (variante y lote) y registra el libro.
create function private.apply_stock_movement(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_lot_id uuid,
  p_quantity int,
  p_type text,
  p_reason text,
  p_reference_type text,
  p_reference_id uuid
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_balance public.stock_balances;
  v_lot_on_hand int;
  v_movement_id bigint;
begin
  insert into public.stock_balances (variant_id, warehouse_id)
  values (p_variant_id, p_warehouse_id)
  on conflict do nothing;

  select * into v_balance from public.stock_balances
   where variant_id = p_variant_id and warehouse_id = p_warehouse_id
   for update;

  if v_balance.on_hand + p_quantity < v_balance.reserved + v_balance.committed then
    perform private.raise_error('INSUFFICIENT_STOCK',
      format('Disponible %s, reservado %s, comprometido %s, movimiento %s',
             v_balance.on_hand, v_balance.reserved, v_balance.committed, p_quantity));
  end if;

  if p_lot_id is not null then
    insert into public.lot_balances (lot_id, warehouse_id)
    values (p_lot_id, p_warehouse_id)
    on conflict do nothing;
    select on_hand into v_lot_on_hand from public.lot_balances
     where lot_id = p_lot_id and warehouse_id = p_warehouse_id
     for update;
    if v_lot_on_hand + p_quantity < 0 then
      perform private.raise_error('INSUFFICIENT_STOCK', 'Saldo insuficiente en el lote');
    end if;
    update public.lot_balances set on_hand = on_hand + p_quantity, updated_at = now()
     where lot_id = p_lot_id and warehouse_id = p_warehouse_id;
  end if;

  update public.stock_balances set on_hand = on_hand + p_quantity, updated_at = now()
   where variant_id = p_variant_id and warehouse_id = p_warehouse_id;

  insert into public.stock_movements (variant_id, warehouse_id, lot_id, quantity, movement_type, reason,
                                      reference_type, reference_id, actor_id, on_hand_after)
  values (p_variant_id, p_warehouse_id, p_lot_id, p_quantity, p_type, p_reason,
          p_reference_type, p_reference_id, auth.uid(), v_balance.on_hand + p_quantity)
  returning id into v_movement_id;

  return v_movement_id;
end
$$;

-- Ingreso manual de mercadería (las recepciones con orden de compra llegan en F5).
create function public.inventory_receive(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_quantity int,
  p_lot_number text default null,
  p_expiry_date date default null,
  p_reason text default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_lot public.inventory_lots;
begin
  perform private.require_permission('inventory.receive');
  if p_quantity is null or p_quantity <= 0 then
    perform private.raise_error('INVALID_QUANTITY');
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

  return private.apply_stock_movement(p_variant_id, p_warehouse_id, v_lot.id, p_quantity,
                                      'receipt', p_reason, 'manual', null);
end
$$;

-- Ajuste con motivo obligatorio (positivo o negativo). Para variantes con lote, se indica el lote.
create function public.inventory_adjust(
  p_variant_id uuid,
  p_warehouse_id uuid,
  p_delta int,
  p_reason text,
  p_lot_id uuid default null
) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tracks_lots boolean;
begin
  perform private.require_permission('inventory.adjust');
  if p_delta is null or p_delta = 0 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  if nullif(trim(p_reason), '') is null then
    perform private.raise_error('REASON_REQUIRED');
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
  return private.apply_stock_movement(p_variant_id, p_warehouse_id, p_lot_id, p_delta,
                                      'adjustment', trim(p_reason), 'manual', null);
end
$$;

-- Cambio de estado de un lote (cuarentena, retiro de mercado, vencido) con motivo auditado.
create function public.set_lot_status(p_lot_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform private.require_permission('inventory.lots');
  if p_status not in ('available', 'quarantine', 'recalled', 'expired') then
    perform private.raise_error('INVALID_INPUT', 'status');
  end if;
  if nullif(trim(p_reason), '') is null then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select status into v_old from public.inventory_lots where id = p_lot_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'lote');
  end if;
  update public.inventory_lots set status = p_status where id = p_lot_id;
  perform private.audit_event('lot.status_change', 'inventory_lots', p_lot_id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status),
    jsonb_build_object('reason', trim(p_reason)));
end
$$;

-- Disponibilidad para los clientes: estado + cantidad solo si quedan pocas unidades.
-- El personal con 'inventory.read' ve la cantidad exacta.
create function public.get_availability(p_variant_ids uuid[])
returns table (variant_id uuid, status text, available_qty int)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_threshold int := private.setting_int('inventory.low_stock_threshold', 5);
  v_staff boolean := private.has_permission('inventory.read');
begin
  return query
  select pv.id,
         case
           when q.qty <= 0 then 'out_of_stock'
           when q.qty <= v_threshold then 'low_stock'
           else 'in_stock'
         end,
         case when v_staff or q.qty <= v_threshold then q.qty end
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    cross join lateral (select private.available_qty(pv.id) as qty) q
   where pv.id = any (p_variant_ids)
     and ((p.status = 'published' and pv.status <> 'inactive' and private.catalog_visible()) or v_staff);
end
$$;
