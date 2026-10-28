#!/usr/bin/env bash
# Recrea la base de pruebas desde cero: emulación de Supabase + migraciones + semilla.
# Las migraciones se aplican con el rol 'postgres' (no superusuario), como en Supabase.
source "$(dirname "$0")/env.sh"
HERE="$(cd "$(dirname "$0")" && pwd)"
export PGOPTIONS="-c client_min_messages=warning"

bash "$HERE/start.sh" >/dev/null

psql_admin -d postgres -c "drop database if exists $LOCAL_DB_NAME with (force)"
psql_admin -d postgres -c "create database $LOCAL_DB_NAME owner postgres"
psql_admin -d "$LOCAL_DB_NAME" -f "$HERE/bootstrap-db.sql"

count=0
for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$LOCAL_DB_NAME" -f "$f" >/dev/null
  count=$((count + 1))
done

if [ -f "$REPO_ROOT/supabase/seed.sql" ]; then
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$LOCAL_DB_NAME" -f "$REPO_ROOT/supabase/seed.sql" >/dev/null
fi

echo "Base '$LOCAL_DB_NAME' recreada: $count migraciones aplicadas (127.0.0.1:$LOCAL_DB_PORT)."
