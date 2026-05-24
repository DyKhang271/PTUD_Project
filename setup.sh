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

wait_for_bootstrap() {
  local max_attempts="${1:-60}"

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if ! docker inspect bootstrap-demo >/dev/null 2>&1; then
      echo "Waiting for bootstrap-demo container ($attempt/$max_attempts)..."
      sleep 5
      continue
    fi

    local state
    state="$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' bootstrap-demo)"

    case "$state" in
      "exited 0")
        echo "Demo data bootstrap completed."
        return 0
        ;;
      "exited "*)
        echo "bootstrap-demo failed with state: $state" >&2
        docker logs bootstrap-demo || true
        exit 1
        ;;
      *)
        echo "Waiting for bootstrap-demo to finish ($attempt/$max_attempts)..."
        sleep 5
        ;;
    esac
  done

  echo "bootstrap-demo did not finish in time." >&2
  docker logs bootstrap-demo || true
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

echo "Starting full system with Docker Compose..."
docker compose up -d --build

wait_for_http "Student Portal API" "http://localhost:8000/"
wait_for_http "Student Portal frontend" "http://localhost:8080/"
wait_for_http "Timetable API" "http://localhost:8001/"
wait_for_http "Timetable frontend" "http://localhost:5174/"
wait_for_bootstrap

cat <<'EOF'

System is ready.

Student Portal frontend: http://localhost:8080
Student Portal API:      http://localhost:8000
Timetable frontend:      http://localhost:5174
Timetable API:           http://localhost:8001

Demo accounts:
- Admin: admin / admin
- Teacher: gvungdung / gvungdung
- Teacher: gvaiml / gvaiml
- Student: 23630781 / 23630781
- Student: 23630761 / 23630761
EOF
