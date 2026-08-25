#!/usr/bin/env bash
# Per-boot live preview: serve the site and publish a public trycloudflare.com URL.
# Cursor also auto-forwards :8080 to localhost when Auto-Forward Ports is on.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared missing; run install first" >&2
  exit 1
fi

# Stop a stale server from a previous start attempt in this VM.
if [[ -f /tmp/http-server.pid ]]; then
  kill "$(cat /tmp/http-server.pid)" 2>/dev/null || true
  rm -f /tmp/http-server.pid
fi

python3 -m http.server 8080 --bind 0.0.0.0 >/tmp/http-server.log 2>&1 &
echo $! >/tmp/http-server.pid

for _ in $(seq 1 50); do
  if curl -sf -o /dev/null "http://127.0.0.1:8080/"; then
    break
  fi
  sleep 0.1
done

if ! curl -sf -o /dev/null "http://127.0.0.1:8080/"; then
  echo "http.server failed to become ready on :8080" >&2
  tail -n 50 /tmp/http-server.log >&2 || true
  exit 1
fi

echo "Local preview: http://127.0.0.1:8080/"
rm -f /tmp/preview-url.txt

# cloudflared stays in the foreground so Cloud Agent start keeps the tunnel alive.
# It prints a https://*.trycloudflare.com URL; we also write it to /tmp/preview-url.txt.
stdbuf -oL -eL cloudflared tunnel --url "http://127.0.0.1:8080" --no-autoupdate 2>&1 \
  | tee /tmp/cloudflared-preview.log \
  | while IFS= read -r line; do
      printf '%s\n' "${line}"
      if [[ "${line}" =~ https://[a-zA-Z0-9-]+\.trycloudflare\.com ]]; then
        url="$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' <<<"${line}" | head -1)"
        printf '%s\n' "${url}" >/tmp/preview-url.txt
        printf 'LIVE_PREVIEW_URL=%s\n' "${url}"
      fi
    done
