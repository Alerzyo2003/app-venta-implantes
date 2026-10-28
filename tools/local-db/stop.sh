#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
if as_pg pg_ctl -D "$PGDATA_DIR" status >/dev/null 2>&1; then
  as_pg pg_ctl -D "$PGDATA_DIR" -w -m fast stop >/dev/null
  echo "PostgreSQL detenido."
else
  echo "PostgreSQL no estaba en ejecución."
fi
