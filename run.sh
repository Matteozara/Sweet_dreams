#!/usr/bin/env bash
# Starts the Expo dev server from the project's virtual env.
# Pass extra flags through, e.g.  ./run.sh --tunnel   or   ./run.sh --clear
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
  echo "No .venv found – run ./setup_env.sh first." >&2
  exit 1
fi
# shellcheck disable=SC1091
source .venv/bin/activate
npx expo start "$@"
