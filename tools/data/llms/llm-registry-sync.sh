#!/bin/bash
set -e

# Change to project root
cd "$(dirname "$0")/../../.."

# Run with npx tsx (will download on-demand if needed)
# Uses npx cache, lightweight and no local install required
npx -y tsx tools/data/llms/llm-registry-sync.ts "$@"

# Then dump a fresh JSON snapshot next to the DB.
exec npx -y tsx tools/data/llms/llm-registry-sync.ts --export-db tools/data/llms/llm-registry.json
