#!/bin/bash
set -e

# Get absolute script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to project root
cd "$SCRIPT_DIR/../../.."

# Run with npx tsx (will download on-demand if needed)
# Uses npx cache, lightweight and no local install required
npx -y tsx "$SCRIPT_DIR/llm-registry-sync.ts" "$@"

# Then dump a fresh JSON snapshot next to the DB.
exec npx -y tsx "$SCRIPT_DIR/llm-registry-sync.ts" --export-db "$SCRIPT_DIR/llm-registry.json"
