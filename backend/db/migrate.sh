#!/usr/bin/env bash
#
# Applies migrations exactly once each, tracked in a schema_migrations ledger.
#
# Why a ledger: most migrations in this repo use bare CREATE TABLE / ADD COLUMN
# (no IF NOT EXISTS), and 016 does a DROP CONSTRAINT. Re-running them blindly
# fails. The ledger records what has been applied so a second run is a no-op.
#
# Runs in two places:
#   1. Inside the postgres container's /docker-entrypoint-initdb.d hook, which
#      fires once when the data volume is first created. PGHOST is unset there,
#      so psql uses the local unix socket.
#   2. On demand via the `migrate` compose service, after you add a new
#      migration:  docker compose run --rm migrate
#
# Against a local (non-Docker) postgres:
#   DB_DIR=backend/db PGHOST=localhost PGDATABASE=leetcode_review bash backend/db/migrate.sh

set -euo pipefail

DB_DIR="${DB_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
export PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-leetcode_review}}"

psql_run() { psql -v ON_ERROR_STOP=1 --quiet "$@"; }

echo "[migrate] database=${PGDATABASE} host=${PGHOST:-<local socket>} dir=${DB_DIR}"

psql_run -c "CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"

# Applies a file and records it, both in ONE transaction — so if the SQL fails,
# the ledger row is rolled back too and the migration can be retried.
apply_once() {
    local path="$1" name="$2"

    if [ -n "$(psql -tAX -c "SELECT 1 FROM schema_migrations WHERE filename = '${name}'")" ]; then
        echo "  skip   ${name}"
        return
    fi

    echo "  apply  ${name}"
    psql_run --single-transaction \
        -f "${path}" \
        -c "INSERT INTO schema_migrations (filename) VALUES ('${name}');"
}

for f in "${DB_DIR}"/migrations/*.sql; do
    apply_once "${f}" "$(basename "${f}")"
done

# seed.sql uses ON CONFLICT DO NOTHING and picks up new topics/patterns over
# time, so re-run it every time — that's how new reference rows land.
echo "  seed   seed.sql"
psql_run --single-transaction -f "${DB_DIR}/seed.sql"

# seed_flashcards.sql has no ON CONFLICT and flashcards has no unique key, so
# re-running it would duplicate every system card. Ledger it.
apply_once "${DB_DIR}/seed_flashcards.sql" "seed_flashcards.sql"

echo "[migrate] done"
