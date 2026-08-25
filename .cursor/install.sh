#!/usr/bin/env bash
# Idempotent Cloud Agent install: rebuild static site + ensure cloudflared for live preview URLs.
set -euo pipefail

cd "$(dirname "$0")/.."

python3 build.py

mkdir -p "${HOME}/.local/bin"
CLOUDFLARED="${HOME}/.local/bin/cloudflared"
if [[ ! -x "${CLOUDFLARED}" ]]; then
  curl -fsSL \
    "https://github.com/cloudflare/cloudflared/releases/download/2026.8.2/cloudflared-linux-amd64" \
    -o "${CLOUDFLARED}"
  chmod +x "${CLOUDFLARED}"
fi
"${CLOUDFLARED}" --version
