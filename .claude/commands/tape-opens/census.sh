#!/usr/bin/env bash
# /opens census - resolve the session transcript, measure its shape, compute the
# node budget, and extract a compact text spine for the writer subagent.
#
# Usage: census.sh [session-id] [override]
#   $1 - session id (a SKILL.md injects ${CLAUDE_SESSION_ID} here)
#   $2 - optional user override: a .jsonl path or another session id; wins over $1
#   Fallbacks when neither resolves: CLAUDE_CODE_SESSION_ID env, then the newest
#   transcript in this project's ~/.claude/projects dir.
#
# Prints KEY=VALUE lines. The BUDGET is the sizing law - computed here, never
# chosen by a model: nodes = round(1.5 * sqrt(live user prompts)), clamped [5, 30].
#
# The tape is an append-only FOREST: interrupts, re-sends, and rewinds leave
# branches off the active parentUuid chain. Both extremes are wrong: reading the
# whole tape leaks abandoned drafts as phantom opens; keeping only the live chain
# silently drops rewound-but-real history. So: live chains are computed (tail
# chain + the chain ending just before each new root, i.e. pre-compaction /
# pre-restart history), off-chain content is KEPT but marked "dead-branch",
# exact re-sends of live prompts are dropped, and the census counts live
# prompts only - sizing follows the thread's real descents.
set -euo pipefail

find_by_id() {
  find "$HOME/.claude/projects" -maxdepth 2 -name "$1.jsonl" -print -quit 2>/dev/null || true
}

SESSION=""
if [[ -n "${2:-}" ]]; then
  # explicit user override: must resolve, never fall back to another session
  if [[ -f "$2" ]]; then SESSION="$2"; else SESSION=$(find_by_id "$2"); fi
  if [[ -z "$SESSION" ]]; then
    echo "ERROR: override '$2' not found (expected a .jsonl path or a session id)" >&2
    exit 1
  fi
else
  for TARGET in "${1:-}" "${CLAUDE_CODE_SESSION_ID:-}"; do
    [[ -n "$TARGET" ]] || continue
    SESSION=$(find_by_id "$TARGET")
    [[ -n "$SESSION" ]] && break
  done
  if [[ -z "$SESSION" ]]; then
    PROJ="$HOME/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')"
    if [[ -d "$PROJ" ]]; then
      SESSION=$(ls -t "$PROJ"/*.jsonl 2>/dev/null | head -1 || true)
    fi
  fi
fi
if [[ -z "$SESSION" || ! -f "$SESSION" ]]; then
  echo "ERROR: could not resolve a session transcript (no session id given, no project dir match)" >&2
  exit 1
fi

# First output line is "#CENSUS <live-prompts> <first-ts> <last-ts>", rest is the spine.
RAW="$(mktemp -d "${TMPDIR:-/tmp}/opens.XXXXXX")"
jq -rs '
  def utext: if (.message.content|type)=="string" then .message.content
    else ([.message.content[]? | select(.type=="text") | .text] | join(" ")) end;
  [ .[] | select(.uuid? and .type? and (.isSidechain != true)) ] as $all
  | (INDEX($all[]; .uuid)) as $by
  | [ range($all | length) | select($all[.].type == "user" or $all[.].type == "assistant") ] as $msgIdxs
  | [ $msgIdxs[] | select($all[.].parentUuid == null) ] as $rootIdxs
  | ( ( [ ($msgIdxs | last) ]
        + [ $rootIdxs[] as $r | [ $msgIdxs[] | select(. < $r) ] | last | select(. != null) ]
        | unique | map($all[.].uuid) )
      + [ $all[] | select(.isCompactSummary == true) | .parentUuid | select(. != null) ]
      | unique
      | map( [ recurse($by[.].parentUuid; . != null and $by[.] != null) | select(. != null) ] )
      | add | unique
    ) as $live
  | ( [ $all[]
        | select(.type == "user" and .isMeta != true and (.uuid as $u | ($live | bsearch($u)) >= 0))
        | utext | gsub("\n"; " ") | {(.): 1}
      ] | add // {} ) as $liveU
  | [ $all[]
      | (.uuid as $u | (($live | bsearch($u)) < 0)) as $dead
      | if .type == "user" and .isCompactSummary == true then
          (if $dead then empty else {k:"C", ts:(.timestamp // "?"), t:(utext | gsub("\n"; " "))} end)
        elif .type == "user" and .isMeta != true then
          (utext | gsub("\n"; " ")) as $t
          | if ($t|length) == 0 then empty
            elif (.message.content|type) == "array" and ([.message.content[]? | select(.type=="tool_result")] | length) > 0 then empty
            elif $t | startswith("[Request interrupted") then (if $dead then empty else {k:"I"} end)
            elif $t | test("^\\s*(<task-notification>|\\[SYSTEM NOTIFICATION)") then
              (if $dead then empty else {k:"T", t:(($t | capture("<result>(?<r>.*?)</result>") | .r) // $t)} end)
            elif $t | test("^\\s*<(command-name|local-command|command-message)") then empty
            elif $t | test("^\\s*/[A-Za-z0-9_:-]+\\s*$") then empty
            elif $dead and ($liveU[$t] // false) then empty
            else {k:"U", d:$dead, ts:(.timestamp // "?"), t:$t}
            end
        elif .type == "assistant" then
          ([.message.content[]? | select(.type=="text") | .text] | join(" ") | gsub("\n"; " ")) as $t
          | if ($t|length) > 0 then {k:"A", d:$dead, t:$t} else empty end
        else empty end
    ] as $spine
  | ([ $spine[] | select(.k == "U" and .d != true) ] | length) as $n
  | ([ $spine[] | select(.k == "U" or .k == "C") | .ts ] | sort) as $spanTs
  | ( ["#CENSUS \($n) \($spanTs | first // "?") \($spanTs | last // "?")"]
    + [ $spine[]
        | if .k == "U" then "\n[USER\(if .d then " dead-branch" else "" end) \(.ts)] \(.t | .[0:800])"
          elif .k == "A" then "[AI\(if .d then " dead-branch" else "" end)] \(.t | .[0:400])"
          elif .k == "I" then "[INTERRUPTED]"
          elif .k == "T" then "[TASK-RESULT] \(.t | .[0:400])"
          elif .k == "C" then "\n[COMPACTED SUMMARY \(.ts[0:10])] \(.t | .[0:1500])"
          else empty end
      ] )
  | .[]
' "$SESSION" > "$RAW/full.txt"

read -r _tag U FIRST LAST < <(head -1 "$RAW/full.txt")
tail -n +2 "$RAW/full.txt" > "$RAW/spine.txt"
rm -f "$RAW/full.txt"

if [[ "${U:-0}" -lt 2 ]]; then
  echo "ERROR: only ${U:-0} live user prompts found - nothing to unwind" >&2
  exit 1
fi

BUDGET=$(awk -v u="$U" 'BEGIN { b = int(1.5 * sqrt(u) + 0.5); if (b < 5) b = 5; if (b > 30) b = 30; print b }')

echo "SESSION=$SESSION"
echo "USER_PROMPTS=$U"
echo "SPAN=${FIRST:0:10} -> ${LAST:0:10}"
echo "BUDGET=$BUDGET"
echo "SPINE=$RAW/spine.txt"
echo "SPINE_BYTES=$(wc -c < "$RAW/spine.txt" | tr -d ' ')"
