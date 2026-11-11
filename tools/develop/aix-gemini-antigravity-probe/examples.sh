#!/usr/bin/env bash
# Pre-cooked Antigravity probe scenarios. Each one exercises a different mix of sandbox tools so
# the parser-replay output shows whether the tree renders correctly across the full surface.
#
# Usage:
#   ./tools/develop/aix-gemini-antigravity-probe/examples.sh           # list examples
#   ./tools/develop/aix-gemini-antigravity-probe/examples.sh <name>    # run one
#   ./tools/develop/aix-gemini-antigravity-probe/examples.sh all       # run them all (sequentially)
#
# Requires GEMINI_API_KEY in env. Each example captures to its own fixture under ./captures/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROBE="$SCRIPT_DIR/probe.ts"
CAPTURES="$SCRIPT_DIR/captures"
mkdir -p "$CAPTURES"

run() {
  local name="$1"
  local prompt="$2"
  local out="$CAPTURES/${name}.jsonl"
  echo "=== example: $name ==="
  echo "prompt: $prompt"
  echo "output: $out"
  ( cd "$ROOT_DIR" && npx tsx "$PROBE" capture "$out" "$prompt" )
  echo "--- replay ---"
  ( cd "$ROOT_DIR" && npx tsx "$PROBE" replay "$out" )
  echo
}

# Each name -> human-readable description. The prompts deliberately request multiple tool families
# so we can see code_execution / google_search / function_call mixed in one run.
declare -A EXAMPLES=(
  [fs]="List the files in /tmp via tools (not bash). Then read one of them. Briefly report."
  [clone]="Try to clone https://github.com/octocat/Hello-World.git into /tmp/repo with bash. List the resulting files. If clone fails, report the network error verbatim."
  [build]="Create /tmp/hello.py with a short hello-world script, run it with python3, and report the stdout."
  [search]="Search the web for 'Claude Shannon information theory wikipedia', then summarize the top result in two sentences. Cite the URL."
  [fetch]="Fetch https://example.com with bash curl. Report the HTTP status and the <title>."
  [research]="Search the web for 'Enrico Ros big-AGI', pick one authoritative source, fetch it, and write a one-paragraph summary to /tmp/enrico-summary.md. Then read the file back and print it."
  [report]="Write a Python script in /tmp/plot.py that uses matplotlib to plot a simple sine wave and save to /tmp/sine.png. Run it. Report whether the file was created and its size."
  [mixed]="Do all of these in order: (1) run 'uname -a', (2) search the web for 'gvisor sandbox', (3) curl https://example.com, (4) write a one-line summary to /tmp/notes.txt. Briefly report each step."
)

ORDER=(fs clone build search fetch research report mixed)

if [[ "${1:-}" == "" ]]; then
  echo "available examples:"
  for k in "${ORDER[@]}"; do
    printf "  %-9s  %s\n" "$k" "${EXAMPLES[$k]}"
  done
  echo
  echo "usage: $0 <name>     run one"
  echo "       $0 all        run all (sequentially)"
  exit 0
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "error: GEMINI_API_KEY not set" >&2
  exit 1
fi

if [[ "$1" == "all" ]]; then
  for k in "${ORDER[@]}"; do run "$k" "${EXAMPLES[$k]}"; done
  exit 0
fi

if [[ -z "${EXAMPLES[$1]:-}" ]]; then
  echo "unknown example: $1" >&2
  echo "run '$0' (no args) to see the list" >&2
  exit 1
fi

run "$1" "${EXAMPLES[$1]}"
