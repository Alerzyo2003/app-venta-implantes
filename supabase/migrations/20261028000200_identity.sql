-- =============================================================================
-- 0200 · Identidad: territorio, documentos legales, perfiles, consentimientos,
--        verificación profesional, organizaciones, direcciones y facturación
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Territorio (códigos únicos territoriales, CUT)
-- -----------------------------------------------------------------------------
create table public.regions (
  code text primary key check (code ~ '^\d{2}$'),
  name text not null,
  short_name text not null,
  iso_code text not null unique,
  ordinal int not null unique
);

create table public.comunas (
  code text primary key check (code ~ '^\d{5}$'),
  name text not null,
  region_code text not null references public.regions (code),
  province_code text not null check (province_code ~ '^\d{3}$')
);
create index comunas_region_idx on public.comunas (region_code);

alter table public.regions enable row level security;
alter table public.comunas enable row level security;
create policy regions_select on public.regions for select to anon, authenticated using (true);
create policy comunas_select on public.comunas for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.regions, public.comunas from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Documentos legales versionados (el texto lo provee asesoría legal)
-- -----------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null check (length(version) between 1 and 20),
  title text not null,
  url text not null check (url ~ '^https?://'),
  published_at timestamptz,
  is_current boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (kind, version),
  check (not is_current or published_at is not null)
);
create unique index legal_documents_current_idx on public.legal_documents (kind) where is_current;

alter table public.legal_documents enable row level security;
create policy legal_documents_select on public.legal_documents for select to anon, authenticated
  using (published_at is not null or (select private.has_permission('settings.read')));
create policy legal_documents_write on public.legal_documents for all to authenticated
  using ((select private.has_permission('settings.update')))
  with check ((select private.has_permission('settings.update')));
create trigger legal_documents_audit after insert or update or delete on public.legal_documents
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Organizaciones (clínicas / organizaciones comerciales). Funciones completas en F4.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('clinic', 'commercial')),
  legal_name text not null check (length(legal_name) between 2 and 150),
  trade_name text check (length(trade_name) <= 150),
  rut text not null unique check (private.is_valid_rut(rut)),
  giro text check (length(giro) <= 120),
  phone text check (phone ~ '^\+56[2-9]\d{8}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.audit_row();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('clinic_admin', 'dentist', 'assistant', 'purchaser')),
  requires_approval boolean not null default false,
  status text not null default 'active' check (status in ('invited', 'active', 'removed')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_row('organization_id,user_id');

create function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
     where organization_id = p_org and user_id = auth.uid() and status = 'active'
  )
$$;

create function private.is_org_admin(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
     where organization_id = p_org and user_id = auth.uid() and status = 'active' and role = 'clinic_admin'
  )
$$;
grant execute on function private.is_org_member(uuid), private.is_org_admin(uuid) to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id) or (select private.has_permission('organizations.read')));
create policy organizations_write on public.organizations for all to authenticated
  using ((select private.has_permission('organizations.manage')))
  with check ((select private.has_permission('organizations.manage')));
create policy organization_members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_member(organization_id)
         or (select private.has_permission('organizations.read')));
create policy organization_members_write on public.organization_members for all to authenticated
  using ((select private.has_permission('organizations.manage')))
  with check ((select private.has_permission('organizations.manage')));

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  phone text check (phone ~ '^\+56[2-9]\d{8}$'),
  account_type text not null default 'general'
    check (account_type in ('general', 'dentist', 'implantologist', 'clinic', 'commercial')),
  professional_status text not null default 'not_requested'
    check (professional_status in ('not_requested', 'pending', 'verified', 'rejected')),
  rut text check (rut is null or private.is_valid_rut(rut)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.professional_status is
  'Solo lo modifica el personal mediante review_professional_verification().';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profiles_audit after update or delete on public.profiles
  for each row execute function private.audit_row();

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_permission('customers.read')));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- El usuario solo puede modificar sus datos personales; los estados los cambia el personal vía RPC.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (full_name, phone, account_type) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Consentimientos (historial solo inserción)
-- -----------------------------------------------------------------------------
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null
    check (consent_type in ('terms', 'privacy', 'marketing_email', 'marketing_push', 'marketing_whatsapp')),
  granted boolean not null,
  legal_document_id uuid references public.legal_documents (id),
  source text not null default 'app' check (source in ('signup', 'app', 'web', 'admin')),
  created_at timestamptz not null default now(),
  check (not (consent_type in ('terms', 'privacy') and granted) or legal_document_id is not null)
);
create index consents_user_idx on public.consents (user_id, consent_type, created_at desc);

alter table public.consents enable row level security;
create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('customers.read')));
-- Los consentimientos de marketing se registran directamente; términos y privacidad vía RPC.
create policy consents_insert on public.consents for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and consent_type like 'marketing\_%'
    and legal_document_id is null
    and source in ('app', 'web')
  );
revoke update, delete, truncate on public.consents from anon, authenticated;

-- Estado vigente: el último registro por tipo.
create view public.current_consents with (security_invoker = true) as
  select distinct on (user_id, consent_type)
         user_id, consent_type, granted, legal_document_id, source, created_at
    from public.consents
   order by user_id, consent_type, created_at desc, id desc;

-- ¿El usuario aceptó las versiones vigentes de términos y privacidad?
-- Si aún no hay documentos vigentes publicados, no se puede exigir aceptación.
create function private.has_accepted_current_legal(p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not exists (
    select 1
      from public.legal_documents d
     where d.is_current
       and not exists (
         select 1
           from public.consents c
          where c.user_id = p_user
            and c.consent_type = d.kind
            and c.legal_document_id = d.id
            and c.granted
       )
  )
$$;

create function public.accept_current_legal_documents(p_source text default 'app') returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if p_source not in ('app', 'web') then
    perform private.raise_error('INVALID_INPUT', 'source');
  end if;
  insert into public.consents (user_id, consent_type, granted, legal_document_id, source)
  select v_uid, d.kind, true, d.id, p_source
    from public.legal_documents d
   where d.is_current
     and not exists (
       select 1 from public.consents c
        where c.user_id = v_uid and c.legal_document_id = d.id and c.granted
     );
end
$$;

-- -----------------------------------------------------------------------------
-- Alta de usuario: perfil + consentimientos declarados al registrarse.
-- Los metadatos los envía el cliente: se validan y nunca otorgan roles ni verificación.
-- -----------------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type text := v_meta ->> 'account_type';
  v_phone text := v_meta ->> 'phone';
  v_channel text;
begin
  if v_type is null or v_type not in ('general', 'dentist', 'implantologist', 'clinic', 'commercial') then
    v_type := 'general';
  end if;
  if v_phone is not null and v_phone !~ '^\+56[2-9]\d{8}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, full_name, phone, account_type)
  values (new.id, left(coalesce(trim(v_meta ->> 'full_name'), ''), 120), v_phone, v_type);

  -- Términos y privacidad: solo si declaró aceptar la versión vigente publicada.
  insert into public.consents (user_id, consent_type, granted, legal_document_id, source)
  select new.id, d.kind, true, d.id, 'signup'
    from public.legal_documents d
   where d.is_current
     and ((d.kind = 'terms' and d.version = v_meta ->> 'accepted_terms_version')
       or (d.kind = 'privacy' and d.version = v_meta ->> 'accepted_privacy_version'));

  foreach v_channel in array array['marketing_email', 'marketing_push', 'marketing_whatsapp'] loop
    if jsonb_typeof(v_meta -> v_channel) = 'boolean' then
      insert into public.consents (user_id, consent_type, granted, source)
      values (new.id, v_channel, (v_meta ->> v_channel)::boolean, 'signup');
    end if;
  end loop;

  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Verificación profesional (CTA-07)
-- -----------------------------------------------------------------------------
create table public.professional_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  profession text not null check (profession in ('dentist', 'implantologist', 'dental_specialist', 'other')),
  rut text not null check (private.is_valid_rut(rut)),
  registry_number text not null check (length(registry_number) between 3 and 30),
  document_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text check (length(review_notes) <= 1000),
  check (status not in ('approved', 'rejected') or (reviewed_by is not null and reviewed_at is not null))
);
create unique index professional_verifications_one_pending on public.professional_verifications (user_id)
  where status = 'pending';
create trigger professional_verifications_audit after insert or update on public.professional_verifications
  for each row execute function private.audit_row();

alter table public.professional_verifications enable row level security;
create policy professional_verifications_select on public.professional_verifications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('verifications.review')));
revoke insert, update, delete, truncate on public.professional_verifications from anon, authenticated;

create function public.submit_professional_verification(
  p_profession text, p_rut text, p_registry_number text, p_document_paths text[] default '{}'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rut text := private.normalize_rut(p_rut);
  v_id uuid;
begin
  if v_uid is null then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if v_rut is null then
    perform private.raise_error('INVALID_RUT');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and professional_status = 'verified') then
    perform private.raise_error('ALREADY_VERIFIED');
  end if;
  -- Una nueva solicitud reemplaza la pendiente anterior.
  update public.professional_verifications set status = 'cancelled'
   where user_id = v_uid and status = 'pending';
  insert into public.professional_verifications (user_id, profession, rut, registry_number, document_paths)
  values (v_uid, p_profession, v_rut, trim(p_registry_number), coalesce(p_document_paths, '{}'))
  returning id into v_id;
  update public.profiles set professional_status = 'pending', rut = v_rut where id = v_uid;
  return v_id;
end
$$;

create function public.review_professional_verification(
  p_verification_id uuid, p_decision text, p_notes text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.professional_verifications;
begin
  perform private.require_permission('verifications.review');
  if p_decision not in ('approved', 'rejected') then
    perform private.raise_error('INVALID_INPUT', 'decision');
  end if;
  select * into v_row from public.professional_verifications where id = p_verification_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'verificación');
  end if;
  if v_row.status <> 'pending' then
    perform private.raise_error('INVALID_STATUS_TRANSITION', v_row.status);
  end if;
  update public.professional_verifications
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
   where id = p_verification_id;
  update public.profiles
     set professional_status = case p_decision when 'approved' then 'verified' else 'rejected' end
   where id = v_row.user_id;
end
$$;

-- -----------------------------------------------------------------------------
-- Direcciones de despacho
-- -----------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  label text check (length(label) <= 40),
  recipient_name text not null check (length(recipient_name) between 3 and 120),
  phone text not null check (phone ~ '^\+56[2-9]\d{8}$'),
  street text not null check (length(street) between 2 and 120),
  street_number text not null check (length(street_number) between 1 and 20),
  unit text check (length(unit) <= 40),
  comuna_code text not null references public.comunas (code),
  reference text check (length(reference) <= 200),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(user_id, organization_id) = 1)
);
create unique index addresses_default_user_idx on public.addresses (user_id)
  where is_default and archived_at is null and user_id is not null;
create index addresses_user_idx on public.addresses (user_id);
create index addresses_org_idx on public.addresses (organization_id);

create trigger addresses_updated_at before update on public.addresses
  for each row execute function private.set_updated_at();

-- Una sola dirección predeterminada por dueño.
create function private.addresses_single_default() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.is_default and new.archived_at is null then
    update public.addresses
       set is_default = false
     where id <> new.id
       and is_default
       and user_id is not distinct from new.user_id
       and organization_id is not distinct from new.organization_id;
  end if;
  return new;
end
$$;
create trigger addresses_single_default before insert or update of is_default, archived_at on public.addresses
  for each row execute function private.addresses_single_default();

alter table public.addresses enable row level security;
create policy addresses_select on public.addresses for select to authenticated
  using (user_id = (select auth.uid())
         or (organization_id is not null and private.is_org_member(organization_id))
         or (select private.has_permission('customers.read')));
create policy addresses_insert on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid())
              or (organization_id is not null and private.is_org_admin(organization_id)));
create policy addresses_update on public.addresses for update to authenticated
  using (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)))
  with check (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));
create policy addresses_delete on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));

-- -----------------------------------------------------------------------------
-- Datos de facturación
-- -----------------------------------------------------------------------------
create table public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  rut text not null check (private.is_valid_rut(rut)),
  business_name text not null check (length(business_name) between 2 and 150),
  giro text not null check (length(giro) between 2 and 120),
  address_line text not null check (length(address_line) between 3 and 200),
  comuna_code text not null references public.comunas (code),
  dte_email text not null check (dte_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(user_id, organization_id) = 1)
);
create index billing_profiles_user_idx on public.billing_profiles (user_id);
create trigger billing_profiles_updated_at before update on public.billing_profiles
  for each row execute function private.set_updated_at();

-- El RUT se guarda en forma canónica.
create function private.billing_profiles_normalize() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rut := coalesce(private.normalize_rut(new.rut), new.rut);
  new.dte_email := lower(trim(new.dte_email));
  return new;
end
$$;
create trigger billing_profiles_normalize before insert or update on public.billing_profiles
  for each row execute function private.billing_profiles_normalize();

alter table public.billing_profiles enable row level security;
create policy billing_profiles_select on public.billing_profiles for select to authenticated
  using (user_id = (select auth.uid())
         or (organization_id is not null and private.is_org_member(organization_id))
         or (select private.has_permission('customers.read')));
create policy billing_profiles_insert on public.billing_profiles for insert to authenticated
  with check (user_id = (select auth.uid())
              or (organization_id is not null and private.is_org_admin(organization_id)));
create policy billing_profiles_update on public.billing_profiles for update to authenticated
  using (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)))
  with check (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));
create policy billing_profiles_delete on public.billing_profiles for delete to authenticated
  using (user_id = (select auth.uid()) or (organization_id is not null and private.is_org_admin(organization_id)));
