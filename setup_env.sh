#!/usr/bin/env bash
# Creates an isolated environment for the Sweet Dreams app and installs all dependencies.
#
# Node.js has no "virtualenv" of its own, so we use a Python venv + nodeenv:
# Node and npm get installed *inside* .venv/, nothing is installed system-wide.
#
# Usage:   ./setup_env.sh            (first time)
#          source .venv/bin/activate (every new terminal, then: npx expo start)
set -euo pipefail
cd "$(dirname "$0")"

NODE_VERSION="${NODE_VERSION:-lts}"   # e.g. NODE_VERSION=22.12.0 ./setup_env.sh

echo "==> 1/4 Creating Python virtual env in .venv"
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  PYVER="$(python3 -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"
  echo "ERROR: Python's venv module is missing. On Ubuntu/Debian run:" >&2
  echo "    sudo apt install python${PYVER}-venv" >&2
  echo "and then run ./setup_env.sh again." >&2
  exit 1
fi
# remove a half-created venv left by an earlier failed run
if [[ -d .venv && ! -f .venv/bin/activate ]]; then
  echo "    removing incomplete .venv from a previous run"
  rm -rf .venv
fi
[[ -d .venv ]] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip nodeenv

echo "==> 2/4 Installing Node.js ($NODE_VERSION) inside .venv"
if ! command -v node >/dev/null 2>&1 || [[ "$(command -v node)" != "$PWD/.venv/"* ]]; then
  nodeenv --python-virtualenv --node="$NODE_VERSION"
fi
echo "    node $(node -v), npm $(npm -v)  ($(command -v node))"

echo "==> 3/4 Installing Expo SDK"
npm install expo@latest

echo "==> 4/4 Installing app libraries at versions matching the Expo SDK"
npx expo install react react-native expo-status-bar expo-audio react-native-svg
npx expo install --fix || true

echo
echo "Done. To run the app:"
echo "  source .venv/bin/activate"
echo "  npx expo start            # scan the QR code with Expo Go (same Wi-Fi)"
echo "  npx expo start --tunnel   # if phone and laptop are on different networks"
