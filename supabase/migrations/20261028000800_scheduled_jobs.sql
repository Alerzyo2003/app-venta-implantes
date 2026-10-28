-- =============================================================================
-- 0800 · Tareas programadas (pg_cron)
--   Se activan solo donde pg_cron está disponible (Supabase). En la base de pruebas
--   local sin pg_cron este bloque no hace nada; la función se prueba invocándola.
--   PENDIENTE DE VERIFICAR en un proyecto Supabase real (D-01).
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    -- Libera reservas vencidas cada minuto (CAR-06). cron.schedule actualiza el job si ya existe.
    execute $job$
      select cron.schedule('release-expired-reservations', '* * * * *',
                           'select public.release_expired_reservations()')
    $job$;
  else
    raise notice 'pg_cron no disponible: se omite la programación de tareas.';
  end if;
end
$$;
