#!/usr/bin/env bash
# Creates the database if it doesn't exist yet, then (re)loads schema + seed data.
# Safe to re-run — schema.sql uses CREATE TABLE IF NOT EXISTS, and re-seeding on an
# already-seeded db will just add a second copy of the sample data, so this script
# checks for an empty database before seeding.
set -e

DB_NAME="allensworth_academy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL first — see README.md for platform-specific steps."
  exit 1
fi

if psql -lqt | cut -d '|' -f1 | grep -qw "$DB_NAME"; then
  echo "Database '$DB_NAME' already exists."
else
  createdb "$DB_NAME"
  echo "Created database '$DB_NAME'."
fi

psql "$DB_NAME" -f "$SERVER_DIR/src/schema.sql" -q

ALREADY_SEEDED=$(psql "$DB_NAME" -tAc "SELECT count(*) FROM enrollments;" 2>/dev/null || echo "0")
if [ "$ALREADY_SEEDED" = "0" ]; then
  psql "$DB_NAME" -f "$SERVER_DIR/src/seed.sql" -q
  echo "Loaded seed data."
else
  echo "Enrollments already present ($ALREADY_SEEDED rows) — skipping seed to avoid duplicates."
  echo "To reseed from scratch: dropdb $DB_NAME && npm run setup:db"
fi

echo "Database ready: $DB_NAME"
