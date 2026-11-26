# AIX errors

## Purpose

Every failure of a chat generation is one record, `DAixIssue`, built once by the layer that sees it, sent in an `aix-issue` particle or built by the client, stored as a message part `{ pt: 'aix.issue', issue }`. Outcome, presentation, retry and replay derive from it; `effect` is the one stored decision. Code: `src/modules/aix/shared/aix.issues.ts` (record, codes, texts, builder, predicates; import-free), `aix.issues.policy.ts` (policy, presentation, replay text).

## Record

| Field | Holds |
|---|---|
| `code` | `<layer>-<what>`, table below |
| `effect` | `failed`: the generation failed here, at most one per message. `lost`: an output item was lost, the generation went on. `notice`: nothing of the response changed |
| `text` | one plain sentence, no markup or service name: ours (default the code's), or the vendor's message for `service-*` |
| `detail` | the failing side's words: vendor text (other fields as `name: value`), engine text, tRPC text |
| `causeCode` | the failing side's machine code (vendor code or type, finish reason, system error name, tRPC code) or ours (`no-end`, `abort-unexpected`, `continuation-limit`, media kind); code-shaped only, read with `code` |
| `httpStatus` | a status that was on the wire (`dispatch-http`, `relay-http`), never an in-band code |
| `retryAfterMs` | the service's wait: fetcher headers, OpenAI `error.headers`, Gemini `RetryInfo` |
| `offline` | `navigator.onLine` was false (browser records) |
| `runtime` | `client` or `relay`, where the executor ran (`dispatch-connect`, `dispatch-read`) |
| `atMs` | elapsed since the call started, stamped by the reassembler |

`attempts` is commented out: not built. `aixIssue(code, effect, facts?)` builds new records only: `text` and `detail` trimmed, bounded to 2,000 chars each, scrubbed of `AIza...`, `sk-` plus 16 or more chars, `key=`/`token=`-style values, `Bearer` tokens.

- `aixIssueFails`: `failed`. `aixIssueInMessageText`: `failed` or `lost`, an allow-list: a newer build's effect is never replayed. `aixIssuePlainText`: `text (detail)`, when the detail adds to the text
- Stability: a stored record is cloned verbatim; fields and codes are added, never reinterpreted; readers are total over unknown codes and effects. `aixIssueIsWellFormed` (string `code` and `text`, `detail` absent or a string) guards the load: a build deletes a record that breaks it

## Codes

22 codes. The effect is `failed` unless the last column says otherwise. A failure after the verdict, or after another failure, is stored `notice`; a notice shows as a chip.

| Code | Built by | Shown |
|---|---|---|
| `aix-prepare` | pre-loop catch: a throw before any fragment (LLM not found, request assembly) | block, Setup |
| `aix-load` | `_loadCsfModuleOrThrow` -> `AixIssueThrow` | block, App, DC off |
| `aix-media` | reassembler: a generated image, audio or video (`causeCode` the kind) | `lost`: warning block |
| `aix-unknown` | classifier: unclassified throw, abort without Stop (`abort-unexpected`), tRPC `INTERNAL_SERVER_ERROR`; reassembler: processing throw, no end (`no-end`); pre-loop catch once fragments exist (a notice after the end) | block, App |
| `relay-connect` | classifier: browser network `TypeError` inside `TRPCClientError` | block, Connection, DC on (online) |
| `relay-http` | classifier: `TRPCClientFetchError` `request-exceeded` (413) or `response-status` (other non-2xx without tRPC's envelope) | size card (413), else block, Server |
| `relay-html` | classifier: `TRPCClientFetchError` `response-captive` | block, Connection |
| `relay-rejected` | classifier: `TRPCClientError` with another tRPC code (`causeCode`) | block, Request |
| `relay-read` | classifier: bare browser network `TypeError` from the body | block, Connection |
| `relay-cutoff` | classifier: `isTRPCStreamClosedEarly` | cutoff card, DC on |
| `dispatch-prepare` | executor: dispatch creation threw | block, service |
| `dispatch-connect` | executor: `TRPCFetcherError` connection; `causeCode` the system code, never a bare class name | block, service, DC on (relay), off (client, online) |
| `dispatch-http` | executor: `TRPCFetcherError` http; `causeCode` `httpErrorCode ?? httpErrorType` | block, service |
| `dispatch-read` | executor read catches | block, service |
| `dispatch-cutoff` | end net; OpenAI Responses `onReadEnd` (a notice) | block, service |
| `dispatch-parse` | executor parse catches (detail: the error, `- input:`, a 200-char head); a parser's conversion failure | block, service |
| `dispatch-aborted` | end net | block, Connection |
| `dispatch-unknown` | continuation wrapper: last-resort catch, turn limit (`continuation-limit`) | block, App |
| `service-error` | parsers (a notice when the parser says so); end net | block, service |
| `service-tool` | OpenAI Responses: failed image generation | `lost`: warning block |
| `model-filter` | parsers, after the filter stop reason; end net | block, service |
| `model-unfinished` | end net | `notice` |

DC: the Direct Connection row. Not records: the user's Stop (outcome `aborted`), the stop reason, retry chips, input this build cannot place (a warn void notice).

## Flow

Layers: vendor parsers, executor (one `ChatGenerateTransmitter` per dispatch), operation retrier, continuation wrapper, the relay (the tRPC pipe; none under Direct Connection), the client (`aix.client.ts`, `aix.client.errors.ts`, `ContentReassembler.ts`). Particles below the relay, throws only across it. Architecture: [AIX.md](../AIX.md).

Parser API (`IParticleTransmitter.ts`):
- `addDialectIssue(issue)`: sent at once, the read goes on. Codes `service-error` (default), `model-filter`, `dispatch-parse` (`failed` or `notice`); `service-tool` (`lost`); `dispatch-cutoff` (`notice`, `onReadEnd` only). No `httpStatus`: an in-band numeric code is a string `causeCode`. It closes the open part: state it between items
- `setTokenStopReason` after the content; a filter stop is the reason, then `model-filter` if the parser has words. `setDialectEnded` stops the read; an issue that ends it is `addDialectIssue`, then `setDialectEnded('issue-dialect')`
- `parse.onReadEnd?(pt, closed)`: once after the read, before the end (`closed`: no dialect end); a throw is logged. Parsers throw only `OperationRetrySignal` and `DispatchContinuationSignal`; any other throw is a parse failure

Transmitter (`ChatGenerateTransmitter.ts`):
- An issue is queued where it arrives, never held, never ends the read. After the verdict (a clean or truncated stop reason, or a queued failure) a failure is stamped `notice`
- A failure sets stop reason `cg-issue` unless an error-class one is set; after it a non-error stop reason is ignored. The end goes once, last; later particles are dropped with a warning
- End nets (`_queueEndIssues`), at most one, none once an issue failed: (1) stop `filter-*` -> `model-filter`, the stop row's sentence; (2) `done-dispatch-closed`, no stop reason -> `dispatch-cutoff`; (3) `done-dispatch-aborted`, no stop reason -> `dispatch-aborted`; (4) stop `cg-issue`, or an `issue-*` end without one -> `service-error`; (5) `done-dialect`, no stop reason -> `model-unfinished`. A non-streaming body parsed in full with no stop reason ends `done-dialect`

Executor and wrappers:
- A failed stage queues its record and ends `issue-dispatch-rpc`; the request URL is logged in dev builds, never stored. An abort (`_isDispatchAbort`) ends `done-dispatch-aborted`, no record (net 3)
- `TRPCFetcherError.causeText`: the body text and, when likely the cause, the address; or the engine text, cause, host. `httpErrorType` (`error.type`, else `error.status`) is no retry input
- Retry chips: `srv-dispatch` (connect retrier), `srv-op` (operation retrier; parsers ask `hasRetriesForHttpStatus` first). The Gemini Interactions POST is `connectNoRetry`: a retry starts a second billable run
- Continuation wrapper (`_wrapperFailure`): a throw that is not a signal -> `dispatch-unknown` and the end, or only a log once an end went out; an abort rethrows; past `MAX_CONTINUATION_TURNS` (100), `continuation-limit`. Stats tap: `lastIssue`, the record that failed

Parsers, beyond the table: OpenAI Responses keeps an `error` after answer text for one event (`#pendingError`): an unsalvageable `response.failed` states one `service-error` merged with it (the event's words beat `unknown`); salvage, `completed`, `incomplete` drop it; if the read ends first, `onReadEnd` states it, then a `dispatch-cutoff` notice if the body closed. A Gemini prompt block is stop `filter-content` with `model-filter`. Gemini Interactions `budget_exceeded` is `out-of-tokens` with a `service-error` notice. Chat Completions states a repeated finish once. The end particle and `GCStopReasonRow`: [AIX-outcome.md](../AIX-outcome.md), Homes.

Client:
- `ContentReassembler.addIssue` is the one entry: stamps `atMs`, appends, never touches the termination. A failure while the fragments hold a failed issue is stored `notice`; a clearing retry reset takes the verdict back
- Doors: the particle, `setClientExcepted`, the processing catch (backlog goes on), media failures, finalize (`no-end`). A warn void notice: an unknown particle or end reason, a malformed `aix-issue`, an invalid upstream handle. Arguments with no function call open throw and fail the message
- Stored stop reason: the end's (`_storedStopReason`), `issue` when a failed issue is held (`filter` stays). After the verdict (`hasVerdict`) `setClientExcepted` logs only, nothing retries; a Stop after the wire end (`hasWireEnd`) keeps the end
- After a Stop no particle is applied. `waitForWireComplete` loops until no run is in flight; the chain never rejects; a retry reset keeps the backlog; an update-callback throw is logged
- `aixClassifyStreamingError`: null (a Stop) only when the user's signal is aborted; on Direct Connection every throw is `aix-unknown`. `AixStreamRetry.shallRetry` reads `recovery` (`reroute` is no retry); off, `new AixStreamRetry(0, 0)`
- Pre-loop catch (`aixChatGenerateContent_DMessage_FromConversation`): `AixIssueThrow` carries its record; another throw is `aix-prepare`, or `aix-unknown` once fragments exist. Failure text: `messageFailureText(lastDMessage.fragments)`

## Stored data and readers

- `DMessageAixIssuePart` (`chat.fragments.ts`): a content part per issue, at its place, any effect; deletable, not editable
- `[Aix.Issue Malformed Guard]`: `aixIssueIsWellFormed` at the wire door (`ContentReassembler`) and the load repair (`chats.converters.ts`, load and import), which drops the fragment and keeps the message. Readers trust the type
- AIX writes no error parts; they stay for stored messages and other producers (browse, image generation, ReAct, follow-ups). `hint` and the `late-issue`, `no-stop-reason` notice kinds are data at rest

| Reader | Rule |
|---|---|
| outcome | stop reason first; fallback skips issues that did not fail: [AIX-outcome.md](../AIX-outcome.md) |
| request builder (assistant turn), token estimate, Claude Code export | `aixIssueReplayText`: `[ERROR] ` and the text, the detail too for `service-*`, `model-*`; none for a notice. An error part for the errors-alone rule |
| `messageFragmentsReduceText` (copy, export, titles, Beam), Claude Code `chat.md` | `aixIssuePlainText` when `aixIssueInMessageText` |
| `fragmentFailureText`, `messageFailureText` (`aixChatGenerateText_Simple`, gather and caption errors, Beam rays, probes, cleaner) | `aixIssueFails` |
| single-function-call helper | ignores issues that did not fail |
| Beam mergeable content, `skipVoid` copies, attach as document | skipped |
| load repair | a transient placeholder followed only by issues that did not fail becomes an error, unless a failed issue is held |

## Presentation

`aixIssuePolicy` -> `{ recovery, replay }`; `aixIssuePresentation` -> `{ label, byService, tint, form, advice?, report?, detail?, directConnection? }`. Total (unknown code: label `Issue`, recovery `report`); a row per code (`_ROWS`) refined by status, cause code, runtime; neither reads `text` or `detail`. `fails`, `breaks`, `blame` are commented out.

- Form by effect: `notice` chip, `lost` block, `failed` block or card. Tint `danger` when failed, else `warning`. Label: the service name when `byService`, else the row's. Advice and the DC row only when failed; the GitHub report ask only where a bug is likely, opening Details (`report`). A wait of 2 s or more: 'Try again in N seconds' (minutes, hours)

Renderer (`BlockPartAixIssue.tsx`):
- Block: a `BlockAccentBar` line in the tint beside `name: text`, the inline detail (3 lines until Details opens), the advice, Details (the other detail; facts row `code | causeCode | HTTP n | retry after | in browser/on server | at t | offline`), the DC row. Plain text, bare URLs linked
- Inline detail: `service-*`, `model-*`, `_DETAIL_ACTIONABLE_CODES` (`dispatch-http`, `-connect`, `-prepare`, `-unknown`, `aix-prepare`); the rest under Details
- Chip: `name: text`, `name also reported: text` for a `service-*` notice; detail in a tooltip; dismissible; hidden in zen mode unless editing
- Cards: `BlockPartError_NetDisconnected` (cutoff, with the elapsed `atMs`), `BlockPartError_RequestExceeded` (size), both with the DC row
- Edit mode can delete an issue part. `BlockPartError` renders error parts as text. Out of tokens is no record: `ChatMessage` draws a warning `BlockAccentBar` line after the fragments on outcome `truncated`, in chat and Beam. A retry chip that is over ('Gave up after N attempts', 'Stopped at attempt N') turns neutral

## Decisions

On every user's disk, no migration: these stand.
- Part `aix.issue`; rejected: an `issue` field on the error part (reinterprets a part that meant failure), void fragments (never sent upstream, which `service-tool` and `aix-media` need). An older build shows 'Unknown fragment'
- One stored decision, `effect`; rejected: `terminal` and `phase` (six states, three meaningful), deriving on read (a rule change rewrites stored messages)
- `causeCode`; rejected: `sub` (reads as a kind we invent). `relay-*`, `runtime`; rejected: `transport` (every hop has one)
- Particle `aix-issue`; rejected: reshaping `cg: 'issue'` (an older tab reads undefined fields; a new particle reaches its unknown-particle notice). No shim
- Issues are never held, the one wait is parser-local; rejected: holding in the transmitter (shared state), a function-call guard (no capture), send then amend (a mutable record)
- The first failure fails, later ones are notices (transmitter, continuation wrapper, reassembler); rejected: every failure fails (two blocks, two replayed lines), the last wins (a consequence replaces the cause)
- Parsers state filter stops; rejected: one synthesis at the end (far from the vendor's words)
- Failed and lost issues replay as `[ERROR] ...`, notices not, a turn of errors alone is dropped; not replaying waits, as it rewrites stored prefixes (Vendor facts)
- An in-band error ends the read on every host; rejected: reading on for OpenRouter's usage (a stalled upstream keeps it open)
- Outcome fallback: the last content fragment; rejected: any failed issue fails (joined messages, Beam 'Use all', would read failed)
- Odd input is a void notice; rejected: a non-failing `aix-unknown` (claims a failure nobody saw)

## Limits accepted

- A tab on an older bundle shows `aix-issue` as its unknown-particle notice and stores every failure but filter stops as stop reason `issue` with that notice as its trace; a reload fixes the tab, not those messages. An older server (a rollback) sends `cg: 'issue'`, shown as an unknown particle
- AIX errors stored before the records are error parts: text, no cards
- A last attempt that connects, then fails otherwise, reads 'Gave up after N attempts'
- `streamingTransportFetch` reads a clone of each non-2xx JSON body: every streaming link throws `response-status` for one without tRPC's envelope

## Tests and tools

- `aix.issues.test.ts`: builder, what `effect` decides (replay text included), newer-build records, the load guard, advice edges; `trpc.router.fetchers.test.ts`: `causeText`, `httpErrorType`
- `ChatGenerateTransmitter.test.ts`: transmitter rules, end nets, 4,000 seeded call sequences, wrapper failures, `onReadEnd`
- `chatGenerate.replay.test.ts`: captures through parsers and transmitter (end nets only as listed in `END_NETS_EXPECTED`, empty), then the client readers
- `chat.issues.readers.test.ts`: readers, load repair; `ContentReassembler.issues.test.ts`: client doors and rules; `aix.issues.chain.test.ts`: stubbed `fetch` through the real executor chain and reassembler, both runtimes, Stop
- `tools/develop/aix-issues-lab/`: a mock service, one failure per scenario; `tools/develop/swc-minify-check/`: the outcome cases

## Vendor facts

Measured; a hypothesis says so.
- OpenAI Responses: `response.failed` followed the `error` event in 18 of 18 runs, adding items and `tool_usage`, never `usage`; its code can be `unknown`. After answer text the `error` is no verdict: in 10 of 10 rate-limit cases the message was complete. Rate-limit events carry `error.headers.retry-after-ms`
- OpenRouter (2 captures, 5 log lines): after the in-band error come a `finish_reason` chunk (`tool_calls` or `error`) and the billed usage; reading on: no end after 30 s on a stall
- Gemini (2 captures): after the in-stream error frame only an unframed copy, then the end. In-stream `503 UNAVAILABLE` comes after HTTP 200 [hypothesis, two models: always after content]
- Gemini: AIP-193 errors; `details` on some HTTP errors (a bad key: `ErrorInfo` `API_KEY_INVALID`; a bad field: `BadRequest`), on no in-stream error (2 captures, 3 bodies). 'Deadline expired...' comes as `504 DEADLINE_EXCEEDED` (`X-Server-Timeout`, not sent) or `503 UNAVAILABLE` (#1287): classify by status
- Anthropic: no in-stream error captured. Bedrock: exception frames name the failure in `:exception-type` (format docs, not reproduced)
- xAI [hypothesis, one capture]: a reply that fills the context window ends `response.completed`, cut, 6 tokens under the window
- Replay (question, stored 402 turn, new question; 9 models x 3): replayed, the first question went unanswered on 8 models (24 of 24), not on Opus 5.5; left out, always answered. 'What happened?' was explained only when replayed; a neutral marker did no better. A changed rule rewrites stored prefixes: once, Anthropic drops the thinking after it (`prefix_binding_mismatch`) and the cache misses

## Open work

- Tests: error captures replayed to the record, then to outcome, replay, presentation and retry (few error captures today). Untested: the `aix.client.ts` stream loop and pre-loop catch, the `chat.md` split. #1288 rows: error then `incomplete` or `completed`, a read failure or Stop after it, `response.failed` with `error: null`
- Unverified in a browser: dark-mode warning contrast, Details at small scaling, the chip on narrow screens, a live Vercel 300s cut, Deep Research resume, Bedrock, Vertex
- Client auto retry: producers must state retryability first (`service-error` reads `retry` for every in-band error); `AixStreamRetry`, `setClientRetrying` never run; nothing acts on `reroute`. After partial output (#1211, #1287) Responses retries, Chat Completions does not; asked: clear cases only, a "Retry transient errors within [N] minutes" setting
- One home for the permanent-429 list (retrier deny lists, policy advice); the Anthropic in-stream gate ignores it (`enforced_spend_limit_reached` retries); its zero fast-mode limit is matched by text
- Not retried: Groq 498 (overloaded), HTTP 500 at connect, Gemini proxy-error finishes, Bedrock in-stream throttles, a Chat Completions error without a message. Retried as transient: OpenRouter 503 (no provider fits). A Gemini per-minute 429 may match `quota` [unverified]
- A retryable error after the stop reason re-runs a complete answer; an expired handle on reattach reads as a 404
- Codes: a service's HTML page is `dispatch-cutoff` streaming, `dispatch-parse` non-streaming; server audio conversion fails the read, client media is `lost`; WebKit `cancelled`/`TimeoutError` on the relay are `aix-unknown`; abort-shaped throws unmeasured on Safari, suspended tabs; codes outside chat generation, `alx-*`, `tool-*`, `agent-*`; `relay` names gateways in some comments
- Companion and client-transform failures are logged only; unknown vendor values throw in development (`dispatch-parse`), warn in production
- No function-call guard: an issue between argument chunks closes the call, the next chunk fails as `dispatch-parse` (no capture shows it). A client record can split a reasoning text from its signature, or a call from its chunks
- OpenRouter's usage after an in-band error is unread (needs a bounded wait); the dispatch reader is never cancelled on a parse failure, a signal or a consumer `return()`; no end guard in the reassembler; `terminationReason` could leave the end particle
- From code review, not reproduced: `_hasTRPCErrorEnvelope` (`trpc.client.ts`) tests for `application/json`, and tRPC's own non-2xx answers may not carry it, so they would read `relay-http`; the load repair runs in `onRehydrateStorage`, after the store's first `set`, so a malformed stored record could reach a reader first; an operation retry leaves the continuation wrapper's `failedSent` and `stats.lastIssue` set; an `ii` particle with no data throws inside the catch of `onAppendInlineImage` and fails as `aix-unknown`; a failing end with no failed record (not sent by the server) stores no explanation
- Asked on #1211: retry by itself an empty reply that ended early, within the retry window above; keep a failed reply with partial text out of Beam merges (`fragmentsHaveMergeableContent` asks only for content)
- `dispatch-parse` details carry zod `prettifyError` symbols (non-ASCII); the scrub needs 16 or more chars after `sk-`
- Policy rows for Gemini `PUP_LIMITED_DISABLED`, `MISSING_THOUGHT_SIGNATURE`, `TOO_MANY_TOOL_CALLS` ([AIX-outcome.md](../AIX-outcome.md), tool-budget stops). Deep Research `in_progress`/`queued`/`cancelled` read `retry` where only Recover or Resume is safe; Recover's markdown diagnostics sit in the answer and replay
- Texts: OpenAI `context_length_exceeded` in a hosted tool loop should blame the tools; `relay-rejected` shows raw JSON; the cutoff card talks of long responses at any elapsed time; a cutoff after output reads 'Try again.'; size suggestions only without Direct Connection; no docs link for 401/402/403; Gemini in-band errors always log as warnings
- Rename the `BlockPartError_*` files (the issue renderer's) and this file (source comments point here). A failing Beam merge shows its failure twice ('Issue: ...' and the record); the `aixChatGenerateText_Simple` throw joins every failure text
- Bedrock: an Invoke exception frame throws in the Anthropic parser (`dispatch-parse`; P53 in [AIX-ingestion.md](../AIX-ingestion.md)); an unknown Converse `stopReason` ends `model-unfinished` with no cause code; `:error-code`/`:error-message` unconfirmed live
- Gemini: a SAFETY stop's detail lists every non-negligible rating, `blocked` aside, and replays; the 2.x intermediate STOP drops the rest. Interactions: `errors[]` and error-event fields are not in the wiretypes; `is_error` results show as done; PCM-to-WAV failures are dropped
- OpenAI: an unknown Chat Completions finish_reason loses its raw value; `refusal` is unread; usage on the error chunk is dropped. Responses: a non-streaming failure drops partial output; a second kept error replaces the first; response and event ids are dropped; no Meta AI capture of a kept error then `[DONE]`
