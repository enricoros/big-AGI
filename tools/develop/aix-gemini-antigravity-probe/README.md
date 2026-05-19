# aix-gemini-antigravity-probe

Captures live SSE from Google's Antigravity Agent (`antigravity-preview-05-2026`) and replays it
through our parser (`createGeminiInteractionsParserSSE`) so we can see exactly what the parser does
with each delta variant - no guessing from docs.

## Quick start

```bash
# requires GEMINI_API_KEY in env
export GEMINI_API_KEY=...

# one-shot: capture + replay
npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts run "list /tmp and read one file"

# capture only (keeps a fixture under ./captures/, not committed)
npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts capture ./captures/my-fixture.jsonl "list /tmp"

# replay a previously captured file (no API call)
npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts replay ./captures/my-fixture.jsonl

# pre-cooked example prompts (clone+inspect, web research -> file, etc.)
./tools/develop/aix-gemini-antigravity-probe/examples.sh             # lists examples
./tools/develop/aix-gemini-antigravity-probe/examples.sh clone       # runs the "clone & inspect" example
```

## Output

The replay prints:

- **content.delta type histogram** - every observed delta `type`, with counts. Useful to spot new
  variants (e.g. a new sandbox tool emitting an unfamiliar type).
- **parser warnings** - any `[GeminiInteractions] unknown content.delta shape ...` shows up here.
  Zero warnings means every observed delta is being handled.
- **particle histogram** - which `IParticleTransmitter` methods the parser called (text appends,
  operation-state placeholders, terminal status, etc.).
- **non-text particle log** - chronological dump of `sendOperationState`, `setUpstreamHandle`,
  `setTokenStopReason`, etc. - this is the "tree of actions" the UI would render.

## Why this exists

When the next surprise hits ("hey the agent emits some new delta type"), the workflow is:

1. `npx tsx ... run "<prompt that triggers it>"` to capture a real session.
2. Look at the histogram and warnings.
3. Edit `_emitAntigravityToolOp` in `src/modules/aix/server/dispatch/chatGenerate/parsers/gemini.interactions.parser.ts`.
4. `npx tsx ... replay <fixture>` to confirm the new variant is handled without re-hitting the API.

`captures/` is gitignored - move a fixture out of it if you want to commit it as a regression.
