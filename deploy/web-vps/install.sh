#!/bin/sh
set -eu
release=${1:?Usage: install.sh RELEASE}
case "$release" in *[!a-zA-Z0-9._-]*|'') echo INVALID_RELEASE >&2; exit 1;; esac
release_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$release_root"
test -r /etc/nugaom-workspace/web.env
export WEB_RELEASE="$release"
docker image inspect "nugaom-workspace-web:$release" >/dev/null
docker compose -f deploy/web-vps/compose.yaml run --rm --no-deps app node deploy/web-vps/preflight.mjs
printf 'WEB_RELEASE=%s\n' "$release" > deploy/web-vps/.env
docker compose -f deploy/web-vps/compose.yaml up -d app
echo 'Web release started. Verify HTTPS, session continuity and market data before retiring the previous image.'
