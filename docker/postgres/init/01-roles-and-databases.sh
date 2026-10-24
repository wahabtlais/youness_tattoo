#!/bin/bash
# Runs once, when the Postgres volume is first created.
#
#   younes_migrator  owns the schema - used only by migrations
#   younes_app       the API's runtime role: reads and writes data, can't
#                    change the schema (least privilege)
#
# The databases: YOUNES_DATABASES (space-separated), by default younes_dev
# (local work) and younes_test (automated tests, emptied by the tests
# themselves). A production server sets just one (docker/production/).
set -euo pipefail
DATABASES="${YOUNES_DATABASES:-younes_dev younes_test}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  CREATE ROLE younes_migrator LOGIN PASSWORD '${YOUNES_MIGRATOR_PASSWORD}';
  CREATE ROLE younes_app LOGIN PASSWORD '${YOUNES_APP_PASSWORD}';
EOSQL

for db in $DATABASES; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -c "CREATE DATABASE $db OWNER younes_migrator;"
done

for db in $DATABASES; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS btree_gist;
    REVOKE ALL ON DATABASE $db FROM PUBLIC;
    GRANT CONNECT ON DATABASE $db TO younes_migrator, younes_app;
    ALTER SCHEMA public OWNER TO younes_migrator;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO younes_app;
    -- every table the migrator creates is readable and writable by the app, and nothing more
    ALTER DEFAULT PRIVILEGES FOR ROLE younes_migrator IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO younes_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE younes_migrator IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO younes_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE younes_migrator IN SCHEMA public
      GRANT EXECUTE ON FUNCTIONS TO younes_app;
EOSQL
done
