#!/usr/bin/env bash
set -euo pipefail

# Cleans PartyKit durable SQLite files older than 7 days.
# Run from `apps/realtime` (this script is invoked by the package.json `dev` script).

DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$DIR/.partykit/state/party/-PartyKitDurable"

if [ -d "$TARGET" ]; then
  echo "Cleaning PartyKit durable files older than 7 days in $TARGET"
  # Print and remove files older than 7 days. Non-fatal if none found.
  find "$TARGET" -type f -name '*.sqlite' -mtime +7 -print -delete || true
else
  echo "No PartyKit durable directory found at $TARGET"
fi

exit 0
