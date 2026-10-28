#!/usr/bin/env bash
# Inicia (y si no existe, crea) el clúster local de PostgreSQL para pruebas.
source "$(dirname "$0")/env.sh"

mkdir -p "$LOCAL_DIR"
if [ "$(id -u)" = "0" ]; then chown postgres:postgres "$LOCAL_DIR"; fi

if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
  echo "Creando clúster en $PGDATA_DIR ..."
  as_pg initdb -D "$PGDATA_DIR" -U supabase_admin --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi

if as_pg pg_ctl -D "$PGDATA_DIR" status >/dev/null 2>&1; then
  echo "PostgreSQL ya está en ejecución (puerto $LOCAL_DB_PORT)."
else
  as_pg pg_ctl -D "$PGDATA_DIR" -l "$PGLOG_FILE" -w \
    -o "-p $LOCAL_DB_PORT -c listen_addresses=127.0.0.1 -k $LOCAL_DIR -c timezone=UTC -c max_connections=100" start >/dev/null
  echo "PostgreSQL iniciado en 127.0.0.1:$LOCAL_DB_PORT"
fi

# Roles a nivel de clúster (idempotente).
psql_admin -d postgres -f "$(dirname "$0")/bootstrap-cluster.sql"
