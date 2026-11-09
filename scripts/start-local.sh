#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${JUNIPER_POSTGRES_CONTAINER:-juniper-postgres}"
DATABASE_PORT="${JUNIPER_POSTGRES_PORT:-5433}"
API_PORT="${PORT:-3001}"
API_URL="http://localhost:${API_PORT}"
LOG_DIRECTORY="${PROJECT_ROOT}/.local"
API_LOG="${LOG_DIRECTORY}/api.log"
API_ERROR_LOG="${LOG_DIRECTORY}/api-error.log"

cd "$PROJECT_ROOT"
mkdir -p "$LOG_DIRECTORY"

command -v docker >/dev/null 2>&1 || { echo "Docker CLI was not found on PATH." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm was not found on PATH." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl was not found on PATH." >&2; exit 1; }

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  docker run --name "$CONTAINER_NAME" \
    -e POSTGRES_USER=juniper \
    -e POSTGRES_PASSWORD=juniper-local \
    -e POSTGRES_DB=juniper \
    -p "${DATABASE_PORT}:5432" \
    -d postgres:16
elif [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" != "true" ]]; then
  docker start "$CONTAINER_NAME" >/dev/null
fi

echo "Waiting for PostgreSQL on localhost:${DATABASE_PORT}..."
for _ in {1..60}; do
  if (echo >/dev/tcp/127.0.0.1/"$DATABASE_PORT") >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! (echo >/dev/tcp/127.0.0.1/"$DATABASE_PORT") >/dev/null 2>&1; then
  echo "Timed out waiting for PostgreSQL on port ${DATABASE_PORT}." >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://juniper:juniper-local@localhost:5433/juniper}"
export JWT_SECRET="${JWT_SECRET:-juniper-local-only-signing-secret-change-before-deployment}"
export APP_ORIGIN="${APP_ORIGIN:-http://localhost:8081}"
export APP_PUBLIC_URL="${APP_PUBLIC_URL:-http://localhost:8081}"
export NODE_ENV="${NODE_ENV:-development}"
export PORT="$API_PORT"

pnpm --filter @workspace/db migrate
rm -f "$API_LOG" "$API_ERROR_LOG"
pnpm --filter @workspace/api-server dev >"$API_LOG" 2>"$API_ERROR_LOG" &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

echo "Waiting for ${API_URL}/api/readyz..."
for _ in {1..60}; do
  if curl --fail --silent --show-error --max-time 5 "${API_URL}/api/readyz" >/dev/null; then
    echo "API is ready: ${API_URL}/api/readyz"
    echo "API process ID: ${API_PID}"
    echo "Logs: ${API_LOG} and ${API_ERROR_LOG}"
    trap - EXIT
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for ${API_URL}/api/readyz." >&2
cat "$API_ERROR_LOG" >&2 || true
exit 1
