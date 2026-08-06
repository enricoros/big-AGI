#!/usr/bin/env bash
# Re-sync all upstream snapshots in this directory.
# For each *.md file: fetch the URL declared in the `Source:` header line,
# preserve the header block (everything through the closing `-->`), bump the
# `Synced:` date, and rewrite the body in place. Add a new snapshot with the
# same header convention and it gets picked up automatically.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TODAY=$(date -u +%Y-%m-%d)
for f in "$DIR"/*.md; do
  url=$(grep -m1 '^  Source: ' "$f" | sed 's/^  Source: //' || true)
  if [ -z "${url:-}" ]; then
    echo "skip (no Source: header): $(basename "$f")"
    continue
  fi
  echo "→ $(basename "$f") ← $url"
  header=$(awk '{print} /^-->$/{exit}' "$f" | sed -E "s|^  Synced: .*|  Synced: $TODAY|")
  body=$(curl -sSL --max-time 30 "$url")
  printf '%s\n\n%s\n' "$header" "$body" > "$f"
done
echo "Done. Run \`git diff $DIR\` to see upstream changes."
