# AIX Protocol Lab

Protocol microscope for the AIX decode layer. Captures real provider streams through the
production pipeline, pairs every wire event with the transmitter calls and particles it
produced, replays captures offline, fetches the non-streaming oracle for stored-response
APIs, and runs differential checks. Generalizes the `aix-gemini-antigravity-probe` pattern
to all AIX chat-generation grammars.

## What runs is the real pipeline

No parallel implementation. Capture, replay and oracle all execute:

```
createChatGenerateDispatch          real adapters build the request; real parser + demuxer selected
  -> executeChatGenerateWithContinuation   continuation (pause_turn) + operation retry + executor
    -> ChatGenerateTransmitter      real particle serialization
```

The lab adds three taps (see `trace.ts`):

- raw body bytes, via a tee on the `Response` stream (pre-demux, base64 in the trace)
- demuxed wire events, via a wrapper on `dispatch.chatGenerateParse`
- the translation, via a recording `Proxy` on the `IParticleTransmitter` handed to the parser,
  plus the particles the executor yields

Attribution invariant: the executor drains the particle queue after each parse call, so
particles observed between parse(N) and parse(N+1) belong to event N. Transmitter calls are
attributed exactly via the per-event proxy. Parser `console.warn/log` diagnostics are captured
per event (they would otherwise evaporate with the terminal scrollback).

One logical generation may span multiple HTTP dispatches (Anthropic `pause_turn`, operation
retries): each becomes a trace `segment`, whose request body is serialized after continuation
mutations apply - so the echo-back content is visible per segment.

## Usage (from the repo root)

```bash
npx tsx tools/develop/aix-protocol-lab/lab.ts list
npx tsx tools/develop/aix-protocol-lab/lab.ts capture anthropic-messages kitchen-sink
npx tsx tools/develop/aix-protocol-lab/lab.ts capture openai-responses search --ns --oracle
npx tsx tools/develop/aix-protocol-lab/lab.ts replay  captures/<run>.json
npx tsx tools/develop/aix-protocol-lab/lab.ts report  captures/<run>.json
npx tsx tools/develop/aix-protocol-lab/lab.ts diff    <a>.json <b>.json [--exact]
npx tsx tools/develop/aix-protocol-lab/lab.ts matrix  kitchen-sink [--flavors a,b] [--ns]
npx tsx tools/develop/aix-protocol-lab/lab.ts hunt    openai-responses burst --runs 8 [--keep-all]
```

- `--ns` also captures a non-streaming twin (a SEPARATE generation: structural comparison only)
- `--oracle` enables upstream storage on the streaming run, then GETs the SAME generation
  non-streaming via the real resume dispatch (OpenAI Responses, Gemini Interactions): exact oracle
- `--model <id>` overrides the per-flavor default model (see `scenarios.ts`)
- `--echo` also prints captured console diagnostics live; `--timeout <s>` run timeout

Keys: `process.env`, then `.env.api-keys` / `.env.local` / `.env` at the repo root. The chosen
file name (never the value) is printed. Keys never enter trace files: request headers are not
recorded. Captures stay local (`captures/` is gitignored).

Every capture/replay writes `<name>.json` (the trace, the source of truth) and `<name>.html`
(the paired ledger: wire events left, decoded payloads expandable; calls/particles/diags right;
checks report on top). Replays of a capture are deterministic and diffed automatically.

## Flavors

| flavor | grammar | default model | notes |
|---|---|---|---|
| anthropic-messages | typed SSE, explicit block lifecycle | claude-sonnet-4-6 | `codeExec` unlocks via a PTC tool (`allowed_callers: ['code_execution']`) - there is no direct switch |
| openai-responses | typed events, sequence_number + addressed items | gpt-5.2 | `--oracle` supported; no hosted fetch tool |
| openai-chat | chunked deltas, `[DONE]` terminator | gpt-4.1-mini | degenerate grammar, no hosted tools |
| gemini-generate | chunked full objects, no event types | gemini-3-flash-preview | spans are parser-inferred |
| gemini-interactions | typed step events | antigravity-preview-05-2026 | agent-implicit tools; resumable |

Scenario capability switches (`reasoning`, `webSearch`, `webFetch`, `codeExec`) compile to each
flavor's real knobs in `scenarios.ts`; switches without a mapping are reported, not dropped
silently. `kitchen-sink` is the canonical gauntlet: reasoning + parallel search + code exec +
parallel fetch + final text + an in-response reasoning-continuity probe.

## Checks (`checks.ts`)

1. **Wire grammar** - per-protocol lifecycle invariants computed from the wire events alone,
   independent of the parser: Anthropic block open/delta/stop balance and index reuse; OpenAI
   Responses sequence_number contiguity, item lifecycle, and cross-item interleaving detection;
   light checks for the chunked grammars.
2. **Event coverage** - re-demuxes the captured raw bytes with the real demuxer and compares
   against what the pipeline parsed: surfaces executor-level drops (`[DONE]` is the benign one;
   post-termination arrivals are not).
3. **Translation loss** - wire-side content atoms (text/reasoning chars, tool inputs, tool
   result payloads, citations) vs their particle representation: full / partial / dropped per
   category, with known-deliberate losses annotated.
4. **Projection diff** - folds particle streams into logical parts; `--exact` for
   same-generation pairs (oracle, replay), structural for twins.

## The out-of-order verdict (triple-checked, 2026-06-13)

Across three independent OpenAI Responses captures (401, 291 and 13 events; up to 10 output
items including multiple reasoning items, web_search, code_interpreter, parallel function
calls), the deep analyzer (`oai-deep-*` checks) verifies four independent properties, all clean
every time:

1. `sequence_number` forms a strict +1 chain (no gaps, duplicates, regressions)
2. zero cross-item interleaving: every output item fully closes before the next opens - the
   id-addressed grammar PERMITS interleaving, but the server today emits strictly serial streams
3. every delta stream concatenates to exactly its `.done` canonical aggregate (text, function
   arguments, code, reasoning summaries)
4. the accumulated stream reproduces `response.completed.output` exactly (order, types, ids,
   contents) - the response's own built-in oracle

Conclusion: the previously observed "out of order events" were the parser's
`ResponseParserStateMachine` scoping `summary_index`/`content_index` globally instead of per
output item (fixed in `outputItemEnter`). The wire is, as of today, strictly ordered. The
`oai-deep-interleave` detector stays armed in every capture and hunt for the day that changes.

## S vs NS: legitimate divergences (what to ignore when comparing)

- **NS end reason** is `done-dispatch-closed` on every flavor (NS parsers do not signal a
  dialect end; the executor tolerates it because the token stop reason is explicit).
- **Same-generation oracle** (OpenAI Responses GET, Gemini Interactions GET): projection
  structure and contents match the stream exactly - proven on `search` and `burst`. Anything
  differing there is a real parser asymmetry.
- **Separate-generation NS twins**: tool choices, op counts and text content legitimately
  differ (model nondeterminism); the comparable layer is the part-kind alphabet and op kinds.
- **Known parser asymmetries found so far**: OpenAI code_interpreter emits a `code-exec`
  op-state only in streaming (NS emits cei/cer without it); Anthropic streaming used to crash
  on PTC pre-populated tool_use input where NS handled it (fixed).
- **Whitespace**: streaming injects `\n\n` spacers between tool blocks and text (both modes,
  slightly different placement); text char counts run a few chars above wire on Anthropic.
- **Vendor-generated ids** (tool call ids, item ids) differ across generations by definition.

## Findings already on record (captures of 2026-06-12)

Fourth session (`interleave` scenario: distinct parallel FC + dynamic filtering + circulation, 2026-06-23):

- `interleave` = 2 DISTINCT client tools (capybara, convert_temperature) called in parallel (3 calls)
  + server search/fetch, each vendor's richest concurrent config. All grammars clean.
- **Anthropic** (dynamic filtering, `vndAntWebDynamic`): model emitted 3 parallel client FCs AND wrote
  two `code_execution` blocks whose code calls `await web_search(...)`/`await web_fetch(...)` internally
  - the dynamic-filtering path. Turn paused at `ok-tool_invocations` for client tools, so the code-exec
  ops are legitimately left `open` (results arrive next turn). S/NS structure identical. Compiler now
  suppresses the standalone PTC code tool when `webDynamic` is on (Anthropic issue #1087: two code
  environments confuse the model).
- **OpenAI Responses**: client FC forces the turn boundary (`ok-tool_invocations`), hosted tools deferred
  - documented protocol difference. Deep sequencing clean on all 4 oracles; the same-generation oracle
  matched the stream exactly while the separate NS twin had an extra reasoning item (twin nondeterminism,
  not loss). A 6-run `hunt` stayed 100% clean (incl. a 104-event run) - still strictly serial.
- **Gemini** (tool circulation): the richest single turn - 2 server web searches (done) AND 3 parallel
  client FCs together in one turn; all loss categories full (sigs 5/5, FC 100=100, citation 1/1).
- **Lab self-bug fixed**: the wire-side loss counter seeded each Anthropic `tool_use` with
  `JSON.stringify({})` = 2 chars, over-reporting wire args by 2/tool and falsely flagging full
  function-call streams as "partial". Now matches the parser's empty-`{}`-to-'' zap (`_antInputChars`).

Third session (burst + deep sequencing + PTC streaming fix, 2026-06-13):

- **Anthropic streaming parser bug found by `burst` and fixed**: a client `tool_use` invoked
  programmatically from code execution (PTC, `caller: code_execution_20260120`) arrives at
  `content_block_start` with COMPLETE pre-populated input - the parser only handled the
  `{}`-then-deltas pattern and threw `unexpected argument format`, killing the whole generation
  (second parallel call lost, ops left open, no stop reason). NS handled the same structure fine.
  Fixed by normalizing non-empty input objects to their JSON string; replaying the crashed
  capture's raw bytes through the fixed parser recovers the full message (both calls, 67 arg chars).
- `burst` cross-protocol reactions: OpenAI Responses ends the turn at parallel client FC
  (`ok-tool_invocations`, hosted tools deferred); Gemini generateContent does EVERYTHING in one
  turn (parallel FC + code exec + 2 searches + citation, all loss categories full); OpenAI CC
  does parallel FC only; Antigravity ignores client tools and runs 30 autonomous steps with 11
  nested server ops.
- Deep sequencing analyzer added (see verdict section above).

Second session (hunt mode + Gemini + PFC):

- **OpenAI Responses parser bug found by `hunt` and fixed**: `ResponseParserStateMachine` scoped
  `summary_index`/`content_index` globally, but the protocol scopes them per output item - a
  second reasoning item (reasoning -> tools -> reasoning) triggered spurious
  "summary index mismatch" warnings (1 in 6 kitchen-sink runs; the wire was legal: sequence
  contiguous, lifecycle clean). Fixed by resetting per-item indices in `outputItemEnter`;
  verified by replaying the captured anomaly (`hunt06`) - zero warnings, identical projection.
  These warnings are (at least one class of) the "out of order events" previously observed.
- **PFC call graph on film** (`pfc` scenario, dynamic web tools): 7 code_execution invocations;
  one contains a nested web_fetch + 2 web_searches WITH their nested results
  (`caller: code_execution_20260120`); exactly that execution's stdout returns as
  `encrypted_code_execution_result` (6 others plaintext). All intermediates are on the wire;
  AIX flattens them to op-texts (61,016 payload chars in this run).
- Gemini generateContent validated: all loss categories full, including 5/5 thoughtSignatures
  (via `svs` particles) and urlContext citations.
- Gemini Interactions (Antigravity) validated live + replay-deterministic; the upstream handle
  is deliberately suppressed for Antigravity (non-resumable upstream: GET 404s after disconnect),
  so the oracle applies to deep-research agents only.

First captures:

- Anthropic kitchen-sink: grammar clean over 155 events; **43,785 chars of server-tool result
  payloads reduce to op-state texts** (no structured fragments) - the quantified pre-ATOL loss;
  2 of 9 wire citations not forwarded (bulk-result noise policy).
- OpenAI Responses kitchen-sink: 291 events, sequence numbers contiguous, no interleaving
  observed in this run; code interpreter IS structured (cei/cer round-trip).
- **S/NS parser asymmetry caught by the twin diff**: the streaming Responses parser emits a
  `code-exec` op-state for code_interpreter_call; the NS parser emits cei/cer but no op-state.
- NS paths (including the oracle) terminate as `done-dispatch-closed` (no dialect end signal):
  consistent across NS parsers, tolerated by the executor due to the explicit stop reason.
- Replay is deterministic: capture vs replay projections match exactly (validated on the
  155-event Anthropic gauntlet).

## Known gaps

- `[DONE]` (OpenAI CC) and post-termination wire events are consumed by the executor before the
  parse tap, so they appear in raw chunks and coverage findings, not as ledger events.
- Gemini flavors are implemented but not yet validated live (no GEMINI_API_KEY available at
  build time); gemini-interactions grammar checks are histogram-only on purpose (still moving).
- Bedrock (AWS eventstream body transform) is out of scope for now.
- Trace files store full payloads; image-heavy runs will be large (no clamping on particles).
- Chrome Trace / Perfetto exporter: planned follow-up (the trace already carries all timestamps).
