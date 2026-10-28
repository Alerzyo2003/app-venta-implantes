-- =============================================================================
-- 0300 · Catálogo: referencias, productos, variantes, medios, documentos,
--        atributos, compatibilidades (con evidencia), alternativas y favoritos
-- =============================================================================

-- Visibilidad del catálogo según configuración ('public' | 'authenticated').
create function private.catalog_visible() returns boolean
language sql stable
set search_path = ''
as $$
  select case private.setting_text('catalog.visibility', 'public')
           when 'public' then true
           else auth.uid() is not null
         end
$$;
grant execute on function private.catalog_visible() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Referencias administrables
-- -----------------------------------------------------------------------------
create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  country text check (length(country) <= 60),
  website text check (website ~ '^https?://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index manufacturers_name_idx on public.manufacturers (lower(name));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  manufacturer_id uuid references public.manufacturers (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_name_idx on public.brands (lower(name));

create table public.implant_systems (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id),
  brand_id uuid references public.brands (id),
  name text not null check (length(name) between 1 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index implant_systems_name_idx on public.implant_systems (manufacturer_id, lower(name));

create table public.connection_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index connection_types_name_idx on public.connection_types (lower(name));

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  implant_system_id uuid not null references public.implant_systems (id),
  code text not null check (length(code) between 1 and 40),
  name text not null check (length(name) between 1 and 120),
  diameter_mm numeric(5, 2) check (diameter_mm > 0),
  connection_type_id uuid references public.connection_types (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index platforms_code_idx on public.platforms (implant_system_id, lower(code));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 80),
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categories_parent_idx on public.categories (parent_id);

-- Evita ciclos en el árbol de categorías.
create function private.categories_no_cycle() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select c.id, c.parent_id from public.categories c where c.id = new.parent_id
      union all
      select c.id, c.parent_id from public.categories c join up on c.id = up.parent_id
    )
    select 1 from up where up.id = new.id
  ) then
    perform private.raise_error('INVALID_INPUT', 'La categoría no puede ser descendiente de sí misma.');
  end if;
  return new;
end
$$;
create trigger categories_no_cycle before insert or update of parent_id on public.categories
  for each row execute function private.categories_no_cycle();

-- Categoría y todas sus descendientes.
create function private.category_descendants(p_category uuid) returns setof uuid
language sql stable
set search_path = ''
as $$
  with recursive tree as (
    select id from public.categories where id = p_category
    union all
    select c.id from public.categories c join tree t on c.parent_id = t.id
  )
  select id from tree
$$;
grant execute on function private.category_descendants(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Documentos técnicos (también sirven de evidencia de compatibilidad)
-- -----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in
    ('technical_sheet', 'ifu', 'certificate', 'manufacturer_catalog', 'compatibility_chart', 'other')),
  title text not null check (length(title) between 2 and 200),
  manufacturer_id uuid references public.manufacturers (id),
  storage_path text,
  external_url text check (external_url ~ '^https://'),
  version text check (length(version) <= 40),
  language text not null default 'es' check (language ~ '^[a-z]{2}$'),
  visibility text not null default 'customers' check (visibility in ('public', 'customers', 'internal')),
  issued_at date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(storage_path, external_url) >= 1)
);

-- -----------------------------------------------------------------------------
-- Productos y variantes
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  brand_id uuid references public.brands (id),
  manufacturer_id uuid references public.manufacturers (id),
  implant_system_id uuid references public.implant_systems (id),
  product_kind text not null check (product_kind in (
    'implant', 'abutment', 'healing_abutment', 'transfer', 'screw', 'analog', 'prosthetic',
    'biomaterial', 'instrument', 'surgical_kit', 'general_supply', 'other')),
  name text not null check (length(name) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text check (length(short_description) <= 300),
  description text check (length(description) <= 20000),
  usage_instructions text check (length(usage_instructions) <= 20000),
  storage_conditions text check (length(storage_conditions) <= 2000),
  tax_class text not null default 'iva' check (tax_class in ('iva', 'exempt')),
  tracks_lots boolean not null default false,
  tracks_expiry boolean not null default false,
  requires_professional boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  search_text text not null default '',
  search_vector tsvector,
  published_at timestamptz,
  discontinued_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not tracks_expiry or tracks_lots)
);
comment on column public.products.requires_professional is
  'Solo profesionales con verificación aprobada pueden comprarlo (CAT-10).';
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);
create index products_system_idx on public.products (implant_system_id);
create index products_status_idx on public.products (status, is_featured);
create index products_search_vector_idx on public.products using gin (search_vector);
create index products_search_text_trgm_idx on public.products using gin (search_text extensions.gin_trgm_ops);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null check (length(sku) between 2 and 64),
  manufacturer_ref text check (length(manufacturer_ref) <= 64),
  gtin text check (gtin is null or (gtin ~ '^\d{14}$' and private.is_valid_gtin(gtin))),
  label text check (length(label) <= 120),
  diameter_mm numeric(5, 2) check (diameter_mm > 0 and diameter_mm < 100),
  length_mm numeric(6, 2) check (length_mm > 0 and length_mm < 1000),
  platform_id uuid references public.platforms (id),
  connection_type_id uuid references public.connection_types (id),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  status text not null default 'active' check (status in ('active', 'inactive', 'discontinued')),
  sort_order int not null default 0,
  sku_norm text generated always as (private.normalize_code(sku)) stored,
  manufacturer_ref_norm text generated always as (private.normalize_code(manufacturer_ref)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.product_variants.gtin is 'GTIN-14 (los GTIN-8/12/13 se guardan rellenados con ceros).';
create unique index product_variants_sku_idx on public.product_variants (upper(sku));
create unique index product_variants_gtin_idx on public.product_variants (gtin) where gtin is not null;
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_sku_norm_idx on public.product_variants (sku_norm text_pattern_ops);
create index product_variants_mref_norm_idx on public.product_variants (manufacturer_ref_norm text_pattern_ops);
create index product_variants_dims_idx on public.product_variants (diameter_mm, length_mm);
create index product_variants_platform_idx on public.product_variants (platform_id);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  storage_path text not null,
  alt_text text check (length(alt_text) <= 200),
  width int check (width > 0),
  height int check (height > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_media_product_idx on public.product_media (product_id, sort_order);

create table public.product_documents (
  product_id uuid not null references public.products (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, document_id)
);

create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  data_type text not null check (data_type in ('number', 'text', 'boolean', 'enum')),
  unit text check (length(unit) <= 20),
  enum_values jsonb check (enum_values is null or jsonb_typeof(enum_values) = 'array'),
  applies_to_kinds text[] not null default '{}',
  is_filterable boolean not null default false,
  is_comparable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Texto de búsqueda (mantenido por triggers)
-- -----------------------------------------------------------------------------
create function private.products_search_before() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_brand text;
  v_manufacturer text;
  v_system text;
  v_category text;
  v_codes text;
begin
  select name into v_brand from public.brands where id = new.brand_id;
  select name into v_manufacturer from public.manufacturers where id = new.manufacturer_id;
  select name into v_system from public.implant_systems where id = new.implant_system_id;
  select name into v_category from public.categories where id = new.category_id;
  select string_agg(concat_ws(' ', pv.sku, pv.manufacturer_ref, pv.label, pl.code, pl.name, ct.name), ' ')
    into v_codes
    from public.product_variants pv
    left join public.platforms pl on pl.id = pv.platform_id
    left join public.connection_types ct on ct.id = pv.connection_type_id
   where pv.product_id = new.id and pv.status <> 'inactive';

  new.search_vector :=
       setweight(to_tsvector('public.es_unaccent', coalesce(new.name, '')), 'A')
    || setweight(to_tsvector('public.es_unaccent', concat_ws(' ', v_brand, v_manufacturer, v_system)), 'B')
    || setweight(to_tsvector('public.es_unaccent', concat_ws(' ', v_category, v_codes)), 'C')
    || setweight(to_tsvector('public.es_unaccent', coalesce(new.short_description, '')), 'D');
  new.search_text := lower(private.f_unaccent(concat_ws(' ', new.name, v_brand, v_manufacturer, v_system, v_category)));
  return new;
end
$$;
create trigger products_search_before before insert or update on public.products
  for each row execute function private.products_search_before();

-- Cambios en variantes o referencias recalculan el texto de los productos afectados.
create function private.touch_products_search() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'product_variants' then
    update public.products set search_text = search_text
     where id in (select (to_jsonb(new) ->> 'product_id')::uuid union select (to_jsonb(old) ->> 'product_id')::uuid);
  elsif tg_table_name = 'brands' then
    update public.products set search_text = search_text where brand_id = new.id;
  elsif tg_table_name = 'manufacturers' then
    update public.products set search_text = search_text where manufacturer_id = new.id;
  elsif tg_table_name = 'implant_systems' then
    update public.products set search_text = search_text where implant_system_id = new.id;
  elsif tg_table_name = 'categories' then
    update public.products set search_text = search_text where category_id = new.id;
  end if;
  return null;
end
$$;
create trigger product_variants_touch_search after insert or update or delete on public.product_variants
  for each row execute function private.touch_products_search();
create trigger brands_touch_search after update of name on public.brands
  for each row execute function private.touch_products_search();
create trigger manufacturers_touch_search after update of name on public.manufacturers
  for each row execute function private.touch_products_search();
create trigger implant_systems_touch_search after update of name on public.implant_systems
  for each row execute function private.touch_products_search();
create trigger categories_touch_search after update of name on public.categories
  for each row execute function private.touch_products_search();

-- Publicación: exige permiso 'catalog.publish', variante activa y fija published_at.
create function private.products_publication() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not (private.has_permission('catalog.publish') or private.is_trusted_session()) then
      perform private.raise_forbidden('PERMISSION_DENIED', 'catalog.publish');
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end
$$;
create trigger products_publication before insert or update on public.products
  for each row execute function private.products_publication();

-- updated_at para todas las tablas de catálogo.
create trigger manufacturers_updated_at before update on public.manufacturers for each row execute function private.set_updated_at();
create trigger brands_updated_at before update on public.brands for each row execute function private.set_updated_at();
create trigger implant_systems_updated_at before update on public.implant_systems for each row execute function private.set_updated_at();
create trigger connection_types_updated_at before update on public.connection_types for each row execute function private.set_updated_at();
create trigger platforms_updated_at before update on public.platforms for each row execute function private.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger documents_updated_at before update on public.documents for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function private.set_updated_at();

-- Auditoría (CAT-08: historial de modificaciones).
create trigger products_audit after insert or update or delete on public.products
  for each row execute function private.audit_row('id', 'created_by', 'updated_by');
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function private.audit_row('id', 'sku_norm', 'manufacturer_ref_norm');
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row();
create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Compatibilidades explícitas con evidencia (ADR-0005)
-- -----------------------------------------------------------------------------
create table public.compatibility_links (
  id uuid primary key default gen_random_uuid(),
  implant_scope text not null check (implant_scope in ('variant', 'product', 'platform')),
  implant_variant_id uuid references public.product_variants (id) on delete cascade,
  implant_product_id uuid references public.products (id) on delete cascade,
  platform_id uuid references public.platforms (id) on delete cascade,
  component_product_id uuid not null references public.products (id) on delete cascade,
  component_variant_id uuid references public.product_variants (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'retired')),
  evidence_type text check (evidence_type in
    ('manufacturer_catalog', 'manufacturer_ifu', 'manufacturer_statement', 'technical_validation', 'other')),
  evidence_document_id uuid references public.documents (id) on delete restrict,
  evidence_reference text check (length(evidence_reference) <= 500),
  verified_at timestamptz,
  verified_by uuid,
  notes text check (length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
       (implant_scope = 'variant' and implant_variant_id is not null and implant_product_id is null and platform_id is null)
    or (implant_scope = 'product' and implant_product_id is not null and implant_variant_id is null and platform_id is null)
    or (implant_scope = 'platform' and platform_id is not null and implant_variant_id is null and implant_product_id is null)
  ),
  -- Ninguna compatibilidad (o incompatibilidad) se declara verificada sin fuente, fecha y responsable.
  constraint compatibility_links_evidence_required check (
    status not in ('verified', 'rejected')
    or (evidence_type is not null
        and (evidence_document_id is not null or evidence_reference is not null)
        and verified_at is not null
        and verified_by is not null)
  )
);
create unique index compatibility_links_unique_idx on public.compatibility_links (
  implant_scope,
  coalesce(implant_variant_id, implant_product_id, platform_id),
  component_product_id,
  coalesce(component_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where status in ('pending', 'verified', 'rejected');
create index compatibility_links_variant_idx on public.compatibility_links (implant_variant_id) where implant_variant_id is not null;
create index compatibility_links_product_idx on public.compatibility_links (implant_product_id) where implant_product_id is not null;
create index compatibility_links_platform_idx on public.compatibility_links (platform_id) where platform_id is not null;
create index compatibility_links_component_idx on public.compatibility_links (component_product_id);

create function private.compatibility_links_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.component_variant_id is not null and not exists (
    select 1 from public.product_variants
     where id = new.component_variant_id and product_id = new.component_product_id
  ) then
    perform private.raise_error('INVALID_INPUT', 'La variante del componente no pertenece al producto.');
  end if;

  if new.status in ('verified', 'rejected')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if not (private.has_permission('compatibility.verify') or private.is_trusted_session()) then
      perform private.raise_forbidden('PERMISSION_DENIED', 'compatibility.verify');
    end if;
    if new.evidence_type is null or (new.evidence_document_id is null and new.evidence_reference is null) then
      perform private.raise_error('EVIDENCE_REQUIRED');
    end if;
    new.verified_by := coalesce(new.verified_by, auth.uid());
    new.verified_at := coalesce(new.verified_at, now());
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end
$$;
create trigger compatibility_links_guard before insert or update on public.compatibility_links
  for each row execute function private.compatibility_links_guard();
create trigger compatibility_links_updated_at before update on public.compatibility_links
  for each row execute function private.set_updated_at();
create trigger compatibility_links_audit after insert or update or delete on public.compatibility_links
  for each row execute function private.audit_row();

-- Alternativas comerciales aprobadas (NO implican compatibilidad técnica).
create table public.product_alternatives (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  alternative_product_id uuid not null references public.products (id) on delete cascade,
  status text not null default 'approved' check (status in ('approved', 'retired')),
  notes text check (length(notes) <= 500),
  approved_by uuid,
  approved_at timestamptz not null default now(),
  unique (product_id, alternative_product_id),
  check (product_id <> alternative_product_id)
);
create trigger product_alternatives_audit after insert or update or delete on public.product_alternatives
  for each row execute function private.audit_row();

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favorites_product_idx on public.favorites (product_id);

-- -----------------------------------------------------------------------------
-- RLS del catálogo
-- -----------------------------------------------------------------------------
alter table public.manufacturers enable row level security;
alter table public.brands enable row level security;
alter table public.implant_systems enable row level security;
alter table public.connection_types enable row level security;
alter table public.platforms enable row level security;
alter table public.categories enable row level security;
alter table public.documents enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.product_documents enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.compatibility_links enable row level security;
alter table public.product_alternatives enable row level security;
alter table public.favorites enable row level security;

-- Referencias: visibles si están activas (según visibilidad del catálogo) o para el personal.
do $$
declare
  t text;
begin
  foreach t in array array['manufacturers', 'brands', 'implant_systems', 'connection_types', 'platforms', 'categories'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to anon, authenticated
         using ((is_active and (select private.catalog_visible())) or (select private.has_permission(''catalog.read'')))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check ((select private.has_permission(''catalog.create'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using ((select private.has_permission(''catalog.update'')))
         with check ((select private.has_permission(''catalog.update'')))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated
         using ((select private.has_permission(''catalog.delete'')))', t);
  end loop;
end
$$;

create policy attribute_definitions_select on public.attribute_definitions for select to anon, authenticated
  using (true);
create policy attribute_definitions_write on public.attribute_definitions for all to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));

create policy documents_select on public.documents for select to anon, authenticated
  using (
    (visibility = 'public' and (select private.catalog_visible()))
    or (visibility = 'customers' and (select auth.uid()) is not null)
    or (select private.has_permission('catalog.read'))
  );
create policy documents_insert on public.documents for insert to authenticated
  with check ((select private.has_permission('catalog.create')));
create policy documents_update on public.documents for update to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));
create policy documents_delete on public.documents for delete to authenticated
  using ((select private.has_permission('catalog.delete')));

create policy products_select on public.products for select to anon, authenticated
  using ((status = 'published' and (select private.catalog_visible()))
         or (select private.has_permission('catalog.read')));
create policy products_insert on public.products for insert to authenticated
  with check ((select private.has_permission('catalog.create')));
create policy products_update on public.products for update to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));
create policy products_delete on public.products for delete to authenticated
  using ((select private.has_permission('catalog.delete')));

-- Las subconsultas sobre products respetan su propia RLS.
create policy product_variants_select on public.product_variants for select to anon, authenticated
  using ((status <> 'inactive' and exists (select 1 from public.products p where p.id = product_id))
         or (select private.has_permission('catalog.read')));
create policy product_variants_insert on public.product_variants for insert to authenticated
  with check ((select private.has_permission('catalog.create')));
create policy product_variants_update on public.product_variants for update to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));
create policy product_variants_delete on public.product_variants for delete to authenticated
  using ((select private.has_permission('catalog.delete')));

create policy product_media_select on public.product_media for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy product_media_write on public.product_media for all to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));

create policy product_documents_select on public.product_documents for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id)
         and exists (select 1 from public.documents d where d.id = document_id));
create policy product_documents_write on public.product_documents for all to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));

-- Clientes: solo vínculos verificados (o incompatibilidades verificadas). Pendientes: solo personal.
create policy compatibility_links_select on public.compatibility_links for select to anon, authenticated
  using ((status in ('verified', 'rejected') and (select private.catalog_visible()))
         or (select private.has_permission('compatibility.read')));
create policy compatibility_links_insert on public.compatibility_links for insert to authenticated
  with check ((select private.has_permission('compatibility.manage')));
create policy compatibility_links_update on public.compatibility_links for update to authenticated
  using ((select private.has_permission('compatibility.manage')))
  with check ((select private.has_permission('compatibility.manage')));
-- Las verificadas no se borran: se retiran (status = 'retired') para conservar la trazabilidad.
create policy compatibility_links_delete on public.compatibility_links for delete to authenticated
  using (status = 'pending' and (select private.has_permission('compatibility.manage')));

create policy product_alternatives_select on public.product_alternatives for select to anon, authenticated
  using ((status = 'approved' and (select private.catalog_visible())) or (select private.has_permission('catalog.read')));
create policy product_alternatives_write on public.product_alternatives for all to authenticated
  using ((select private.has_permission('catalog.update')))
  with check ((select private.has_permission('catalog.update')));

create policy favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Consultas de compatibilidad (respetan RLS: security invoker)
-- -----------------------------------------------------------------------------
create function public.get_compatible_components(p_implant_variant_id uuid)
returns table (
  link_id uuid,
  status text,
  implant_scope text,
  component_product_id uuid,
  component_variant_id uuid,
  component_name text,
  component_slug text,
  component_kind text,
  brand_name text,
  evidence_type text,
  evidence_reference text,
  evidence_document_id uuid,
  verified_at timestamptz
)
language sql stable
set search_path = ''
as $$
  with v as (
    select pv.id, pv.product_id, pv.platform_id
      from public.product_variants pv
     where pv.id = p_implant_variant_id
  )
  select cl.id, cl.status, cl.implant_scope, cl.component_product_id, cl.component_variant_id,
         p.name, p.slug, p.product_kind, b.name, cl.evidence_type, cl.evidence_reference,
         cl.evidence_document_id, cl.verified_at
    from v
    join public.compatibility_links cl
      on cl.status = 'verified'
     and (   (cl.implant_scope = 'variant' and cl.implant_variant_id = v.id)
          or (cl.implant_scope = 'product' and cl.implant_product_id = v.product_id)
          or (cl.implant_scope = 'platform' and cl.platform_id = v.platform_id))
    join public.products p on p.id = cl.component_product_id
    left join public.brands b on b.id = p.brand_id
   order by p.product_kind, p.name
$$;

-- 'verified' | 'incompatible' | 'unverified'. Sin vínculo verificado no hay compatibilidad.
create function public.check_compatibility(p_implant_variant_id uuid, p_component_variant_id uuid)
returns text
language sql stable
set search_path = ''
as $$
  with v as (
    select id, product_id, platform_id from public.product_variants where id = p_implant_variant_id
  ), c as (
    select id, product_id from public.product_variants where id = p_component_variant_id
  ), m as (
    select cl.status
      from v, c, public.compatibility_links cl
     where cl.status in ('verified', 'rejected')
       and cl.component_product_id = c.product_id
       and (cl.component_variant_id is null or cl.component_variant_id = c.id)
       and (   (cl.implant_scope = 'variant' and cl.implant_variant_id = v.id)
            or (cl.implant_scope = 'product' and cl.implant_product_id = v.product_id)
            or (cl.implant_scope = 'platform' and cl.platform_id = v.platform_id))
  )
  select case
           when exists (select 1 from m where status = 'rejected') then 'incompatible'
           when exists (select 1 from m where status = 'verified') then 'verified'
           else 'unverified'
         end
$$;
