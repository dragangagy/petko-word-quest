#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

PG_HOST="$(bashio::config 'postgres_host')"
PG_PASS="$(bashio::config 'postgres_password')"
JWT_SECRET="$(bashio::config 'jwt_secret')"

export PGRST_DB_URI="postgresql://postgres:${PG_PASS}@${PG_HOST}:5432/postgres"
export PGRST_DB_SCHEMAS="public"
export PGRST_DB_ANON_ROLE="anon"
export PGRST_JWT_SECRET="${JWT_SECRET}"
export PGRST_SERVER_PORT="3000"
export PGRST_SERVER_HOST="0.0.0.0"

bashio::log.info "Starting PostgREST -> ${PG_HOST}:5432"
exec /usr/local/bin/postgrest
