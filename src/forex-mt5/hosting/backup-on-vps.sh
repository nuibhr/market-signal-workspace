#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
arguments=(--env-file /etc/nugaom-forex/pilot.env -f compose.yml)
# Match the receiver's running mode. An unavailable/unknown web mode fails closed.
if docker exec nugaom-forex-customer-web-1 node -e 'process.exit(process.env.FOREX_MT5_PREVIEW === "true" ? 0 : process.env.FOREX_MT5_ENABLED === "true" ? 1 : 2)'; then
  arguments+=(-f compose.preview.yml)
else
  status=$?
  if [[ "$status" != 1 ]]; then echo 'Cannot determine the current receiver backup mode.' >&2; exit 1; fi
fi
exec docker compose "${arguments[@]}" --profile maintenance run --rm --no-deps backup
