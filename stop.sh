#!/usr/bin/env bash
# Stop all JobNester Docker services. Data volumes are preserved.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/start.sh" stop
