-- =============================================================================
-- 0100 · Base: extensiones, esquemas, utilidades, configuración, auditoría y permisos
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Esquema interno: funciones auxiliares no expuestas por la API (PostgREST solo expone public).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Búsqueda en español sin tildes
-- -----------------------------------------------------------------------------
create text search configuration public.es_unaccent (copy = pg_catalog.spanish);
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;

-- unaccent() no es IMMUTABLE; este envoltorio permite usarlo en columnas generadas e índices.
create function private.f_unaccent(text) returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Código normalizado para búsqueda: solo letras y dígitos en mayúsculas ("IMP-40.10" → "IMP4010").
create function private.normalize_code(p text) returns text
language sql immutable parallel safe
set search_path = ''
as $$ select upper(regexp_replace(private.f_unaccent(coalesce(p, '')), '[^A-Za-z0-9]', '', 'g')) $$;

-- Dígito verificador GS1 (GTIN). Recibe el código completo y valida su último dígito.
create function private.is_valid_gtin(p text) returns boolean
language plpgsql immutable parallel safe
set search_path = ''
as $$
declare
  s int := 0;
  i int;
  n int;
begin
  if p is null or p !~ '^(\d{8}|\d{12,14})$' then
    return false;
  end if;
  n := length(p) - 1;
  for i in 1..n loop
    s := s + substr(p, n - i + 1, 1)::int * (case when i % 2 = 1 then 3 else 1 end);
  end loop;
  return (10 - s % 10) % 10 = substr(p, length(p), 1)::int;
end
$$;

-- RUT chileno (módulo 11). Equivalente a packages/domain/src/rut.ts.
create function private.rut_dv(body text) returns text
language plpgsql immutable parallel safe
set search_path = ''
as $$
declare
  s int := 0;
  f int := 2;
  i int;
  d int;
begin
  if body !~ '^\d{1,9}$' then
    return null;
  end if;
  for i in reverse length(body)..1 loop
    s := s + substr(body, i, 1)::int * f;
    f := case when f = 7 then 2 else f + 1 end;
  end loop;
  d := 11 - (s % 11);
  return case d when 11 then '0' when 10 then 'K' else d::text end;
end
$$;

-- Forma canónica "12345678-5" o null si es inválido.
create function private.normalize_rut(p text) returns text
language plpgsql immutable parallel safe
set search_path = ''
as $$
declare
  c text;
  body text;
  dv text;
begin
  if p is null then
    return null;
  end if;
  c := upper(regexp_replace(p, '[.\-\s]', '', 'g'));
  if c !~ '^\d{1,12}[0-9K]$' then
    return null;
  end if;
  body := ltrim(left(c, length(c) - 1), '0');
  if body = '' then
    body := '0';
  end if;
  if length(body) > 8 then
    return null;
  end if;
  dv := right(c, 1);
  if private.rut_dv(body) is distinct from dv then
    return null;
  end if;
  return body || '-' || dv;
end
$$;

create function private.is_valid_rut(p text) returns boolean
language sql immutable parallel safe
set search_path = ''
as $$ select private.normalize_rut(p) is not null $$;

-- Errores de negocio con código estable (packages/domain/src/errors.ts los traduce).
create function private.raise_error(p_code text, p_detail text default null, p_hint text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code,
    detail = coalesce(p_detail, ''), hint = coalesce(p_hint, '');
end
$$;

-- Error de autorización (PostgREST responde 401/403).
create function private.raise_forbidden(p_code text default 'PERMISSION_DENIED', p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = p_code, detail = coalesce(p_detail, '');
end
$$;

-- -----------------------------------------------------------------------------
-- Configuración
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.app_settings is 'Configuración del negocio. is_public = legible sin sesión.';

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();

create function private.setting(p_key text) returns jsonb
language sql stable security definer
set search_path = ''
as $$ select value from public.app_settings where key = p_key $$;

create function private.setting_text(p_key text, p_default text) returns text
language sql stable
set search_path = ''
as $$ select coalesce(private.setting(p_key) #>> '{}', p_default) $$;

create function private.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable
set search_path = ''
as $$ select coalesce((private.setting(p_key) #>> '{}')::boolean, p_default) $$;

create function private.setting_int(p_key text, p_default int) returns int
language sql stable
set search_path = ''
as $$ select coalesce((private.setting(p_key) #>> '{}')::int, p_default) $$;

create function private.setting_numeric(p_key text, p_default numeric) returns numeric
language sql stable
set search_path = ''
as $$ select coalesce((private.setting(p_key) #>> '{}')::numeric, p_default) $$;

-- -----------------------------------------------------------------------------
-- Auditoría (solo inserción)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  action text not null,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  context jsonb
);
comment on table public.audit_log is 'Registro de auditoría inmutable (ROL-03). Sin columnas sensibles.';
create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- Registro manual de eventos de auditoría desde funciones.
create function private.audit_event(
  p_action text, p_table text, p_record_id text, p_old jsonb default null,
  p_new jsonb default null, p_context jsonb default null
) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, actor_role, action, table_name, record_id, old_data, new_data, context)
  values (auth.uid(), coalesce(auth.role(), current_user), p_action, p_table, p_record_id, p_old, p_new, p_context)
$$;

-- Trigger genérico. TG_ARGV[0] = columnas de la clave separadas por coma (por defecto "id");
-- TG_ARGV[1..] = columnas excluidas del registro (sensibles o derivadas).
-- En UPDATE solo guarda las columnas que cambiaron.
create function private.audit_row() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pk text[] := string_to_array(coalesce(tg_argv[0], 'id'), ',');
  v_excluded text[] := array['updated_at', 'search_vector', 'search_text'];
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_record_id text;
  i int;
begin
  if tg_nargs > 1 then
    for i in 1..tg_nargs - 1 loop
      v_excluded := v_excluded || tg_argv[i];
    end loop;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - v_excluded;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - v_excluded;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_old, v_new
      from jsonb_each(to_jsonb(new) - v_excluded) n
      join jsonb_each(to_jsonb(old) - v_excluded) o on o.key = n.key
     where n.value is distinct from o.value;
    if v_new is null then
      return new;
    end if;
  end if;

  v_row := coalesce(to_jsonb(new), to_jsonb(old));
  select string_agg(v_row ->> trim(k), ':') into v_record_id from unnest(v_pk) as k;

  insert into public.audit_log (actor_id, actor_role, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), coalesce(auth.role(), current_user), tg_op, tg_table_name, v_record_id, v_old, v_new);

  return coalesce(new, old);
end
$$;

-- -----------------------------------------------------------------------------
-- Roles y permisos del personal interno (ROL-01)
-- -----------------------------------------------------------------------------
create table public.permissions (
  code text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  module text not null,
  description text not null
);

create table public.roles (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_code text not null references public.roles (code) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade,
  primary key (role_code, permission_code)
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_code text not null references public.roles (code) on delete restrict,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index user_roles_role_idx on public.user_roles (role_code);

create function private.is_service_role() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(auth.role(), '') = 'service_role' $$;

-- Sesión directa a la base (migraciones, editor SQL, scripts administrativos con credenciales
-- de base de datos): no hay claims JWT y el rol no es de la API. PostgREST siempre fija claims.
create function private.is_trusted_session() returns boolean
language sql stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated', 'service_role')
     and coalesce(current_setting('request.jwt.claims', true), '') = ''
     and coalesce(current_setting('request.jwt.claim.sub', true), '') = ''
$$;

create function private.is_staff() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid()) $$;

-- Permiso efectivo del usuario actual. Exige MFA (aal2) al personal si así se configura.
create function private.has_permission(p_permission text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_service_role() or (
    exists (
      select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_code = ur.role_code
       where ur.user_id = auth.uid()
         and rp.permission_code = p_permission
    )
    and (
      not private.setting_bool('security.require_staff_mfa', true)
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    )
  )
$$;

create function private.require_permission(p_permission text) returns void
language plpgsql
set search_path = ''
as $$
begin
  if private.has_permission(p_permission) then
    return;
  end if;
  if auth.uid() is null and not private.is_service_role() then
    perform private.raise_forbidden('NOT_AUTHENTICATED');
  end if;
  if private.is_staff()
     and private.setting_bool('security.require_staff_mfa', true)
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    perform private.raise_forbidden('MFA_REQUIRED', p_permission);
  end if;
  perform private.raise_forbidden('PERMISSION_DENIED', p_permission);
end
$$;

grant execute on function
  private.f_unaccent(text),
  private.normalize_code(text),
  private.is_valid_gtin(text),
  private.rut_dv(text),
  private.normalize_rut(text),
  private.is_valid_rut(text),
  private.setting(text),
  private.setting_text(text, text),
  private.setting_bool(text, boolean),
  private.setting_int(text, int),
  private.setting_numeric(text, numeric),
  private.is_service_role(),
  private.is_trusted_session(),
  private.is_staff(),
  private.has_permission(text),
  private.raise_error(text, text, text),
  private.raise_forbidden(text, text),
  private.require_permission(text)
to anon, authenticated, service_role;

-- Accesos del usuario actual (para que las apps adapten la interfaz; el backend vuelve a validar).
create function public.get_my_access() returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_staff', private.is_staff(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'mfa_required', private.setting_bool('security.require_staff_mfa', true),
    'roles', coalesce((select jsonb_agg(role_code order by role_code) from public.user_roles where user_id = auth.uid()), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct rp.permission_code)
        from public.user_roles ur
        join public.role_permissions rp on rp.role_code = ur.role_code
       where ur.user_id = auth.uid()
    ), '[]'::jsonb)
  )
$$;

-- Asignación y retiro de roles (auditado).
create function public.assign_role(p_user_id uuid, p_role_code text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage_roles');
  if not exists (select 1 from public.roles where code = p_role_code) then
    perform private.raise_error('NOT_FOUND', 'rol');
  end if;
  insert into public.user_roles (user_id, role_code, granted_by)
  values (p_user_id, p_role_code, auth.uid())
  on conflict do nothing;
end
$$;

create function public.revoke_role(p_user_id uuid, p_role_code text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_permission('users.manage_roles');
  delete from public.user_roles where user_id = p_user_id and role_code = p_role_code;
end
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

create policy app_settings_select on public.app_settings for select to anon, authenticated
  using (is_public or (select private.has_permission('settings.read')));
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check ((select private.has_permission('settings.update')));
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select private.has_permission('settings.update')))
  with check ((select private.has_permission('settings.update')));

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.has_permission('audit.read')));

create policy permissions_select on public.permissions for select to authenticated
  using ((select private.is_staff()));
create policy roles_select on public.roles for select to authenticated
  using ((select private.is_staff()));
create policy role_permissions_select on public.role_permissions for select to authenticated
  using ((select private.is_staff()));
create policy role_permissions_write on public.role_permissions for all to authenticated
  using ((select private.has_permission('users.manage_roles')))
  with check ((select private.has_permission('users.manage_roles')));
create policy roles_write on public.roles for all to authenticated
  using ((select private.has_permission('users.manage_roles')))
  with check ((select private.has_permission('users.manage_roles')));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('users.read')));

-- La auditoría y los roles de usuario no se escriben directamente desde la API.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;
revoke truncate on public.app_settings, public.permissions, public.roles, public.role_permissions from anon, authenticated;

create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function private.audit_row('key');
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function private.audit_row('user_id,role_code');
create trigger role_permissions_audit after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row('role_code,permission_code');
