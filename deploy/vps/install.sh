#!/bin/sh
# Install a prebuilt portable release; no changes to other application services.
set -eu
[ "$(id -u)" = 0 ] || { echo 'Run as root.' >&2; exit 1; }
release=${1:?Usage: ./install.sh RELEASE_ID}
case "$release" in *[!a-zA-Z0-9._-]*|''|.|..) echo 'Invalid release ID.' >&2; exit 1;; esac
base=/opt/nugaom-scanner
config=/etc/nugaom-scanner/scanner.env
node=/usr/bin/node
[ -x "$node" ] || { echo 'Install Node.js 24 LTS or use the Docker option.' >&2; exit 1; }
"$node" -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || { echo 'Node.js 24+ required; use Docker if another app needs the older Node.' >&2; exit 1; }
[ -f "$config" ] || { echo 'Create /etc/nugaom-scanner/scanner.env from scanner.env.example (root, chmod 600).' >&2; exit 1; }
[ "$(stat -c %u "$config")" = 0 ] && [ "$(stat -c %a "$config")" = 600 ] || { echo 'scanner.env must be root-owned, chmod 600.' >&2; exit 1; }
id -u nugaom-scanner >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nugaom-scanner
install -d -m 755 "$base/releases/$release"
install -m 644 scanner.mjs "$base/releases/$release/scanner.mjs"
# The private environment is loaded by root only; no values are printed.
"$node" --env-file="$config" "$base/releases/$release/scanner.mjs" --check
systemctl stop nugaom-scanner.service 2>/dev/null || true
ln -sfn "$base/releases/$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
install -m 644 nugaom-scanner.service /etc/systemd/system/nugaom-scanner.service
systemctl daemon-reload
systemctl enable --now nugaom-scanner.service
systemctl is-active nugaom-scanner.service
echo 'Installed. Check completion: journalctl -u nugaom-scanner -n 40 --no-pager'
