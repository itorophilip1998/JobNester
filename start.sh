#!/usr/bin/env bash
# JobNester — Docker-first start for every service.
# Usage:
#   ./start.sh              # build + start all services
#   ./start.sh stop         # stop containers (keep data)
#   ./start.sh restart      # rebuild and start
#   ./start.sh status       # container status
#   ./start.sh logs [svc]   # follow logs (web|api|ai|worker|db|redis)
#   ./start.sh setup        # ensure .env exists without starting

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ACTION="${1:-start}"
shift || true

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the Docker launcher (node scripts/services.mjs)."
  echo "Install Node.js 22+, then rerun ./start.sh"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop (macOS/Windows) or Docker Engine + Compose v2."
  exit 1
fi

exec node "$ROOT/scripts/services.mjs" "$ACTION" "$@"
