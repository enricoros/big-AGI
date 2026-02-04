#!/bin/bash
set -e

# Change to project root
cd "$(dirname "$0")/../../.."

# Suppress noisy server-side fetcher error logging (sweep handles errors itself)
export SUPPRESS_FETCHER_LOGS=1

# Run with npx tsx (will download on-demand if needed)
# Uses npx cache, lightweight and no local install required
exec npx -y tsx tools/develop/llm-parameter-sweep/sweep.ts "$@"
