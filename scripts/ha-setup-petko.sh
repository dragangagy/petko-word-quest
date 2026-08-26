#!/bin/sh
# Run inside Home Assistant: Sidebar -> Terminal (Terminal & SSH add-on)
set -eu

PG_PASS="${PG_PASS:-PetkoHA2026!}"
ALEX_REPO="https://github.com/alexbelgium/hassio-addons"
PETKO_REPO="https://github.com/dragangagy/petko-word-quest"

echo "== HA OS =="
ha os info || true

echo "== Add alexbelgium repo =="
ha addons repos add "$ALEX_REPO" 2>/dev/null || true
ha store reload
sleep 3

echo "== Find Postgres add-on slug =="
PG_SLUG="$(ha addons available 2>/dev/null | awk '/postgres/ {print $1; exit}')"
if [ -z "$PG_SLUG" ]; then
  echo "ERROR: Postgres add-on not found. Open Add-on Store and install Postgres 17 manually."
  exit 1
fi
echo "Postgres slug: $PG_SLUG"

echo "== Install/start Postgres =="
ha addons install "$PG_SLUG" 2>/dev/null || true
ha addons options "$PG_SLUG" --options-json "{\"POSTGRES_PASSWORD\":\"$PG_PASS\"}"
ha addons start "$PG_SLUG"
sleep 5
ha addons info "$PG_SLUG"

echo "== Add Petko repo (PostgREST add-on) =="
ha addons repos add "$PETKO_REPO" 2>/dev/null || true
ha store reload
sleep 3

PR_SLUG="$(ha addons available 2>/dev/null | awk '/petko_postgrest/ {print $1; exit}')"
if [ -n "$PR_SLUG" ]; then
  PG_HOST="$PG_SLUG"
  ha addons install "$PR_SLUG" 2>/dev/null || true
  ha addons options "$PR_SLUG" --options-json "{\"postgres_host\":\"$PG_HOST\",\"postgres_password\":\"$PG_PASS\",\"jwt_secret\":\"petko-local-jwt-secret-at-least-32-characters\"}"
  ha addons start "$PR_SLUG"
  ha addons info "$PR_SLUG"
else
  echo "WARN: petko_postgrest not in store yet. Push ha-addons/ to GitHub first."
fi

echo "DONE. Postgres password: $PG_PASS"
