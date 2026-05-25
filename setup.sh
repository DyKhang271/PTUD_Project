#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local max_attempts="${3:-60}"

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name is ready: $url"
      return 0
    fi
    echo "Waiting for $name ($attempt/$max_attempts)..."
    sleep 5
  done

  echo "$name did not become ready: $url" >&2
  exit 1
}

require_command docker
require_command curl

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not available." >&2
  exit 1
fi

wait_for_http "Student Portal API" "http://localhost:8000/" 12

echo "Starting Timetable with Docker Compose..."
docker compose up -d --build

wait_for_http "Timetable API" "http://localhost:8001/"
wait_for_http "Timetable frontend" "http://localhost:5174/"

echo "Bootstrapping Timetable demo data..."
docker compose --profile bootstrap run --rm bootstrap-demo

cat <<'EOF'

Timetable is ready.

Frontend:           http://localhost:5174
API:                http://localhost:8001
Student Portal API: http://localhost:8000

Demo accounts come from Student Portal:
- Admin: admin / admin
- Teacher: gvungdung / gvungdung
- Teacher: gvaiml / gvaiml
- Student: 23630781 / 23630781
- Student: 23630761 / 23630761
EOF
