-- =============================================================================
-- 0500 · Carrito, despacho, pedidos, pagos y envíos
--        Operaciones críticas transaccionales e idempotentes (ADR-0003)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Carrito (persistido en el servidor; NO guarda precios)
-- -----------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  converted_order_id uuid,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index carts_one_active_idx on public.carts (user_id) where status = 'active';
create trigger carts_updated_at before update on public.carts
  for each row execute function private.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 999),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function private.set_updated_at();

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
create policy carts_select on public.carts for select to authenticated
  using (user_id = (select auth.uid()));
create policy cart_items_select on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
-- Las modificaciones del carrito pasan por cart_add_item / cart_set_item (validan el producto).
revoke insert, update, delete, truncate on public.carts, public.cart_items from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Despacho: métodos y tarifas por comuna / región / general
-- -----------------------------------------------------------------------------
create table public.shipping_methods (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  description text,
  requires_address boolean not null default true,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_methods_updated_at before update on public.shipping_methods
  for each row execute function private.set_updated_at();
create trigger shipping_methods_audit after insert or update or delete on public.shipping_methods
  for each row execute function private.audit_row('code');

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  method_code text not null references public.shipping_methods (code) on delete cascade,
  region_code text references public.regions (code),
  comuna_code text references public.comunas (code),
  price_net bigint not null check (price_net >= 0),
  free_over_net bigint check (free_over_net > 0),
  est_days_min int not null check (est_days_min >= 0),
  est_days_max int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (est_days_max >= est_days_min),
  check (num_nonnulls(region_code, comuna_code) <= 1)
);
create unique index shipping_rates_scope_idx on public.shipping_rates
  (method_code, coalesce(region_code, ''), coalesce(comuna_code, ''));
create trigger shipping_rates_updated_at before update on public.shipping_rates
  for each row execute function private.set_updated_at();
create trigger shipping_rates_audit after insert or update or delete on public.shipping_rates
  for each row execute function private.audit_row();

alter table public.shipping_methods enable row level security;
alter table public.shipping_rates enable row level security;
create policy shipping_methods_select on public.shipping_methods for select to anon, authenticated
  using (is_active or (select private.has_permission('settings.read')));
create policy shipping_methods_write on public.shipping_methods for all to authenticated
  using ((select private.has_permission('settings.update')))
  with check ((select private.has_permission('settings.update')));
create policy shipping_rates_select on public.shipping_rates for select to anon, authenticated
  using (is_active or (select private.has_permission('settings.read')));
create policy shipping_rates_write on public.shipping_rates for all to authenticated
  using ((select private.has_permission('settings.update')))
  with check ((select private.has_permission('settings.update')));

-- Tarifa más específica: comuna > región > general. Sin tarifa = sin cobertura.
create function private.resolve_shipping_rate(p_method text, p_comuna text)
returns table (rate_id uuid, price_net bigint, free_over_net bigint, est_days_min int, est_days_max int)
language sql stable security definer
set search_path = ''
as $$
  select r.id, r.price_net, r.free_over_net, r.est_days_min, r.est_days_max
    from public.shipping_rates r
    left join public.comunas c on c.code = p_comuna
   where r.method_code = p_method
     and r.is_active
     and (   r.comuna_code = p_comuna
          or (r.comuna_code is null and r.region_code = c.region_code)
          or (r.comuna_code is null and r.region_code is null))
   order by (r.comuna_code is not null) desc, (r.region_code is not null) desc
   limit 1
$$;

-- -----------------------------------------------------------------------------
-- Pedidos (snapshots inmutables)
-- -----------------------------------------------------------------------------
create sequence public.order_number_seq;
revoke all on sequence public.order_number_seq from anon, authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  placed_by uuid,
  status text not null default 'pending_payment' check (status in
    ('pending_payment', 'paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in
    ('unpaid', 'paid', 'partially_refunded', 'refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in
    ('unfulfilled', 'fulfilled', 'partially_returned', 'returned')),
  document_type text not null check (document_type in ('boleta', 'factura')),
  price_mode text not null check (price_mode in ('net', 'gross')),
  currency char(3) not null default 'CLP' check (currency = 'CLP'),
  tax_rate numeric(5, 4) not null check (tax_rate >= 0 and tax_rate < 1),
  subtotal_net bigint not null check (subtotal_net >= 0),
  discount_net bigint not null default 0 check (discount_net >= 0),
  shipping_net bigint not null default 0 check (shipping_net >= 0),
  shipping_gross bigint not null default 0 check (shipping_gross >= 0),
  taxable_net bigint not null check (taxable_net >= 0),
  exempt_net bigint not null default 0 check (exempt_net >= 0),
  tax_amount bigint not null check (tax_amount >= 0),
  total bigint not null check (total > 0),
  shipping_method_code text not null references public.shipping_methods (code),
  shipping_snapshot jsonb not null,
  shipping_address_snapshot jsonb,
  pickup_warehouse_id uuid references public.warehouses (id),
  billing_snapshot jsonb,
  customer_snapshot jsonb not null,
  estimated_delivery_min date,
  estimated_delivery_max date,
  customer_notes text check (length(customer_notes) <= 500),
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  source_channel text not null default 'app' check (source_channel in ('app', 'app_ios', 'app_android', 'web', 'admin')),
  reservation_expires_at timestamptz,
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (document_type <> 'factura' or billing_snapshot is not null)
);
comment on column public.orders.estimated_delivery_min is 'Plazo ESTIMADO (no confirmado).';
create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_pending_expiry_idx on public.orders (reservation_expires_at) where status = 'pending_payment';
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();
create trigger orders_audit after update on public.orders
  for each row execute function private.audit_row('id', 'customer_snapshot', 'shipping_address_snapshot', 'billing_snapshot');

alter table public.stock_reservations
  add constraint stock_reservations_order_fk foreign key (order_id) references public.orders (id) on delete restrict;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  line_no int not null check (line_no > 0),
  item_type text not null default 'product' check (item_type in ('product', 'kit', 'kit_component')),
  parent_item_id uuid references public.order_items (id),
  product_id uuid references public.products (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete restrict,
  sku text not null,
  manufacturer_ref text,
  product_name text not null,
  variant_label text,
  quantity int not null check (quantity > 0),
  tax_class text not null check (tax_class in ('iva', 'exempt')),
  unit_price_net bigint not null check (unit_price_net >= 0),
  unit_price_gross bigint not null check (unit_price_gross >= 0),
  discount_net bigint not null default 0 check (discount_net >= 0),
  line_net bigint not null check (line_net >= 0),
  line_gross bigint not null check (line_gross >= 0),
  line_total bigint not null check (line_total >= 0),
  price_list_id uuid references public.price_lists (id),
  created_at timestamptz not null default now(),
  unique (order_id, line_no)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

-- Los ítems de un pedido confirmado son inmutables (precios históricos).
create function private.prevent_modification() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'IMMUTABLE_RECORD',
    detail = format('%s no se puede modificar ni eliminar', tg_table_name);
end
$$;
create trigger order_items_immutable before update or delete on public.order_items
  for each row execute function private.prevent_modification();

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);
create trigger order_status_history_immutable before update or delete on public.order_status_history
  for each row execute function private.prevent_modification();

create table public.order_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  author_id uuid,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index order_internal_notes_order_idx on public.order_internal_notes (order_id);

-- Trazabilidad de lotes: qué lote y bodega se despachó en cada pedido (INV-05).
create table public.order_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  lot_id uuid references public.inventory_lots (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index order_allocations_order_idx on public.order_allocations (order_id);
create index order_allocations_lot_idx on public.order_allocations (lot_id) where lot_id is not null;

-- -----------------------------------------------------------------------------
-- Pagos (sin datos completos de tarjeta)
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider ~ '^[a-z_]+$'),
  method text check (method in ('credit_card', 'debit_card', 'prepaid_card', 'bank_transfer', 'wallet', 'other')),
  status text not null default 'created' check (status in (
    'created', 'pending', 'authorized', 'approved', 'rejected', 'cancelled', 'expired', 'error',
    'partially_refunded', 'refunded')),
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'CLP',
  buy_order text not null unique check (buy_order ~ '^[A-Za-z0-9]{1,26}$'),
  provider_token text,
  provider_transaction_id text,
  authorization_code text,
  card_last4 text check (card_last4 ~ '^\d{4}$'),
  installments int check (installments >= 0),
  response_code text,
  failure_reason text,
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount <= amount)
);
create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_token_idx on public.payments (provider, provider_token) where provider_token is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger payments_audit after insert or update on public.payments
  for each row execute function private.audit_row('id', 'provider_token');

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  payment_id uuid references public.payments (id) on delete restrict,
  event_type text not null,
  signature_valid boolean,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text,
  unique (provider, provider_event_id)
);
comment on table public.payment_events is 'Eventos y webhooks de pago (idempotencia por proveedor + id de evento). Payload saneado.';

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  amount bigint not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')),
  reason text not null check (length(reason) between 3 and 500),
  provider_refund_id text,
  requested_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function private.set_updated_at();
create trigger refunds_audit after insert or update on public.refunds
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Envíos (solo datos reales: el número de seguimiento lo entrega el transportista)
-- -----------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  carrier text not null check (length(carrier) between 2 and 60),
  tracking_number text check (length(tracking_number) between 3 and 60),
  tracking_url text check (tracking_url ~ '^https://'),
  status text not null default 'in_transit' check (status in
    ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'incident', 'returned', 'cancelled')),
  estimated_delivery_date date,
  delivered_at timestamptz,
  notes text check (length(notes) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.shipments.estimated_delivery_date is 'Fecha ESTIMADA. La confirmada es delivered_at.';
create index shipments_order_idx on public.shipments (order_id);
create trigger shipments_updated_at before update on public.shipments
  for each row execute function private.set_updated_at();
create trigger shipments_audit after insert or update on public.shipments
  for each row execute function private.audit_row();

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete restrict,
  status text not null,
  description text check (length(description) <= 500),
  occurred_at timestamptz not null default now(),
  source text not null default 'staff' check (source in ('staff', 'carrier_api')),
  recorded_by uuid
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at);

-- -----------------------------------------------------------------------------
-- RLS de pedidos, pagos y envíos (solo lectura desde la API)
-- -----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_internal_notes enable row level security;
alter table public.order_allocations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('orders.read')));
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_status_history_select on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_internal_notes_select on public.order_internal_notes for select to authenticated
  using ((select private.has_permission('orders.read')));
create policy order_allocations_select on public.order_allocations for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
         or (select private.has_permission('payments.read')));
create policy payment_events_select on public.payment_events for select to authenticated
  using ((select private.has_permission('payments.read')));
create policy refunds_select on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
         or (select private.has_permission('payments.read')));
create policy shipments_select on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
         or (select private.has_permission('shipments.read')));
create policy shipment_events_select on public.shipment_events for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id));

-- El cliente puede ver número y vencimiento de los lotes que recibió (trazabilidad en su registro).
create policy inventory_lots_select_own on public.inventory_lots for select to authenticated
  using (exists (
    select 1 from public.order_allocations a
      join public.orders o on o.id = a.order_id
     where a.lot_id = inventory_lots.id and o.user_id = (select auth.uid())
  ));

revoke insert, update, delete, truncate on
  public.orders, public.order_items, public.order_status_history, public.order_internal_notes,
  public.order_allocations, public.payments, public.payment_events, public.refunds,
  public.shipments, public.shipment_events
from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Cálculo de totales (autoridad; ADR-0004). Mismos vectores que packages/domain.
-- -----------------------------------------------------------------------------
create function private.compute_order_totals(
  p_price_mode text, p_tax_rate numeric, p_lines jsonb, p_shipping_net bigint
) returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_unit_net bigint;
  v_qty int;
  v_tax_class text;
  v_disc bigint;
  v_unit_gross bigint;
  v_disc_gross bigint;
  v_line_net bigint;
  v_line_gross bigint;
  v_subtotal_net bigint := 0;
  v_discount_net bigint := 0;
  v_exempt_net bigint := 0;
  v_taxable_net_lines bigint := 0;
  v_taxable_gross_lines bigint := 0;
  v_shipping_gross bigint;
  v_taxable_net bigint;
  v_taxable_gross bigint;
  v_tax bigint;
  v_total bigint;
begin
  if p_price_mode not in ('net', 'gross') then
    raise exception 'price_mode inválido: %', p_price_mode;
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate >= 1 then
    raise exception 'tasa de IVA inválida: %', p_tax_rate;
  end if;
  if p_shipping_net is null or p_shipping_net < 0 then
    raise exception 'despacho inválido: %', p_shipping_net;
  end if;

  for v_line in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_unit_net := (v_line ->> 'unit_price_net')::bigint;
    v_qty := (v_line ->> 'quantity')::int;
    v_tax_class := coalesce(v_line ->> 'tax_class', 'iva');
    v_disc := coalesce((v_line ->> 'discount_net')::bigint, 0);
    if v_unit_net is null or v_unit_net < 0 or v_qty is null or v_qty <= 0 or v_disc < 0
       or v_tax_class not in ('iva', 'exempt') then
      raise exception 'línea inválida: %', v_line;
    end if;

    v_unit_gross := case when v_tax_class = 'iva' then round(v_unit_net * (1 + p_tax_rate))::bigint else v_unit_net end;
    v_disc_gross := case when v_tax_class = 'iva' then round(v_disc * (1 + p_tax_rate))::bigint else v_disc end;
    v_line_net := v_unit_net * v_qty - v_disc;
    v_line_gross := v_unit_gross * v_qty - v_disc_gross;
    if v_line_net < 0 or v_line_gross < 0 then
      raise exception 'el descuento supera el total de la línea: %', v_line;
    end if;

    v_subtotal_net := v_subtotal_net + v_line_net;
    v_discount_net := v_discount_net + v_disc;
    if v_tax_class = 'iva' then
      v_taxable_net_lines := v_taxable_net_lines + v_line_net;
      v_taxable_gross_lines := v_taxable_gross_lines + v_line_gross;
    else
      v_exempt_net := v_exempt_net + v_line_net;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'unit_price_net', v_unit_net,
      'unit_price_gross', v_unit_gross,
      'quantity', v_qty,
      'tax_class', v_tax_class,
      'discount_net', v_disc,
      'line_net', v_line_net,
      'line_gross', v_line_gross,
      'line_total', case p_price_mode when 'net' then v_line_net else v_line_gross end
    );
  end loop;

  v_shipping_gross := round(p_shipping_net * (1 + p_tax_rate))::bigint;

  if p_price_mode = 'net' then
    v_taxable_net := v_taxable_net_lines + p_shipping_net;
    v_tax := round(v_taxable_net * p_tax_rate)::bigint;
    v_total := v_taxable_net + v_exempt_net + v_tax;
  else
    v_taxable_gross := v_taxable_gross_lines + v_shipping_gross;
    v_taxable_net := round(v_taxable_gross / (1 + p_tax_rate))::bigint;
    v_tax := v_taxable_gross - v_taxable_net;
    v_total := v_taxable_gross + v_exempt_net;
  end if;

  return jsonb_build_object(
    'price_mode', p_price_mode,
    'tax_rate', p_tax_rate,
    'lines', v_lines,
    'subtotal_net', v_subtotal_net,
    'discount_net', v_discount_net,
    'shipping_net', p_shipping_net,
    'shipping_gross', v_shipping_gross,
    'taxable_net', v_taxable_net,
    'exempt_net', v_exempt_net,
    'tax_amount', v_tax,
    'total', v_total
  );
end
$$;

-- -----------------------------------------------------------------------------
-- Máquinas de estado (iguales a packages/domain/src/status.ts)
-- -----------------------------------------------------------------------------
create function private.order_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending_payment', 'paid'), ('pending_payment', 'cancelled'),
    ('paid', 'preparing'), ('paid', 'cancelled'),
    ('preparing', 'shipped'), ('preparing', 'ready_for_pickup'), ('preparing', 'cancelled'),
    ('ready_for_pickup', 'delivered'),
    ('shipped', 'delivered')
  )
$$;

create function private.payment_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('created', 'pending'), ('created', 'authorized'), ('created', 'approved'), ('created', 'rejected'),
    ('created', 'cancelled'), ('created', 'expired'), ('created', 'error'),
    ('pending', 'authorized'), ('pending', 'approved'), ('pending', 'rejected'), ('pending', 'cancelled'),
    ('pending', 'expired'), ('pending', 'error'),
    ('authorized', 'approved'), ('authorized', 'cancelled'), ('authorized', 'expired'),
    ('error', 'pending'), ('error', 'approved'), ('error', 'rejected'), ('error', 'cancelled'), ('error', 'expired'),
    -- El proveedor es la fuente de verdad del dinero: si confirma una aprobación después de que
    -- el intento se dio por vencido o anulado, se registra y se aplica la lógica de pago tardío.
    ('expired', 'approved'), ('cancelled', 'approved'),
    ('approved', 'partially_refunded'), ('approved', 'refunded'),
    ('partially_refunded', 'partially_refunded'), ('partially_refunded', 'refunded')
  )
$$;

-- Cambio de estado validado + historial. Bloquea la fila del pedido.
create function private.set_order_status(p_order_id uuid, p_to text, p_reason text, p_force boolean default false)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  select status into v_from from public.orders where id = p_order_id for update;
  if not found then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;
  if not p_force and not private.order_transition_allowed(v_from, p_to) then
    perform private.raise_error('INVALID_STATUS_TRANSITION', format('%s → %s', v_from, p_to));
  end if;
  update public.orders
     set status = p_to,
         paid_at = case when p_to = 'paid' then coalesce(paid_at, now()) else paid_at end,
         cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
         cancel_reason = case when p_to = 'cancelled' then p_reason else cancel_reason end,
         delivered_at = case when p_to = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
   where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, reason)
  values (p_order_id, v_from, p_to, auth.uid(), p_reason);
end
$$;

create function private.next_order_number() returns text
language sql volatile security definer
set search_path = ''
as $$
  select private.setting_text('orders.number_prefix', 'P')
      || to_char(now() at time zone 'America/Santiago', 'YY')
      || '-'
      || lpad(nextval('public.order_number_seq')::text, 6, '0')
$$;

-- -----------------------------------------------------------------------------
-- Reservas de stock (bloqueo por fila en orden determinístico)
-- -----------------------------------------------------------------------------
create function private.reserve_order_stock(p_order_id uuid, p_expires timestamptz) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item record;
  v_bal record;
  v_remaining int;
  v_sellable int;
  v_take int;
begin
  for v_item in
    select oi.variant_id, sum(oi.quantity)::int as qty, min(oi.sku) as sku
      from public.order_items oi
     where oi.order_id = p_order_id and oi.item_type in ('product', 'kit_component')
     group by oi.variant_id
     order by oi.variant_id
  loop
    v_remaining := v_item.qty;
    for v_bal in
      select sb.warehouse_id, sb.reserved, sb.committed
        from public.stock_balances sb
        join public.warehouses w on w.id = sb.warehouse_id
       where sb.variant_id = v_item.variant_id and w.is_active and w.is_sellable
       order by w.priority, w.code
         for update of sb
    loop
      exit when v_remaining = 0;
      v_sellable := private.sellable_on_hand(v_item.variant_id, v_bal.warehouse_id) - v_bal.reserved - v_bal.committed;
      continue when v_sellable <= 0;
      v_take := least(v_sellable, v_remaining);
      update public.stock_balances
         set reserved = reserved + v_take, updated_at = now()
       where variant_id = v_item.variant_id and warehouse_id = v_bal.warehouse_id;
      insert into public.stock_reservations (order_id, variant_id, warehouse_id, quantity, status, expires_at)
      values (p_order_id, v_item.variant_id, v_bal.warehouse_id, v_take, 'active', p_expires);
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      perform private.raise_error('OUT_OF_STOCK', v_item.sku,
        jsonb_build_object('sku', v_item.sku, 'requested', v_item.qty, 'available', v_item.qty - v_remaining)::text);
    end if;
  end loop;
end
$$;

-- Pago aprobado: reservado → comprometido.
create function private.commit_order_reservations(p_order_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, variant_id, warehouse_id, quantity from public.stock_reservations
     where order_id = p_order_id and status = 'active'
     order by variant_id, warehouse_id
       for update
  loop
    update public.stock_balances
       set reserved = reserved - r.quantity, committed = committed + r.quantity, updated_at = now()
     where variant_id = r.variant_id and warehouse_id = r.warehouse_id;
    update public.stock_reservations set status = 'committed' where id = r.id;
  end loop;
end
$$;

-- Cancelación o vencimiento: libera reservas activas y compromisos.
create function private.release_order_reservations(p_order_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, variant_id, warehouse_id, quantity, status from public.stock_reservations
     where order_id = p_order_id and status in ('active', 'committed')
     order by variant_id, warehouse_id
       for update
  loop
    if r.status = 'active' then
      update public.stock_balances set reserved = reserved - r.quantity, updated_at = now()
       where variant_id = r.variant_id and warehouse_id = r.warehouse_id;
    else
      update public.stock_balances set committed = committed - r.quantity, updated_at = now()
       where variant_id = r.variant_id and warehouse_id = r.warehouse_id;
    end if;
    update public.stock_reservations set status = 'released' where id = r.id;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Carrito: líneas con validación del servidor
-- -----------------------------------------------------------------------------
create function private.cart_lines(p_user uuid)
returns table (
  cart_item_id uuid,
  variant_id uuid,
  product_id uuid,
  product_slug text,
  sku text,
  manufacturer_ref text,
  product_name text,
  variant_label text,
  quantity int,
  tax_class text,
  requires_professional boolean,
  price_list_id uuid,
  unit_price_net bigint,
  available_qty int,
  issue text
)
language sql stable security definer
set search_path = ''
as $$
  select ci.id, pv.id, p.id, p.slug, pv.sku, pv.manufacturer_ref, p.name, pv.label, ci.quantity,
         p.tax_class, p.requires_professional, up.price_list_id, up.unit_price_net, a.qty,
         case
           when p.status <> 'published' or pv.status <> 'active' then 'ITEM_UNAVAILABLE'
           when p.requires_professional and not exists (
             select 1 from public.profiles pr where pr.id = p_user and pr.professional_status = 'verified')
             then 'PROFESSIONAL_VERIFICATION_REQUIRED'
           when up.unit_price_net is null then 'PRICE_NOT_AVAILABLE'
           when a.qty < ci.quantity then 'OUT_OF_STOCK'
         end
    from public.carts c
    join public.cart_items ci on ci.cart_id = c.id
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    left join lateral private.unit_price_for(pv.id, ci.quantity) up on true
    cross join lateral (select private.available_qty(pv.id) as qty) a
   where c.user_id = p_user and c.status = 'active'
   order by ci.added_at, ci.id
$$;

create function private.ensure_active_cart(p_user uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cart uuid;
begin
  select id into v_cart from public.carts where user_id = p_user and status = 'active';
  if v_cart is null then
    insert into public.carts (user_id) values (p_user)
    on conflict (user_id) where status = 'active' do nothing
    returning id into v_cart;
    if v_cart is null then
      select id into v_cart from public.carts where user_id = p_user and status = 'active';
    end if;
  end if;
  return v_cart;
end
$$;

create function private.assert_variant_purchasable(p_user uuid, p_variant_id uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_requires boolean;
begin
  select p.requires_professional into v_requires
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
   where pv.id = p_variant_id and pv.status = 'active' and p.status = 'published';
  if not found then
    perform private.raise_error('ITEM_UNAVAILABLE');
  end if;
  if v_requires and not exists (
    select 1 from public.profiles where id = p_user and professional_status = 'verified'
  ) then
    perform private.raise_error('PROFESSIONAL_VERIFICATION_REQUIRED');
  end if;
end
$$;

-- Cantidad absoluta (0 elimina la línea).
create function public.cart_set_item(p_variant_id uuid, p_quantity int) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cart uuid;
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 999 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  v_cart := private.ensure_active_cart(v_uid);
  if p_quantity = 0 then
    delete from public.cart_items where cart_id = v_cart and variant_id = p_variant_id;
  else
    perform private.assert_variant_purchasable(v_uid, p_variant_id);
    insert into public.cart_items (cart_id, variant_id, quantity)
    values (v_cart, p_variant_id, p_quantity)
    on conflict (cart_id, variant_id) do update set quantity = excluded.quantity;
  end if;
  update public.carts set last_activity_at = now() where id = v_cart;
end
$$;

-- Suma unidades a la línea (botón "Agregar al carrito").
create function public.cart_add_item(p_variant_id uuid, p_quantity int default 1) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cart uuid;
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  perform private.assert_variant_purchasable(v_uid, p_variant_id);
  v_cart := private.ensure_active_cart(v_uid);
  insert into public.cart_items (cart_id, variant_id, quantity)
  values (v_cart, p_variant_id, p_quantity)
  on conflict (cart_id, variant_id) do update
    set quantity = least(public.cart_items.quantity + excluded.quantity, 999);
  update public.carts set last_activity_at = now() where id = v_cart;
end
$$;

create function public.cart_clear() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  delete from public.cart_items ci using public.carts c
   where ci.cart_id = c.id and c.user_id = auth.uid() and c.status = 'active';
end
$$;

-- Cotización del carrito calculada en el servidor (CAR-03). Los clientes solo la muestran.
create function public.get_cart_summary(
  p_document_type text default 'boleta',
  p_shipping_method_code text default null,
  p_address_id uuid default null,
  p_pickup_warehouse_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cart uuid;
  v_price_visible boolean := private.can_view_prices();
  v_price_mode text;
  v_rate numeric := private.iva_rate();
  v_threshold int := private.setting_int('inventory.low_stock_threshold', 5);
  v_items jsonb;
  v_lines jsonb;
  v_issues jsonb;
  v_totals jsonb;
  v_shipping jsonb;
  v_method public.shipping_methods;
  v_comuna text;
  v_ship record;
  v_shipping_net bigint := 0;
  v_subtotal bigint;
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if p_document_type not in ('boleta', 'factura') then
    perform private.raise_error('INVALID_DOCUMENT_TYPE');
  end if;
  v_price_mode := case p_document_type when 'factura' then 'net' else 'gross' end;
  select id into v_cart from public.carts where user_id = v_uid and status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
           'cart_item_id', l.cart_item_id,
           'variant_id', l.variant_id,
           'product_id', l.product_id,
           'product_slug', l.product_slug,
           'sku', l.sku,
           'manufacturer_ref', l.manufacturer_ref,
           'product_name', l.product_name,
           'variant_label', l.variant_label,
           'quantity', l.quantity,
           'tax_class', l.tax_class,
           'requires_professional', l.requires_professional,
           'availability', case when l.available_qty <= 0 then 'out_of_stock'
                                when l.available_qty <= v_threshold then 'low_stock'
                                else 'in_stock' end,
           'available_qty', case when l.available_qty <= v_threshold or l.available_qty < l.quantity
                                 then l.available_qty end,
           'issue', l.issue,
           'unit_price_net', case when v_price_visible then l.unit_price_net end
         ) order by l.ordinality), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object(
           'unit_price_net', l.unit_price_net, 'quantity', l.quantity, 'tax_class', l.tax_class)
           order by l.ordinality) filter (where l.unit_price_net is not null), '[]'::jsonb),
         coalesce(jsonb_agg(distinct l.issue) filter (where l.issue is not null), '[]'::jsonb)
    into v_items, v_lines, v_issues
    from private.cart_lines(v_uid) with ordinality l;

  -- Despacho (opcional en el resumen).
  if p_shipping_method_code is not null then
    select * into v_method from public.shipping_methods where code = p_shipping_method_code and is_active;
    if not found then
      v_shipping := jsonb_build_object('method_code', p_shipping_method_code, 'available', false,
                                       'issue', 'SHIPPING_METHOD_NOT_AVAILABLE');
    else
      if v_method.requires_address then
        select comuna_code into v_comuna from public.addresses
         where id = p_address_id and user_id = v_uid and archived_at is null;
      else
        select comuna_code into v_comuna from public.warehouses
         where id = p_pickup_warehouse_id and is_active and is_pickup_point;
      end if;
      if (v_method.requires_address and v_comuna is null)
         or (not v_method.requires_address and p_pickup_warehouse_id is null) then
        v_shipping := jsonb_build_object('method_code', v_method.code, 'available', false,
          'issue', case when v_method.requires_address then 'ADDRESS_REQUIRED' else 'SHIPPING_NOT_AVAILABLE' end);
      else
        select * into v_ship from private.resolve_shipping_rate(v_method.code, v_comuna);
        if v_ship.rate_id is null then
          v_shipping := jsonb_build_object('method_code', v_method.code, 'available', false,
                                           'issue', 'SHIPPING_NOT_AVAILABLE');
        else
          select coalesce(sum((x ->> 'unit_price_net')::bigint * (x ->> 'quantity')::int), 0)
            into v_subtotal from jsonb_array_elements(v_lines) x;
          v_shipping_net := case when v_ship.free_over_net is not null and v_subtotal >= v_ship.free_over_net
                                 then 0 else v_ship.price_net end;
          v_shipping := jsonb_build_object('method_code', v_method.code, 'available', true,
            'price_net', v_shipping_net, 'est_days_min', v_ship.est_days_min, 'est_days_max', v_ship.est_days_max,
            'free_over_net', v_ship.free_over_net);
        end if;
      end if;
    end if;
  end if;

  if v_price_visible and jsonb_array_length(v_items) > 0 then
    v_totals := private.compute_order_totals(v_price_mode, v_rate, v_lines, v_shipping_net);
  end if;

  return jsonb_build_object(
    'cart_id', v_cart,
    'item_count', (select coalesce(sum((x ->> 'quantity')::int), 0) from jsonb_array_elements(v_items) x),
    'items', v_items,
    'price_visible', v_price_visible,
    'document_type', p_document_type,
    'price_mode', v_price_mode,
    'shipping', v_shipping,
    'totals', v_totals,
    'issues', v_issues,
    'can_checkout', v_price_visible
                    and jsonb_array_length(v_items) > 0
                    and jsonb_array_length(v_issues) = 0
                    and coalesce((v_shipping ->> 'available')::boolean, false)
  );
end
$$;

-- -----------------------------------------------------------------------------
-- Creación de pedido: transaccional e idempotente (CAR-05, CAR-06, CAR-07)
-- -----------------------------------------------------------------------------
create function public.place_order(
  p_idempotency_key text,
  p_document_type text,
  p_shipping_method_code text,
  p_address_id uuid default null,
  p_billing_profile_id uuid default null,
  p_pickup_warehouse_id uuid default null,
  p_customer_notes text default null,
  p_expected_total bigint default null,
  p_source_channel text default 'app'
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.orders;
  v_user record;
  v_profile public.profiles;
  v_cart_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_method public.shipping_methods;
  v_address public.addresses;
  v_pickup public.warehouses;
  v_billing public.billing_profiles;
  v_ship record;
  v_comuna text;
  v_address_snapshot jsonb;
  v_billing_snapshot jsonb;
  v_price_mode text;
  v_rate numeric := private.iva_rate();
  v_subtotal bigint;
  v_shipping_net bigint;
  v_totals jsonb;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_expires timestamptz;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_i int := 0;
  v_line jsonb;
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 100 then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;

  -- Idempotencia: misma clave → mismo pedido (también ante solicitudes simultáneas).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_idempotency_key, 0));
  select * into v_existing from public.orders where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'total', v_existing.total,
      'reservation_expires_at', v_existing.reservation_expires_at, 'created', false);
  end if;

  select email, email_confirmed_at into v_user from auth.users where id = v_uid;
  if v_user.email_confirmed_at is null then
    perform private.raise_error('EMAIL_NOT_CONFIRMED');
  end if;
  if not private.has_accepted_current_legal(v_uid) then
    perform private.raise_error('TERMS_NOT_ACCEPTED');
  end if;
  if not private.can_view_prices() then
    perform private.raise_error('PRICE_NOT_AVAILABLE', 'Precios no visibles para esta cuenta');
  end if;
  if (select count(*) from public.orders where user_id = v_uid and status = 'pending_payment')
       >= private.setting_int('checkout.max_pending_orders', 5) then
    perform private.raise_error('RATE_LIMITED', 'Demasiados pedidos pendientes de pago');
  end if;
  if p_document_type is null or p_document_type not in ('boleta', 'factura') then
    perform private.raise_error('INVALID_DOCUMENT_TYPE');
  end if;
  if p_source_channel not in ('app', 'app_ios', 'app_android', 'web') then
    perform private.raise_error('INVALID_INPUT', 'source_channel');
  end if;
  v_price_mode := case p_document_type when 'factura' then 'net' else 'gross' end;
  select * into v_profile from public.profiles where id = v_uid;

  -- Carrito (bloqueado durante la operación).
  select id into v_cart_id from public.carts where user_id = v_uid and status = 'active' for update;
  select jsonb_agg(to_jsonb(l) order by l.ordinality) into v_items
    from private.cart_lines(v_uid) with ordinality l;
  if v_cart_id is null or v_items is null then
    perform private.raise_error('CART_EMPTY');
  end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if v_item ->> 'issue' is not null and v_item ->> 'issue' <> 'OUT_OF_STOCK' then
      perform private.raise_error(v_item ->> 'issue', v_item ->> 'sku');
    end if;
    v_lines := v_lines || jsonb_build_object('unit_price_net', (v_item ->> 'unit_price_net')::bigint,
      'quantity', (v_item ->> 'quantity')::int, 'tax_class', v_item ->> 'tax_class');
  end loop;

  -- Despacho.
  select * into v_method from public.shipping_methods where code = p_shipping_method_code and is_active;
  if not found then
    perform private.raise_error('SHIPPING_METHOD_NOT_AVAILABLE');
  end if;
  if v_method.requires_address then
    if p_address_id is null then
      perform private.raise_error('ADDRESS_REQUIRED');
    end if;
    select * into v_address from public.addresses
     where id = p_address_id and user_id = v_uid and archived_at is null;
    if not found then
      perform private.raise_error('ADDRESS_NOT_FOUND');
    end if;
    v_comuna := v_address.comuna_code;
    select jsonb_build_object(
             'recipient_name', v_address.recipient_name, 'phone', v_address.phone,
             'street', v_address.street, 'street_number', v_address.street_number, 'unit', v_address.unit,
             'comuna_code', v_address.comuna_code, 'comuna', c.name, 'region', r.name,
             'reference', v_address.reference)
      into v_address_snapshot
      from public.comunas c join public.regions r on r.code = c.region_code
     where c.code = v_address.comuna_code;
  else
    select * into v_pickup from public.warehouses
     where id = p_pickup_warehouse_id and is_active and is_pickup_point;
    if not found then
      perform private.raise_error('SHIPPING_NOT_AVAILABLE', 'Punto de retiro no válido');
    end if;
    v_comuna := v_pickup.comuna_code;
  end if;
  select * into v_ship from private.resolve_shipping_rate(v_method.code, v_comuna);
  if v_ship.rate_id is null then
    perform private.raise_error('SHIPPING_NOT_AVAILABLE');
  end if;

  -- Facturación.
  if p_document_type = 'factura' then
    select * into v_billing from public.billing_profiles where id = p_billing_profile_id and user_id = v_uid;
    if not found then
      perform private.raise_error('BILLING_REQUIRED');
    end if;
    select jsonb_build_object('rut', v_billing.rut, 'business_name', v_billing.business_name,
             'giro', v_billing.giro, 'address_line', v_billing.address_line,
             'comuna_code', v_billing.comuna_code, 'comuna', c.name, 'dte_email', v_billing.dte_email)
      into v_billing_snapshot
      from public.comunas c where c.code = v_billing.comuna_code;
  end if;

  -- Totales calculados en el servidor.
  select coalesce(sum((x ->> 'unit_price_net')::bigint * (x ->> 'quantity')::int), 0)
    into v_subtotal from jsonb_array_elements(v_lines) x;
  v_shipping_net := case when v_ship.free_over_net is not null and v_subtotal >= v_ship.free_over_net
                         then 0 else v_ship.price_net end;
  v_totals := private.compute_order_totals(v_price_mode, v_rate, v_lines, v_shipping_net);
  if p_expected_total is not null and p_expected_total <> (v_totals ->> 'total')::bigint then
    perform private.raise_error('PRICE_CHANGED', format('Total actual: %s', v_totals ->> 'total'),
      jsonb_build_object('total', (v_totals ->> 'total')::bigint)::text);
  end if;

  v_expires := now() + make_interval(mins => private.setting_int('checkout.reservation_minutes', 30));
  v_order_number := private.next_order_number();

  insert into public.orders (
    id, order_number, user_id, placed_by, status, payment_status, document_type, price_mode, tax_rate,
    subtotal_net, discount_net, shipping_net, shipping_gross, taxable_net, exempt_net, tax_amount, total,
    shipping_method_code, shipping_snapshot, shipping_address_snapshot, pickup_warehouse_id, billing_snapshot,
    customer_snapshot, estimated_delivery_min, estimated_delivery_max, customer_notes, idempotency_key,
    source_channel, reservation_expires_at
  ) values (
    v_order_id, v_order_number, v_uid, v_uid, 'pending_payment', 'unpaid', p_document_type, v_price_mode, v_rate,
    (v_totals ->> 'subtotal_net')::bigint, (v_totals ->> 'discount_net')::bigint,
    (v_totals ->> 'shipping_net')::bigint, (v_totals ->> 'shipping_gross')::bigint,
    (v_totals ->> 'taxable_net')::bigint, (v_totals ->> 'exempt_net')::bigint,
    (v_totals ->> 'tax_amount')::bigint, (v_totals ->> 'total')::bigint,
    v_method.code,
    jsonb_build_object('method_code', v_method.code, 'method_name', v_method.name, 'rate_id', v_ship.rate_id,
      'price_net', v_shipping_net, 'est_days_min', v_ship.est_days_min, 'est_days_max', v_ship.est_days_max,
      'pickup_point', case when v_pickup.id is not null then jsonb_build_object(
        'name', v_pickup.name, 'address_line', v_pickup.address_line, 'comuna_code', v_pickup.comuna_code) end),
    v_address_snapshot, v_pickup.id, v_billing_snapshot,
    jsonb_build_object('full_name', v_profile.full_name, 'email', v_user.email, 'phone', v_profile.phone,
      'account_type', v_profile.account_type, 'rut', v_profile.rut),
    v_today + v_ship.est_days_min, v_today + v_ship.est_days_max,
    nullif(trim(p_customer_notes), ''), p_idempotency_key, p_source_channel, v_expires
  );

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_i := v_i + 1;
    v_line := v_totals -> 'lines' -> (v_i - 1);
    insert into public.order_items (
      order_id, line_no, item_type, product_id, variant_id, sku, manufacturer_ref, product_name, variant_label,
      quantity, tax_class, unit_price_net, unit_price_gross, discount_net, line_net, line_gross, line_total,
      price_list_id
    ) values (
      v_order_id, v_i, 'product', (v_item ->> 'product_id')::uuid, (v_item ->> 'variant_id')::uuid,
      v_item ->> 'sku', v_item ->> 'manufacturer_ref', v_item ->> 'product_name', v_item ->> 'variant_label',
      (v_line ->> 'quantity')::int, v_line ->> 'tax_class', (v_line ->> 'unit_price_net')::bigint,
      (v_line ->> 'unit_price_gross')::bigint, (v_line ->> 'discount_net')::bigint,
      (v_line ->> 'line_net')::bigint, (v_line ->> 'line_gross')::bigint, (v_line ->> 'line_total')::bigint,
      (v_item ->> 'price_list_id')::uuid
    );
  end loop;

  -- Reserva autoritativa (bloquea saldos); si no alcanza, todo se revierte.
  perform private.reserve_order_stock(v_order_id, v_expires);

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, reason)
  values (v_order_id, null, 'pending_payment', v_uid, 'Pedido creado');

  update public.carts set status = 'converted', converted_order_id = v_order_id where id = v_cart_id;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'status', 'pending_payment',
    'total', (v_totals ->> 'total')::bigint, 'reservation_expires_at', v_expires, 'created', true);
end
$$;

-- El cliente puede cancelar mientras el pedido está pendiente de pago y sin pago aprobado.
create function public.cancel_my_order(p_order_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'pending_payment'
     or exists (select 1 from public.payments where order_id = p_order_id and status in ('authorized', 'approved')) then
    perform private.raise_error('ORDER_NOT_CANCELLABLE');
  end if;
  perform private.release_order_reservations(p_order_id);
  update public.payments set status = 'cancelled', failure_reason = 'Pedido cancelado por el cliente'
   where order_id = p_order_id and status in ('created', 'pending');
  perform private.set_order_status(p_order_id, 'cancelled', 'Cancelado por el cliente');
end
$$;

-- Job programado: cancela pedidos con reserva vencida sin pago (solo service_role / pg_cron).
create function public.release_expired_reservations() returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count int := 0;
begin
  for v_order in
    select id from public.orders
     where status = 'pending_payment' and reservation_expires_at < now()
     order by reservation_expires_at
       for update skip locked
  loop
    perform private.release_order_reservations(v_order.id);
    update public.payments set status = 'expired', failure_reason = 'Reserva vencida'
     where order_id = v_order.id and status in ('created', 'pending');
    perform private.set_order_status(v_order.id, 'cancelled', 'Reserva vencida sin pago');
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- -----------------------------------------------------------------------------
-- Pagos: intento y resultado (solo service_role: Edge Functions con secretos)
-- -----------------------------------------------------------------------------
create function public.create_payment_attempt(p_order_id uuid, p_provider text, p_method text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_attempt int;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'pending_payment' or v_order.reservation_expires_at <= now() then
    perform private.raise_error('ORDER_NOT_PAYABLE', v_order.status);
  end if;
  select count(*) + 1 into v_attempt from public.payments where order_id = p_order_id;
  insert into public.payments (order_id, provider, method, status, amount, currency, buy_order)
  values (p_order_id, p_provider, p_method, 'created', v_order.total, v_order.currency,
          left(regexp_replace(v_order.order_number, '[^A-Za-z0-9]', '', 'g') || 'A' || v_attempt, 26))
  returning * into v_payment;
  return jsonb_build_object('payment_id', v_payment.id, 'buy_order', v_payment.buy_order,
    'amount', v_payment.amount, 'currency', v_payment.currency, 'order_number', v_order.order_number,
    'reservation_expires_at', v_order.reservation_expires_at);
end
$$;

-- Aplica el resultado CONFIRMADO servidor a servidor por el proveedor (PAG-03, PAG-04).
-- Idempotente por (proveedor, id de evento). Nunca se invoca desde la app.
create function public.apply_payment_result(
  p_payment_id uuid,
  p_new_status text,
  p_amount bigint,
  p_provider_event_id text,
  p_event_type text default 'status_update',
  p_payload jsonb default '{}'::jsonb,
  p_signature_valid boolean default null,
  p_provider_transaction_id text default null,
  p_authorization_code text default null,
  p_card_last4 text default null,
  p_installments int default null,
  p_response_code text default null,
  p_failure_reason text default null,
  p_method text default null
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_event_id bigint;
  v_result text;
  v_reopened boolean := false;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    perform private.raise_error('PAYMENT_NOT_FOUND');
  end if;

  insert into public.payment_events (provider, provider_event_id, payment_id, event_type, signature_valid, payload)
  values (v_payment.provider, p_provider_event_id, p_payment_id, p_event_type, p_signature_valid,
          coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return jsonb_build_object('applied', false, 'duplicate', true, 'payment_status', v_payment.status);
  end if;

  -- Orden de bloqueo: pedido y luego pago.
  select * into v_order from public.orders where id = v_payment.order_id for update;
  select * into v_payment from public.payments where id = p_payment_id for update;

  if v_payment.status = p_new_status then
    v_result := 'no_change';
  elsif not private.payment_transition_allowed(v_payment.status, p_new_status) then
    v_result := 'invalid_transition';
  elsif p_new_status = 'approved' and (p_amount is distinct from v_payment.amount) then
    -- Monto inconsistente: no se marca pagado; queda para revisión y reembolso.
    update public.payments set status = 'error', failure_reason = 'PAYMENT_AMOUNT_MISMATCH',
           provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id)
     where id = p_payment_id;
    insert into public.refunds (payment_id, order_id, amount, reason)
    values (p_payment_id, v_order.id, greatest(coalesce(p_amount, v_payment.amount), 1),
            'Monto aprobado distinto al del pedido: requiere revisión');
    v_result := 'amount_mismatch';
  else
    update public.payments
       set status = p_new_status,
           method = coalesce(p_method, method),
           provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
           authorization_code = coalesce(p_authorization_code, authorization_code),
           card_last4 = coalesce(p_card_last4, card_last4),
           installments = coalesce(p_installments, installments),
           response_code = coalesce(p_response_code, response_code),
           failure_reason = case when p_new_status in ('rejected', 'cancelled', 'expired', 'error')
                                 then coalesce(p_failure_reason, failure_reason) else failure_reason end,
           approved_at = case when p_new_status = 'approved' then now() else approved_at end
     where id = p_payment_id;
    v_result := 'applied';

    if p_new_status = 'approved' then
      if v_order.status = 'pending_payment' then
        perform private.commit_order_reservations(v_order.id);
        update public.orders set payment_status = 'paid' where id = v_order.id;
        perform private.set_order_status(v_order.id, 'paid', 'Pago aprobado por ' || v_payment.provider);
      elsif v_order.status = 'cancelled' and v_order.payment_status = 'unpaid' then
        -- Pago tardío. Solo se reabre un pedido cancelado por vencimiento de la reserva (no uno
        -- cancelado por el cliente o el personal) y si hay stock; en otro caso se genera reembolso.
        if v_order.cancel_reason = 'Reserva vencida sin pago' then
          begin
            perform private.reserve_order_stock(v_order.id, null);
            perform private.commit_order_reservations(v_order.id);
            v_reopened := true;
          exception when others then
            v_reopened := false;
          end;
        end if;
        update public.orders set payment_status = 'paid' where id = v_order.id;
        if v_reopened then
          perform private.set_order_status(v_order.id, 'paid', 'Pago tardío aprobado; stock reservado nuevamente', true);
          update public.orders set cancelled_at = null, cancel_reason = null where id = v_order.id;
          v_result := 'applied_late_reopened';
        else
          insert into public.refunds (payment_id, order_id, amount, reason)
          values (p_payment_id, v_order.id, v_payment.amount, 'Pago tardío sin stock disponible: reembolsar');
          v_result := 'applied_late_refund_required';
        end if;
      else
        -- El pedido ya estaba pagado por otro intento: pago duplicado.
        insert into public.refunds (payment_id, order_id, amount, reason)
        values (p_payment_id, v_order.id, v_payment.amount, 'Pago duplicado para un pedido ya pagado: reembolsar');
        v_result := 'applied_duplicate_refund_required';
      end if;
    elsif p_new_status in ('refunded', 'partially_refunded') then
      update public.orders set payment_status = p_new_status where id = v_order.id;
    end if;
  end if;

  update public.payment_events set processed_at = now(), result = v_result where id = v_event_id;
  return jsonb_build_object('applied', v_result like 'applied%', 'result', v_result,
                            'payment_status', (select status from public.payments where id = p_payment_id),
                            'order_status', (select status from public.orders where id = v_order.id));
end
$$;

-- -----------------------------------------------------------------------------
-- Operación interna (personal)
-- -----------------------------------------------------------------------------
create function public.update_order_status(p_order_id uuid, p_to_status text, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform private.require_permission('orders.update');
  if p_to_status in ('paid', 'shipped', 'ready_for_pickup') then
    -- 'paid' solo lo fija un pago confirmado; despacho y retiro pasan por fulfill_order().
    perform private.raise_error('INVALID_STATUS_TRANSITION', p_to_status);
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;

  if p_to_status = 'cancelled' then
    perform private.require_permission('orders.cancel');
    if nullif(trim(p_reason), '') is null then
      perform private.raise_error('REASON_REQUIRED');
    end if;
    perform private.set_order_status(p_order_id, 'cancelled', trim(p_reason));
    perform private.release_order_reservations(p_order_id);
    update public.payments set status = 'cancelled', failure_reason = 'Pedido cancelado'
     where order_id = p_order_id and status in ('created', 'pending');
    -- Si había pagos aprobados, se solicita el reembolso (se ejecuta con el proveedor en F6).
    insert into public.refunds (payment_id, order_id, amount, reason, requested_by)
    select p.id, p_order_id, p.amount - p.refunded_amount, 'Pedido cancelado: ' || trim(p_reason), auth.uid()
      from public.payments p
     where p.order_id = p_order_id and p.status in ('approved', 'partially_refunded')
       and p.amount > p.refunded_amount;
    return;
  end if;

  if p_to_status = 'delivered' then
    perform private.require_permission('shipments.update');
    update public.shipments set status = 'delivered', delivered_at = coalesce(delivered_at, now())
     where order_id = p_order_id and status not in ('delivered', 'cancelled', 'returned');
  end if;

  perform private.set_order_status(p_order_id, p_to_status, p_reason);
end
$$;

-- Despacho o retiro: consume el stock comprometido, asigna lotes (FEFO o los escaneados)
-- y registra el envío con el número de seguimiento REAL (si existe).
create function public.fulfill_order(
  p_order_id uuid,
  p_allocations jsonb default null,
  p_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_estimated_delivery_date date default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_requires_address boolean;
  v_res record;
  v_lot record;
  v_need int;
  v_take int;
  v_tracks_lots boolean;
  v_shipment_id uuid;
begin
  perform private.require_permission('shipments.update');
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'paid' then
    perform private.set_order_status(p_order_id, 'preparing', 'Preparación iniciada al despachar');
  elsif v_order.status <> 'preparing' then
    perform private.raise_error('INVALID_STATUS_TRANSITION', v_order.status || ' → despacho');
  end if;
  select requires_address into v_requires_address from public.shipping_methods where code = v_order.shipping_method_code;
  if v_requires_address and nullif(trim(p_carrier), '') is null then
    perform private.raise_error('INVALID_INPUT', 'Indique el transportista');
  end if;

  for v_res in
    select r.id, r.variant_id, r.warehouse_id, r.quantity
      from public.stock_reservations r
     where r.order_id = p_order_id and r.status = 'committed'
     order by r.variant_id, r.warehouse_id
       for update
  loop
    select p.tracks_lots into v_tracks_lots
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = v_res.variant_id;

    -- Primero se libera el compromiso; luego sale el stock físico.
    update public.stock_balances set committed = committed - v_res.quantity, updated_at = now()
     where variant_id = v_res.variant_id and warehouse_id = v_res.warehouse_id;

    if v_tracks_lots then
      v_need := v_res.quantity;
      for v_lot in
        -- Lotes indicados (escaneados) para esta variante, en el orden recibido; si no hay, FEFO.
        select l.id, lb.on_hand, a.ord, (a.item ->> 'quantity')::int as max_qty
          from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) with ordinality as a(item, ord)
          join public.inventory_lots l on l.id = (a.item ->> 'lot_id')::uuid
          join public.lot_balances lb on lb.lot_id = l.id and lb.warehouse_id = v_res.warehouse_id
         where (a.item ->> 'variant_id')::uuid = v_res.variant_id
           and l.variant_id = v_res.variant_id
           and lb.on_hand > 0
        union all
        select l.id, lb.on_hand, 1000000 + row_number() over (order by l.expiry_date nulls last, l.received_at, l.lot_number),
               null::int
          from public.lot_balances lb
          join public.inventory_lots l on l.id = lb.lot_id
         where l.variant_id = v_res.variant_id
           and lb.warehouse_id = v_res.warehouse_id
           and lb.on_hand > 0
           and private.lot_is_sellable(l.status, l.expiry_date)
           and not exists (
             select 1 from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) a2
              where (a2 ->> 'variant_id')::uuid = v_res.variant_id)
         order by 3
      loop
        exit when v_need = 0;
        v_take := least(v_need, v_lot.on_hand, coalesce(v_lot.max_qty, v_lot.on_hand));
        continue when v_take <= 0;
        perform private.apply_stock_movement(v_res.variant_id, v_res.warehouse_id, v_lot.id, -v_take,
                                             'sale_dispatch', null, 'order', p_order_id);
        insert into public.order_allocations (order_id, variant_id, lot_id, warehouse_id, quantity)
        values (p_order_id, v_res.variant_id, v_lot.id, v_res.warehouse_id, v_take);
        v_need := v_need - v_take;
      end loop;
      if v_need > 0 then
        perform private.raise_error('INSUFFICIENT_STOCK', 'Lotes insuficientes para despachar');
      end if;
    else
      perform private.apply_stock_movement(v_res.variant_id, v_res.warehouse_id, null, -v_res.quantity,
                                           'sale_dispatch', null, 'order', p_order_id);
      insert into public.order_allocations (order_id, variant_id, lot_id, warehouse_id, quantity)
      values (p_order_id, v_res.variant_id, null, v_res.warehouse_id, v_res.quantity);
    end if;

    update public.stock_reservations set status = 'consumed' where id = v_res.id;
  end loop;

  update public.orders set fulfillment_status = 'fulfilled' where id = p_order_id;

  if v_requires_address then
    insert into public.shipments (order_id, carrier, tracking_number, tracking_url, status,
                                  estimated_delivery_date, created_by)
    values (p_order_id, trim(p_carrier), nullif(trim(p_tracking_number), ''), nullif(trim(p_tracking_url), ''),
            'in_transit', p_estimated_delivery_date, auth.uid())
    returning id into v_shipment_id;
    insert into public.shipment_events (shipment_id, status, description, source, recorded_by)
    values (v_shipment_id, 'in_transit', 'Entregado al transportista', 'staff', auth.uid());
    perform private.set_order_status(p_order_id, 'shipped', 'Despachado');
  else
    perform private.set_order_status(p_order_id, 'ready_for_pickup', 'Listo para retiro');
  end if;

  return v_shipment_id;
end
$$;

create function public.add_shipment_event(
  p_shipment_id uuid, p_status text, p_description text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments;
begin
  perform private.require_permission('shipments.update');
  if p_status not in ('in_transit', 'out_for_delivery', 'delivered', 'incident', 'returned', 'cancelled') then
    perform private.raise_error('INVALID_INPUT', 'status');
  end if;
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'envío');
  end if;
  insert into public.shipment_events (shipment_id, status, description, source, recorded_by)
  values (p_shipment_id, p_status, p_description, 'staff', auth.uid());
  update public.shipments
     set status = p_status,
         delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
   where id = p_shipment_id;
  if p_status = 'delivered' and (select status from public.orders where id = v_shipment.order_id) = 'shipped' then
    perform private.set_order_status(v_shipment.order_id, 'delivered', 'Entrega confirmada');
  end if;
end
$$;

create function public.add_order_note(p_order_id uuid, p_body text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_permission('orders.update');
  if not exists (select 1 from public.orders where id = p_order_id) then
    perform private.raise_error('ORDER_NOT_FOUND');
  end if;
  insert into public.order_internal_notes (order_id, author_id, body)
  values (p_order_id, auth.uid(), trim(p_body))
  returning id into v_id;
  return v_id;
end
$$;

-- Trazabilidad: pedidos que recibieron un lote (alertas de calidad o retiros de mercado).
create function public.find_orders_by_lot(p_lot_id uuid)
returns table (order_id uuid, order_number text, customer jsonb, quantity int, dispatched_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_permission('orders.read');
  perform private.require_permission('inventory.read');
  return query
  select o.id, o.order_number,
         jsonb_build_object('full_name', o.customer_snapshot ->> 'full_name',
                            'email', o.customer_snapshot ->> 'email',
                            'phone', o.customer_snapshot ->> 'phone'),
         sum(a.quantity)::int, min(a.created_at)
    from public.order_allocations a
    join public.orders o on o.id = a.order_id
   where a.lot_id = p_lot_id
   group by o.id, o.order_number, o.customer_snapshot
   order by min(a.created_at);
end
$$;

-- -----------------------------------------------------------------------------
-- Eliminación de cuenta (CTA-12). Los pedidos se conservan (obligación tributaria),
-- desvinculados de la cuenta; el resto de los datos personales se elimina en cascada.
-- -----------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if exists (
    select 1 from public.orders
     where user_id = v_uid and status in ('pending_payment', 'paid', 'preparing', 'ready_for_pickup', 'shipped')
  ) then
    perform private.raise_error('ACCOUNT_HAS_OPEN_ORDERS');
  end if;
  perform private.audit_event('account.deleted', 'auth.users', v_uid::text);
  delete from auth.users where id = v_uid;
end
$$;

-- -----------------------------------------------------------------------------
-- Privilegios de ejecución: funciones de servicio fuera del alcance de la API pública
-- -----------------------------------------------------------------------------
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;
revoke execute on function public.create_payment_attempt(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.apply_payment_result(uuid, text, bigint, text, text, jsonb, boolean, text, text, text, int, text, text, text)
  from public, anon, authenticated;
grant execute on function public.release_expired_reservations() to service_role;
grant execute on function public.create_payment_attempt(uuid, text, text) to service_role;
grant execute on function public.apply_payment_result(uuid, text, bigint, text, text, jsonb, boolean, text, text, text, int, text, text, text)
  to service_role;

-- Las funciones de cliente no se exponen a usuarios anónimos.
revoke execute on function
  public.cart_set_item(uuid, int), public.cart_add_item(uuid, int), public.cart_clear(),
  public.get_cart_summary(text, text, uuid, uuid),
  public.place_order(text, text, text, uuid, uuid, uuid, text, bigint, text),
  public.cancel_my_order(uuid), public.delete_my_account(),
  public.update_order_status(uuid, text, text),
  public.fulfill_order(uuid, jsonb, text, text, text, date),
  public.add_shipment_event(uuid, text, text), public.add_order_note(uuid, text),
  public.find_orders_by_lot(uuid)
from public, anon;
