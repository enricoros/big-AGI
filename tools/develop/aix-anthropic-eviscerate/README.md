# aix-anthropic-eviscerate

Live probes of Anthropic Messages API agentic behavior: what happens when hosted tools (web
search/fetch), client functions, programmatic tool calling (PTC), and tool search share one turn,
and what history must (or must not) be re-sent on the next. Direct `fetch()` streaming, no SDK,
no app layer.

Findings live in `kb/modules/AIX-anthropic-agentic-loop.md` (the loop/serialization playbook),
`kb/modules/AIX-stateless-roundtrip-retention.md` (retention + token costs), and
`kb/modules/AIX-anthropic-code-execution.md` (container behavior).

Reads `ANTHROPIC_API_KEY` from `process.env`, then the repo-root `.env.api-keys` / `.env.local` /
`.env`. Live captures land in `out/` (gitignored, contains real search content/encrypted blobs -
do not commit).

Run order (later scripts load `out/*.json` from earlier ones):

```bash
node run.mjs          # 7 behavioural scenarios (s1..s6a) -> out/*.json + raw SSE
node retention.mjs    # R1-R5b retention/400 matrix (needs run.mjs output)
node r3clean.mjs      # fresh-pause PTC resume requirements (standalone)
node tokacct.mjs      # token-accounting ablation matrix (needs run.mjs output)
node probes2.mjs      # serial PTC + constraint 400s (needs run.mjs output)
node toolsearch.mjs   # tool-search x PTC composition (standalone)
node bserial2.mjs     # serial-chain code capture (standalone)
node report.mjs       # regenerate report.html from out/*.json (no API calls)
node pcheck.mjs       # container-on-completed-turn probe (needs run.mjs output)
```

Containers idle out in ~5 min, so run retention.mjs / tokacct.mjs soon after run.mjs (an expired
container shows up as a container error, not a finding). Scenario outcomes vary run-to-run; the
structural findings are stable.
