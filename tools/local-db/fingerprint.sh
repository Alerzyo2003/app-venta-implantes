#!/usr/bin/env bash
# Huella del esquema que generan las migraciones del repositorio (ver schema-fingerprint.sql).
# Crea una base temporal solo con la emulación de Supabase y las migraciones, calcula la huella
# y la elimina. El resultado debe coincidir fila por fila con el de un proyecto remoto.
#   fingerprint.sh                  todas las migraciones
#   fingerprint.sh 20261028000800   solo hasta esa versión (proyecto remoto aún incompleto)
source "$(dirname "$0")/env.sh"
HERE="$(cd "$(dirname "$0")" && pwd)"
DB="${LOCAL_DB_NAME}_fingerprint"
UNTIL="${1:-99999999999999}"
export PGOPTIONS="-c client_min_messages=warning"

bash "$HERE/start.sh" >/dev/null

psql_admin -d postgres -c "drop database if exists $DB with (force)"
psql_admin -d postgres -c "create database $DB owner postgres"
trap 'psql_admin -d postgres -c "drop database if exists $DB with (force)" >/dev/null' EXIT
psql_admin -d "$DB" -f "$HERE/bootstrap-db.sql" >/dev/null

for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  version="$(basename "$f" | cut -d_ -f1)"
  [ "$version" \> "$UNTIL" ] && continue
  psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$DB" -f "$f" >/dev/null
done

psql -X -q -A -F ' ' -P footer=off -v ON_ERROR_STOP=1 -U postgres -d "$DB" -f "$HERE/schema-fingerprint.sql" | sed 1,2d
