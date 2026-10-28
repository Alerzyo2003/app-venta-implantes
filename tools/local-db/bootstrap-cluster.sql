-- Emulación mínima de los roles de Supabase a nivel de clúster (idempotente).
-- SOLO para pruebas locales. En Supabase estos roles ya existen.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  -- En Supabase, 'postgres' NO es superusuario: es dueño del esquema public y ejecuta migraciones.
  if not exists (select from pg_roles where rolname = 'postgres') then
    create role postgres login createrole createdb bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';
