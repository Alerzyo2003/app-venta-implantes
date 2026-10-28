#!/usr/bin/env bash
# Variables comunes de la base de datos local de pruebas (sin Docker).
# Requiere PostgreSQL >= 15 instalado (initdb, pg_ctl, postgres, psql).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_DIR="${LOCAL_DB_DIR:-$REPO_ROOT/.local}"
PGDATA_DIR="$LOCAL_DIR/pgdata"
PGLOG_FILE="$LOCAL_DIR/postgres.log"
export LOCAL_DB_PORT="${LOCAL_DB_PORT:-54329}"
export LOCAL_DB_NAME="${LOCAL_DB_NAME:-implantes}"
export PGHOST=127.0.0.1
export PGPORT="$LOCAL_DB_PORT"

# Ubica los binarios del servidor (no siempre están en el PATH en Debian/Ubuntu).
if ! command -v pg_ctl >/dev/null 2>&1; then
  for dir in /usr/lib/postgresql/*/bin /usr/local/opt/postgresql*/bin /opt/homebrew/opt/postgresql*/bin; do
    if [ -x "$dir/pg_ctl" ]; then PATH="$dir:$PATH"; fi
  done
  export PATH
fi
command -v pg_ctl >/dev/null 2>&1 || { echo "No se encontró PostgreSQL (pg_ctl). Instálalo o usa 'supabase start' con Docker." >&2; exit 1; }

# PostgreSQL no se ejecuta como root: en contenedores se usa el usuario 'postgres'.
as_pg() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

psql_admin() { psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin "$@"; }
