# AIX TODO: errors

This document contains inputs, requirements, roadmap items `[ ] -> [x]` for the AIX upgrade to typed errors.
As with `AIX-TODO-next.md` this is partially defined by the author, and largely added to by AI, so please let's validate the architecture and choices before we implement them, we do not want accumulation of hallucinations.

## Why
Errors in AIX come from many sources (flow from vendor > dispatch (in stages and with retriers) > relay > connection > client, and more) and should end in one place: error fragments in the reassembled `DMessageFragment[]`. Today they also end as exceptions thrown to the `_orThrow` callers, in the stop reason and the outcome, and in rewritten placeholders.

AIX grew by catching exceptions at each of those depths with custom code, tricks (e.g. throwing to pop the stack to a parent which will loop us again on retry, etc) and passing them on as text-like:
on the wire an issue is a phase id and a composed string (the end and retry particles carry error text and causes of their own), in the stored message an error is a string and an optional hint - a very bad presentation.

Furthermore the CSF (client-side fetch) vs relayed (tRPC) pipeline complicates things, the usage of shared utilities (`trpc.router.fetchers.ts`, `trpc.fetchers.retrier.ts`) complicates things, with different exceptions and causes, or even wrapping and unwrapping of exceptions and composition of text too - lots of custom code.

What the error is gets lost at the catch site, so every later decision is derived again from the text, by classification and heuristics, several times and not always the same way:
- what to do about it: fail the message, keep the partial answer, keep reading the stream, or even retry and more
- what it invalidates: the attempt, the message, the turn, an agentic loop, and whether another attempt could correct it (nothing says this today)
- how to retry it: whether, by which layer (connect, server operation, client), on which schedule, when to give up (decided from the HTTP status, the vendor code, at times the message wording)
- how to present it: wording, color, log level, where it shows (the UI tells a client drop from a server cut by finding `**network error**` in the stored text)
- how to replay it: whether, and in which form (as `[ERROR] ...` text today, which the model reads as its own output)
- what its side effects are: the outcome of the message, Beam status, usage and cost still owed, the counts of a cut run
- what the user can do next: continue, retry, switch model, fix a key or a setting (implied by the wording today)
- whether a layer can fix it by itself (today only hot fixes before the request, nothing after an error)

Typed errors: the site that catches an error says what it is, once. The type travels in the particle and is stored in the fragment, and each decision above reads it.

## AIX Diagram

Where a failure is seen decides how it travels: an `aix-issue` particle below the relay, a throw only across it (and before the loop).

```
DIRECT CONNECTION (executor in the client)                      RELAY (executor on our server, tRPC)

 aix.client: request assembly, Direct Connection bundle  -- throw (AixIssueThrow) -->  pre-loop catch: aix-prepare, aix-load

 [ continuation wrapper ]  turn limit, last-resort catch -> dispatch-unknown, then the end (an abort: no issue)
 [ operation retrier    ]  retry and continuation SIGNALS are throws between these layers
 [ executor             ]  prepare -> dispatch-prepare | connect -> dispatch-connect, dispatch-http
                           read -> dispatch-read | parse -> dispatch-parse | intake abort -> 'done-dispatch-aborted'
 [ vendor parsers       ]  addDialectIssue / setTokenStopReason / setDialectEnded; onReadEnd
                           -> service-error, service-tool, model-filter, dispatch-parse (our conversion of the vendor's data)
 [ transmitter          ]  queues each issue where it arrives; after the verdict a failure is stamped a notice
                           at the end, for what nobody explained:
                           model-filter | dispatch-cutoff | dispatch-aborted | service-error | model-unfinished
        |   { cg: 'aix-issue', issue }  live, at its place;  then { cg: 'end', terminationReason, tokenStopReason }, once, last
        |                                                                  |  same particles, JSONL over tRPC
        v                                                                  v
 client for-await loop  <--------------- same loop --------------->  client for-await loop
   catch: the user's Stop (no record), our bugs -> aix-unknown         catch: the relay -> relay-connect, -read, -cutoff,
                                                                              -http, -html, -rejected; else aix-unknown
                                          |
                                          v
                  ContentReassembler.addIssue(record): stamps atMs; a second failure is stored as a notice
                    aix-issue particle   -> the executor side's record, as sent
                    setClientExcepted    -> relay-*, aix-unknown   (after the verdict: logged, no record)
                    processing catch     -> aix-unknown, failed
                    media failure        -> aix-media, lost
                    finalize             -> aix-unknown (no-end)
                                          |
                                          v
                  DMessageAixIssuePart { pt: 'aix.issue', issue: DAixIssue }   one per issue, at its place in the message
```

```
agent  >  alx run  >  step  =  [ aix > relay > dispatch > service > model ]  or  [ tool ]
```

== what precedes was written by the author, what follows is added by AI ==

## AIX issues, as built

One record, `DAixIssue`, built once by the layer that sees the failure, sent live in an `aix-issue` particle (executor side) or built by the client (throws, its own work), stored as an `aix.issue` content part, read by every decision. Retry, replay and presentation are derived from the record, never stored. One decision is stored: `effect`, what the issue did to its generation, a snapshot of that moment which a later change of rules does not rewrite.

Homes: `src/modules/aix/shared/aix.issues.ts` (record, codes, texts, builder, reading rules; import-free) and `aix.issues.policy.ts` (policy, presentation, replay text). In `shared/`: read by the server, the browser and the chat store.

### Layers and the rule

| Layer | Code | Failures become | Throws |
|---|---|---|---|
| vendor parsers | `chatGenerate/parsers/*.parser.ts` | parser API calls (below) | the two signals (retry, continuation); a parse error, caught by the executor |
| executor | `chatGenerate.executor.ts` | `dispatch-*` issues | rethrows the two signals |
| wrappers | operation retrier, continuation | retry chips; the continuation's limit and its last-resort catch: `dispatch-unknown`, then the end | nothing past the continuation, except an abort |
| transmitter | `ChatGenerateTransmitter.ts` | the `aix-issue` particles of one dispatch; the end nets | - |
| relay | tRPC pipe; none under Direct Connection | nothing: it has no transmitter | relay failures |
| client | `aix.client.ts`, `aix.client.errors.ts`, `ContentReassembler.ts` | `aix-*`, `relay-*` records | `AixIssueThrow` before the loop (bundle load), caught by the pre-loop catch |

Rule: particles below the relay, throws only across it. Exceptions interrupt flows (abort, retry, continuation) and bubble; they carry no user-facing text past the layer that catches them.

One transmitter per dispatch. A wrapper creates none: it yields a ready `aix-issue` particle and the end (`_wrapperFailure` in `chatGenerate.continuation.ts`).

### The record

| Field | Meaning | Written by | Read by |
|---|---|---|---|
| `code` | `<layer>-<what>` (table below) | the producer | everything below; a code this build does not know (a newer build) gets the fallback row |
| `effect` | `failed`: the generation failed at this issue, at most one per message. `lost`: an output item was lost, the generation went on. `notice`: nothing of the response changed | the producer; the transmitter and the reassembler stamp a failure after the verdict as `notice` | `aixIssueFails`, `aixIssueInMessageText`, presentation form |
| `text` | one plain sentence, no markup, no label, no service name: ours, or the vendor's top-level message for `service-*` | the producer; default: the code's sentence | renderer, plain text, replay |
| `detail` | the failing side's own words: vendor text (other fields as `name: value`), engine text, tRPC text | the producer | renderer (inline or under Details), plain text; replay for `service-*` and `model-*` only |
| `causeCode` | the failing side's machine code, verbatim: vendor code or type, finish reason, system error name, tRPC code; a few of ours (`no-end`, `abort-unexpected`, `continuation-limit`, the media kind). Read only together with `code`: each layer has its own vocabulary | the producer; dropped unless `/^[\w.:-]{1,64}$/` | facts row, policy (`relay-rejected` by tRPC code, `aix-unknown` `abort-unexpected`) |
| `httpStatus` | a status that was on the wire | executor from the fetcher (`dispatch-http`), classifier (`relay-http`) | policy, advice, the size card, client retry |
| `retryAfterMs` | from the service | fetcher headers; parsers (OpenAI `error.headers`, Gemini `RetryInfo`) | policy `backoff`, advice 'Try again in N seconds' |
| `offline` | `navigator.onLine` was false | executor connect and read records in the browser, classifier | advice, Direct Connection row |
| `runtime` | `client` or `relay`: where the executor ran. On `dispatch-connect` and `dispatch-read` only | executor | default text, policy, Direct Connection row, facts row |
| `atMs` | elapsed since the call started | reassembler, in `addIssue` | facts row, the cutoff card ('after 5m') |

`attempts` (retries of this same failure that ran out) is commented out in the type: not built.

Rules (`aix.issues.ts`):
- `aixIssue(code, effect, facts?)` is the one builder: `text` falls back to the code's sentence, `causeCode` is kept only when code-shaped (`aixIssueCodeShaped`), `text` and `detail` are bounded to 2,000 chars each (a vendor's message is kept whole, #1105; the bound stops a runaway body) and scrubbed of `AIza...`, `sk-` + 16 or more chars, `key=`/`token=`-style query values and `Bearer` tokens
- `aixIssueFails(issue) = effect === 'failed'`: the one rule for the outcome and the policy
- `aixIssueInMessageText(issue) = effect === 'failed' || effect === 'lost'`: one rule for replay, token estimate, copy, export, search. An allow-list: an effect a newer build adds is out of the text and never replayed by guess
- For good: `code` and `text` are required strings, `detail` a string when present. A build deletes on load a record that breaks this, so a newer build that changed them would lose its records on every older one
- `aixIssuePlainText` = `text` + ` (detail)` when the detail is not already in the text
- `causeCode` is never a kind we invent for a vendor failure. A `model-filter` sentence comes from the parser or the stop row (`GCStopReasonRow.message`), not from the cause code
- STABLE: a stored record is cloned verbatim (`structuredClone`), never rebuilt; fields and codes are added, never reinterpreted. Every reader is total over codes and effects it does not know

### Codes, outer to inner

Every code is stored as an `aix.issue` part. 22 codes.

| code | produced at | effect | shown |
|---|---|---|---|
| `aix-prepare` | pre-loop catch in `aix.client.ts`: a throw before the LL ran (LLM not found, request assembly) | failed | block, Setup |
| `aix-load` | `_loadCsfModuleOrThrow` -> `AixIssueThrow`, pre-loop catch | failed | block, App, Direct Connection turn-off |
| `aix-media` | reassembler: a generated image, audio or video could not be processed (`causeCode` = kind) | lost | block, warning |
| `aix-unknown` | classifier: unclassified throw; abort-shaped throw without a Stop (`abort-unexpected`); tRPC `INTERNAL_SERVER_ERROR`. Reassembler: a particle that throws in processing; no end particle (`no-end`). Pre-loop catch after the LL ran | failed; notice from the pre-loop catch once the generation had ended | block; chip |
| `relay-connect` | classifier: `TRPCClientError` wrapping a browser network `TypeError` | failed | block, Connection, turn-on when online |
| `relay-http` | classifier: `TRPCClientFetchError` `request-exceeded` (413) or `response-status` (any other non-2xx that is not tRPC's own error envelope: a gateway's 502/504, a firewall's 403, a 429), with the status | failed | card-size (413), else block, Server |
| `relay-html` | classifier: `TRPCClientFetchError` `response-captive` | failed | block, Connection |
| `relay-rejected` | classifier: `TRPCClientError` with any tRPC code but `INTERNAL_SERVER_ERROR` (`causeCode`) | failed | block, Request |
| `relay-read` | classifier: a bare network `TypeError` from the body | failed | block, Connection |
| `relay-cutoff` | classifier: `isTRPCStreamClosedEarly` | failed | card-cutoff, turn-on |
| `dispatch-prepare` | executor prepare catch | failed | block, service name |
| `dispatch-connect` | executor connect catch, `TRPCFetcherError` connection: `causeCode` the system code (bare class names dropped), detail the engine text, cause and host | failed | block, service name; turn-on (`relay`) or turn-off (`client`) |
| `dispatch-http` | executor connect catch, `TRPCFetcherError` http: `httpStatus`, `causeCode` the vendor code, else its error type; detail the body text, and the address when it is the likely cause; `retryAfterMs` | failed | block, service name, detail inline |
| `dispatch-read` | executor stream and non-streaming read catches: detail the runtime text | failed | block, service name |
| `dispatch-cutoff` | transmitter end net: the body closed with no stop reason | failed | block, service name |
| `dispatch-parse` | executor parse catches (detail: the error, then `- input:` and a 200-char head); parsers' own conversion failures (audio, a Bedrock `transform_error`) | failed | block, service name |
| `dispatch-aborted` | transmitter end net: the abort signal fired with no stop reason. Under a user Stop the client applies nothing after it | failed | block, Connection |
| `dispatch-unknown` | continuation wrapper: its last-resort catch; its turn limit (`causeCode` `continuation-limit`) | failed; notice when an issue had already failed | block, App |
| `service-error` | parsers (`addDialectIssue`); transmitter end net | failed; notice after the verdict, or stated so by the parser | block, service name; chip |
| `service-tool` | OpenAI Responses failed image generation (`causeCode` vendor code, detail vendor message) | lost | block, warning |
| `model-filter` | parsers, with the stop reason; transmitter end net when the parser had no words | failed | block, service name |
| `model-unfinished` | transmitter end net | notice | chip |

Not issues: the user's Stop (outcome `aborted`), the stop reason (the outcome), retry chips (`aix-retry-reset` control particles, void placeholders), input this build cannot place (a void warn notice, below).

### Policy and presentation (`aix.issues.policy.ts`)

`aixIssuePolicy(issue)` -> `{ recovery, replay }`; `aixIssuePresentation(issue)` -> `{ label, byService, tint, form, advice?, detail?, directConnection? }`. Both total (a code of a newer build: label `Issue`, recovery `report`); row lookup by own key. No decision reads `text` or `detail`.

The rows (label, byService, recovery) are `_ROWS`, their one home. Refinements: `relay-http` 413 -> label Request, recovery user; `relay-http` 401/403/404 -> recovery user (the front turns this client away: reload); `relay-rejected` UNAUTHORIZED/FORBIDDEN -> recovery user; `relay-rejected` TOO_MANY_REQUESTS/SERVICE_UNAVAILABLE -> backoff, TIMEOUT -> retry, PAYLOAD_TOO_LARGE/NOT_FOUND -> user; `aix-unknown` with `abort-unexpected` -> retry; `dispatch-connect` in the client -> recovery reroute; `dispatch-http` 400/401/402/403/404/413/422 -> recovery user; 429 and 5xx -> backoff; `service-error` with `retryAfterMs` -> backoff. `replay` = `text` when `aixIssueInMessageText`, else `never`.

Three more columns are commented out in the type, with their meaning: `fails`, `breaks`, `blame`. No reader yet; each returns with its first one.

Readers of the policy: `replay` (request builder, token estimate, Claude Code export, through `aixIssueReplayText`) and `recovery` (`AixStreamRetry`, which is off).

Presentation:
- form, by effect: `failed` -> `block`, or `card-cutoff` for `relay-cutoff`, `card-size` for `relay-http` 413; `lost` -> `block`; `notice` -> `notice` (a chip)
- tint: `danger` when failed, else `warning`
- label: the service's name (from the message generator's vendor id) when `byService`, else the label
- advice and the Direct Connection row only for an issue that failed

Advice: one plain sentence by code, status, cause code, runtime and the offline fact (`_advice`). The GitHub report is asked only where a bug is likely: not for a front's status (`relay-http`), a server condition (the `relay-rejected` codes above), or an abort nobody asked for (`abort-unexpected`: 'Try again.'). A wait the service asked for reads `Try again in N seconds/minutes/hours` from 2 seconds up; under that the status sentence stays.

Direct Connection row: `turn-on` for `relay-cutoff`, `relay-http` 413, `relay-connect` when online, `dispatch-connect` on the relay; `turn-off` for `aix-load` and `dispatch-connect` in the client when online.

Renderer (`BlockPartAixIssue.tsx`): reads the record and the presentation only. `text` and `detail` are plain text, bare URLs become links. A detail that adds to the text shows inline (clamped to 3 lines until Details opens) for `service-*`, `model-*`, `dispatch-http`, `dispatch-connect`, `aix-prepare`, `dispatch-prepare`, `relay-rejected`, `aix-unknown`, `dispatch-unknown`, `dispatch-parse`; any other detail waits under Details, with the facts row (`code | causeCode | HTTP n | retry after | in browser/on server | at t | offline`). The chip reads `<label or service name>: <text>`, the detail in its tooltip; dismissible, hidden in zen mode except in edit mode. In edit mode every issue part can be deleted. `BlockPartError` renders an error part's text; the hint cards of AIX errors stored before the records are gone.

### Wire (`aix.wiretypes.ts`)

- `{ cg: 'aix-issue', issue: DAixIssue }`: the record, live, at its place in the stream
- `{ cg: 'end', terminationReason, tokenStopReason? }`: facts only, once, last
- `GCStopReasonRow.message`: the `model-filter` sentence of the three filter stops
- `IParticleTransmitter.sendCGControl` takes `ParticleCGControlOp`, which excludes `end` and `aix-issue`
- The stats tap (`AixChatGenerateCompletionStats`, filled by the continuation wrapper) carries `lastIssue`: the record that failed the generation, as sent

### Parser API (`IParticleTransmitter.ts`)

Two commands, as the author asked: state the issue, and stop.

```ts
type ParticleDialectIssue = { text?: string; detail?: string; causeCode?: string; retryAfterMs?: number } & (
  | { code?: 'service-error' | 'model-filter' | 'dispatch-parse'; effect?: 'failed' | 'notice' }   // default service-error, failed
  | { code: 'dispatch-cutoff'; effect: 'notice' }                                                   // onReadEnd only: the close, after a failure the parser stated
  | { code: 'service-tool'; effect?: 'lost' });
addDialectIssue(issue, serverLog?)   // sent at once; the read goes on, whatever the effect
setTokenStopReason(reason)           // the model's finish, as data
setDialectEnded(reason)              // stop reading. An issue that ends the read: addDialectIssue(...), then setDialectEnded('issue-dialect')
parse.onReadEnd?(pt, closed)         // optional, on the parse function: called once after the read, before the end. closed: the body closed with no end from the dialect
```

No `httpStatus` in the parser API: an in-band numeric code goes to `causeCode` as a string. `causeCode` is the most specific vendor code in scope. A filter stop: the stop reason, then `addDialectIssue({ code: 'model-filter', ... })` when the parser has words; the reason alone otherwise.

### Transmitter (`ChatGenerateTransmitter.ts`)

An issue closes the open part and is queued at once: it is never held, and it never stops the read. State added for issues: `failedQueued`, `endQueued`.

- After the verdict (a clean or truncated stop reason, or an earlier failure) an incoming failure is stamped `notice`. `lost` stays `lost`
- An issue that fails sets the stop reason to `cg-issue`, unless an error-class one is set (a filter): a failure travels with an error-class stop reason
- Once an issue failed, a stop reason outside the error class is ignored with a warning
- The end is sent once, last. After it nothing goes out: late particles are dropped with a warning

End nets (`_queueEndIssues`), for what only the end knows and what no producer explained. At most one applies, none once an issue failed:
1. stop `filter-*` -> `model-filter`, the stop row's sentence
2. `done-dispatch-closed` with no stop reason -> `dispatch-cutoff`. With a stop reason the close is how that dialect ends
3. `done-dispatch-aborted` with no stop reason -> `dispatch-aborted`
4. an end that fails (stop `cg-issue`, or an `issue-*` end with no stop reason) -> `service-error`, the generic sentence
5. `done-dialect` with no stop reason -> `model-unfinished`, a notice

Non-streaming: a body parsed in full with no stop reason ends `done-dialect` (net 5), not `done-dispatch-closed`.

### Executor, wrappers, fetchers

- `TRPCFetcherError` gains two fields: `causeText` (HTTP: the body text `message` quotes, and the address when it is the likely cause, the body cut so the address fits the 480-char bound; connection: the engine text, the cause, `host: <host>` unless the runtime named it) and `httpErrorType` (`error.type`, else `error.status`). `httpErrorCode` and `message` are unchanged: the code is the connect retrier's input, so an error class cannot change which failures are retried
- Executor: `dispatch-http` detail = `causeText`, `causeCode` = `httpErrorCode ?? httpErrorType`; `dispatch-connect` detail = `causeText`, `causeCode` the system error name. The request URL is logged in dev builds, never stored
- One abort rule in the connect and read catches (`_isDispatchAbort`): the intake signal aborted, or an abort-named error -> `done-dispatch-aborted`, no issue from the executor (the end net states it)
- `onReadEnd`: called once after the read, before the end; a throw there is logged
- Continuation wrapper: a throw that is not a signal -> `dispatch-unknown`, then the end, unless an end already went out (logged); an abort is rethrown. Past `MAX_CONTINUATION_TURNS`: `dispatch-unknown`, text 'The generation exceeded the continuation limit.', `causeCode` `continuation-limit`. Either is a notice when the wrapper already passed a failed record
- The operation retrier is `main`'s file. Out of attempts it rethrows (not reachable: every throw site checks the attempts left), which the continuation's catch turns into `dispatch-unknown`
- Retry decisions, schedules, retry particles and the retry chip are unchanged. Gemini Interactions POST: `connectNoRetry` on the dispatch (retrier `{ noRetry }`), so its errors stay `TRPCFetcherError` and become `dispatch-http`

### Parsers

Each report kept its trigger and its end reason, and gained facts; text is plain (no service name, markup, emoji, JSON). Our own conversion failures are `dispatch-parse`.
- Anthropic: refusal -> the filter stop reason, then `model-filter` (`causeCode` the category, else `stop_details.type`; explanation and `recommended_model: X` in detail); in-stream error on the last attempt -> `service-error` (`causeCode` `details.error_code`, else `error.type`; a Bedrock JSON body is unwrapped to its message, other fields to detail); `transform_error` -> `dispatch-parse`
- Gemini: filter finishes -> the stop reason, then `model-filter` (`causeCode` finishReason, detail the ratings and finishMessage); other error finishes -> `cg-issue` + one `service-error` (text finishMessage, else ours; `causeCode` finishReason); in-band error -> text the message, `causeCode` the status, detail `<status> (<code>)` and the typed details, `retryAfterMs` from `RetryInfo`; prompt block -> stop `filter-content`, then `model-filter` ('The input was not allowed.', `causeCode` blockReason, ratings in detail): a filter stop, as a blocked response is; audio conversion -> `dispatch-parse`
- Gemini Interactions: error event and `failed` -> `service-error` (`errors[]` read tolerantly; a code that is not code-shaped goes to detail); `requires_action`, `cancelled`, `in_progress`/`queued` at the end -> `cg-issue` + `service-error` (`causeCode` the status); `budget_exceeded` -> a `service-error` notice beside `out-of-tokens`
- OpenAI Chat Completions: in-band error -> `service-error` (`causeCode` the string code, numeric code, else `error.type`; detail the OpenRouter metadata cause via `openRouterErrorMetadataString`, `param: X`), then the read ends `issue-dialect`; a filter or error finish -> the stop reason, then its issue, stated once however often the finish repeats (an empty `content` on a chunk after it opens no text); audio -> `dispatch-parse`
- OpenAI Responses (#1149, #1288): an `error` after answer text is kept in the parser for one event (`#pendingError`). `response.failed` not salvageable states one `service-error` merged with it (the event's facts beat the placeholder `unknown`); salvage, `completed` and `incomplete` drop it; when the read ends first, `onReadEnd` states it, and when the body closed there it states the close as a second record, a `dispatch-cutoff` notice (both observations, as `main` showed). Failed image generation -> `service-tool`. `content_filter` -> `model-filter`; other incomplete reasons -> `service-error`
- Bedrock Converse: exception and error frames -> `service-error` (`causeCode` `:exception-type`, `:error-code` or the wrapped type; other payload fields to detail); the demuxer adds those header values to the payload; filter stops -> `model-filter`

### Storage (`chat.fragments.ts`)

- `DMessageAixIssuePart = { pt: 'aix.issue', issue: DAixIssue }`, a content part; `createAixIssueContentFragment`, `isAixIssuePart`
- `fragmentFailureText(fragment)`: an error part's text, or the plain text of an issue that failed; `messageFailureText(fragments)`: the first issue that failed, else the last error part
- Every issue of a chat generation is stored at its place, whatever its effect; a relay failure after the verdict is logged only. Not editable, deletable. Duplication is `structuredClone`. A `skipVoid` copy turns an assistant message into new input and drops issue parts with the void fragments
- Load guard, marker `[Aix.Issue Malformed Guard]` (grep for it): `aixIssueIsWellFormed` (an object with a string `code` and `text`, `detail` absent or a string: what the readers dereference) is checked at the two doors a record enters by: the wire (`ContentReassembler`, `case 'aix-issue'`: a malformed record is the unknown-particle notice, not stored) and the load repair (`chats.converters.ts`, on load and on import), which removes the fragment and keeps the message. Readers trust the type
- AIX writes no error parts; they stay for stored messages and non-AIX producers (browse, image generation, ReAct, follow-ups, load-time conversion). `hint` on the error part and the `late-issue` and `no-stop-reason` notice kinds stay declared for data at rest; nothing writes them
- An older build: keeps an unknown content part on load, clones it on duplication, shows 'Unknown fragment', skips it in requests, and reads the outcome from the stored stop reason. A failure always travels with an error-class stop reason, so it stores the message failed

### Outcome (`chat.message.outcome.ts`)

The stored stop reason decides first. Fallback (none, or one this build does not know), as on `main`: the last content fragment, skipping issues that did not fail: an issue that failed or an error part -> `failed`, anything else -> `completed`. Details: [AIX-outcome.md](../AIX-outcome.md).

### Reassembler and client

- `addIssue(issue)` is the one entry: it stamps `atMs`, appends the part, and never touches the termination. One rule: a failure when the message already holds one is stored as `notice`. Whether one is held is read from the fragments, so a clearing retry reset takes it back with them
- Doors: the `aix-issue` particle, `setClientExcepted(issue)` (the classifier's record), the processing catch (`aix-unknown`, failed; the backlog goes on), media failures (`aix-media`, lost), finalize (no end and no failure: `aix-unknown` `no-end`)
- Input this build cannot place is a void warn notice, not a record, and the stream goes on: an unknown particle, a malformed `aix-issue`, an unknown end reason, an upstream handle that does not apply. Function-call arguments with no call open (`_fci`) are not a notice: the call they belong to would stand complete with part of them, so they throw into the processing catch and fail the message
- Stored stop reason: from the end facts (`_storedStopReason`); `issue` when the message holds an issue that failed (`filter` stays). So a failure the client recorded is not undone by a clean end, and a Stop after a failure reads `failed`
- After the verdict (`hasVerdict`: an end applied, or an issue that failed), `setClientExcepted` logs only and the client does not retry. A Stop after the wire end (`hasWireEnd`) keeps the end, on both loop paths
- Once the caller's signal is aborted no particle is applied: under Direct Connection the executor still sends its `dispatch-aborted` and the end after a Stop
- `waitForWireComplete` loops until no run is in flight; the processing chain never rejects. A retry reset clears state, not the backlog. A throw of the update callback is logged, no record
- `aixClassifyStreamingError(error, { aborted, path })`: one pass, a full record. A Stop only when the user's signal is aborted; on the Direct Connection path a throw is `aix-unknown`, never `relay-*`
- Pre-loop catch: `AixIssueThrow` carries its record; any other throw is `aix-prepare` before the LL ran, else `aix-unknown`; once the generation had ended the record is a notice and the stop reason stands. The L3 result is `{ outcome, lastDMessage }`: a failure's text is read off the message (`messageFailureText`), there is no `outcomeFailedMessage`
- `AixStreamRetry.shallRetry(issue)` reads the policy's `recovery`; `reroute` is not a retry. Client retry stays off (`new AixStreamRetry(0, 0)`)

### Readers, and their three predicates

A reader of an issue part picks one of three: it failed (`aixIssueFails`), it is part of the message text (`aixIssueInMessageText`: failed or lost), or any issue part.

| Reader | Rule |
|---|---|
| request builder (assistant), token estimate, Claude Code session | `aixIssueReplayText(issue)`: `[ERROR] ` + the sentence, plus the detail for `service-*` and `model-*`; null for a notice. A replayed issue counts as an error part for the errors-alone rule; system and user turns skip the part |
| message text (`messageFragmentsReduceText`: copy, Markdown export, search, captions, gather inputs), Claude Code `chat.md` | `aixIssuePlainText(issue)` when `aixIssueInMessageText` |
| what failed (`aixChatGenerateText_Simple`: its returned text and its throw; gather and caption errors, probe inspector, cleaner counts, outcome fallback) | `aixIssueFails`, through `fragmentFailureText` / `messageFailureText` |
| the single-function-call helper | ignores issue parts that did not fail |
| Beam `rayHasMergeableContent`, `skipVoid` copies | any issue part: not mergeable content, dropped from the copy |
| load repair | drops a malformed record; looks past trailing issues that did not fail when testing for a transient placeholder; converts no placeholder of a message that holds an issue that failed (it is explained and settled: a reload changes nothing) |

### Tests and tools

Tests drive real code through an edge; none restates a table.
- `aix.issues.test.ts`: the builder (bounds, scrub, code-shaped cause codes), what the effect decides (fails, message text, form, the replay text: a change there changes the prompt prefix of stored conversations), records of a newer build, the load guard, three presentation edges (retry-wait thresholds, where a report is asked, the Direct Connection row)
- `trpc.router.fetchers.test.ts`: `causeText` and `httpErrorType` from real response shapes
- `ChatGenerateTransmitter.test.ts`: an issue goes out where it arrives, one failure, a filter stop explained once, the end nets, nothing after the end, a call closed by an issue; the same rules over 4,000 seeded random call sequences (one end, last; at most one failure, with an error stop reason; a failing end explained; no text lost); the continuation wrapper's own failures and `onReadEnd`, on a stubbed connect
- `chatGenerate.replay.test.ts`: captures and frames through the real parsers and transmitter; rows per dialect read the record; no end net fires on a capture unless listed (`END_NETS_EXPECTED`, empty); every capture on through the reassembler, the load repair and the readers (outcome as the end states, one failure with its record, every particle placed, text kept, a reload changes nothing)
- `chat.issues.readers.test.ts`: copies (verbatim, `skipVoid`), message text, failure text, token estimate, outcome fallback, load repair, malformed parts; `swc-minify-check` holds the outcome cases
- `ContentReassembler.issues.test.ts`: the doors (a malformed record, arguments with no call), the one rule, the verdict, Stop, retry reset, a front's status through the classifier, the text a utility call returns
- `aix.issues.chain.test.ts`: the chain gate. A stubbed `fetch` through the real dispatch creation, fetcher, executor with continuation and reassembler: streaming, non-streaming, a user Stop on both runtimes, Direct Connection
- `tools/develop/aix-issues-lab/`: a mock service with one failure per scenario, a live target for the app

### Decisions taken, and the alternatives

The record is persisted: `effect`, `causeCode`, the `relay-*` codes and the absence of `attempts` are final once landed.

- **A new part type, `aix.issue`.** Chosen: the author's spelling; a record that is the data, not a decoration of a text; notices and lost items stored like failures. Alternatives: (A) an optional `issue` field on the error part: fewer consumer changes and older builds keep the text, but it reinterprets a part that always meant failure, and older builds read every issue as a failure; (C) non-failing issues as void fragments: a void part is never sent upstream, and `service-tool` and `aix-media` must be; as a content part, sending or hiding an issue stays a derived decision, and a void part cannot be promoted to content later. Cost: every exhaustive switch on `pt` and every error-part reader took a case; an older build shows 'Unknown fragment'
- **One stored decision, `effect`, three values.** What the issue did to its generation, stated by the producer and settled where the record enters the stream and the message. Rejected: two fields, `terminal` and `phase` (six states, three of them meaningful; a reader had to combine them, and `phase: 'after'` doubled as "demoted"); deriving the role on read (which issue failed is a fact of that generation, and a rule change would rewrite stored messages)
- **`causeCode`, not `sub`.** It names what it holds: the failing side's code. Rejected: `sub` (reads as a sub-kind we invent)
- **`relay-*`, `runtime: 'client' | 'relay'`.** The tRPC pipe is the relay; `transport` reads as HTTP transport, which every hop has. Third-party gateways are called gateways (the comments that call them relays are not renamed yet)
- **A new particle, `aix-issue`, not a reshaped `cg: 'issue'`.** A tab on an older bundle reaches its unknown-particle notice instead of reading `issueText` as undefined. No shim is sent
- **Issues are never held.** The transmitter queues an issue where it arrives, so it shows where it happened. The one case that needs the next event is parser-local: the OpenAI Responses `error` after answer text. Measured: `response.failed` followed the `error` in 18 of 18 runs, and in 10 of 10 rate-limit cases the message inside it was complete, so the `error` alone is not a verdict. Rejected: hold and take in the transmitter (state every parser could reach), a function-call guard (issues waiting behind an open call: no capture shows the case), sending the `error` on arrival and amending it (a second record, or a mutable one)
- **One issue fails a generation.** The first; a later one is a notice. Enforced where each producer set is seen whole: the transmitter (one dispatch), the continuation wrapper (its own failure after an inner one), the reassembler (the executor's records plus the client's own). Rejected: every failure fails (two danger blocks, two `[ERROR]` lines replayed, a thrown text joining both); the last wins (a consequence, such as a cutoff, would replace the vendor's reason)
- **Parsers state filter stops.** The parser has the vendor's words (category, ratings); the transmitter keeps no stop facts and its end net covers the parser that has none. Rejected: facts passed with the stop reason and one synthesis at the end (state in the transmitter, the record far from its words)
- **Replay parity with `main`.** An issue that failed is replayed as `[ERROR] ...` after real content ('it tells the model a reply was cut', 8d48bb11fca); the request builder's errors-alone rule still drops a turn that holds nothing else; lost output is replayed; a notice is not. The Replay measurement below (8 of 9 models skip the user's question) is the input for a later change; the golden strings guard the prefix
- **An in-band error ends the read at once, on every host**, as on `main`: the parser's two calls. Rejected: reading on after an OpenRouter error for the billed usage: an upstream that stalls after the error keeps the generation from ending (measured: no end after 30 s; `main` ends in 53 ms)
- **The outcome fallback keeps `main`'s rule**: the last content fragment decides, so content after a failed issue reads completed. Rejected: a failed issue anywhere fails the message: messages joined from several generations with no stop reason (Beam 'Use all') would read failed, and a single generation needs no such pass, as it stores stop reason `issue`
- **Odd input is a void notice.** An unknown particle or end reason, a particle that does not apply: the response may well be complete, and a record would claim a failure nobody saw. Rejected: a non-failing `aix-unknown` record (a content part for something that is not content)
- **The stats tap carries the record only.** A reader derives what it needs from it

### Accepted

- Stale tabs (one tab per browser, a reload fixes it, no shim): a tab on an older bundle shows each `aix-issue` as its unknown-particle notice, the record as JSON in its detail. It explains filter stops from the end facts and nothing else: every other failure stores stop reason `issue` with that notice as its only trace, and a message written in that window stays so
- No rollback: a new bundle on an older server reads its `cg: 'issue'` particle as an unknown particle
- Errors stored before the records lose their cards and show their text
- Four behaviors differ from `main`: a non-streaming reply with no finish reason is `completed` with a notice (was failed); an abort-shaped throw without a user Stop fails as `aix-unknown`, advice 'Try again.' (was a silent Stop); a Stop after a failure stores `issue` (was `client-abort`); a Gemini prompt block is stored with stop reason `filter` (was `issue`). A fifth is a fix: a retry reset keeps the particles queued behind it
- Smaller differences from `main`: a relay failure that is a front's status reads 'The server answered HTTP n.' (was 'An unexpected error occurred'); the last status of a connect that ran out of retries reads '<reason> - Gave up after N attempts' (was 'Connection failed (N attempts)'); a throw of the caller's update callback is logged, not stored; an issue part of a failed message is skipped when the message is attached as a document

### Risks

- No function-call guard: an issue between the argument chunks of a call closes the call; the next chunk throws in the transmitter and the generation fails as `dispatch-parse` (a notice, when the issue had already failed it). No capture shows the case
- `relay` has two meanings until the gateway comments are renamed
- `onReadEnd` is new executor surface: one parser uses it
- `streamingTransportFetch` reads a clone of a non-2xx JSON body to tell tRPC's envelope from a front's answer: it is shared by every streaming link, which now gets `TRPCClientFetchError` `response-status` where tRPC's JSON parse used to fail
- Abort-shaped throws without a Stop are not measured on Safari or on a suspended tab: they fail the generation, with 'Try again.'
- Under Direct Connection a Stop relies on the reassembler applying nothing after the abort: the executor sends a failed `dispatch-aborted` and an end with `cg-issue`

### Verified, and not

- Verified by tests at the tip: the list above. By the chain gate: 31 scenarios through the real executor chain and reassembler
- Verified in a browser, on a mock service and a fault proxy on the relay hop: 21 of the 22 codes on the server path and under Direct Connection (`dispatch-aborted` is built and never applied), Stop on both paths, a reload, Beam rays and a failing merge beside `main`
- Not verified in a browser: warning contrast in dark mode, the Details toggle at small scaling, the chip on narrow screens; a live Vercel 300s cut, Deep Research resume, Bedrock and Vertex
- No test drives the stream loop or the pre-loop catch of `aix.client.ts`, nor the Claude Code `chat.md` split

### Status

- [x] record, codes, texts, builder, reading rules (`aix.issues.ts`); policy, presentation, replay text (`aix.issues.policy.ts`)
- [x] fetchers: `causeText`, `httpErrorType`
- [x] storage, readers, outcome, renderer, load guard
- [x] wire, transmitter, executor, wrappers, stats tap
- [x] parsers: Anthropic, Gemini, Gemini Interactions, OpenAI Chat Completions, OpenAI Responses (#1288 stopgap removed), Bedrock Converse
- [x] reassembler, stream loop, classifier, pre-loop catch, retry gate by policy
- [x] tests, the chain gate, the lab mock
- [x] browser pass (above)
- [ ] the error testing system (Open)
- [ ] client auto retry: off (attempts stay 0); `recovery` needs a producer hint first (Open)
- [ ] `alx-*`, `tool-*`, `agent-*` prefixes when those layers exist

### Open

Error testing system (asked by the author; after landing, in separate commits):
- Two layers, both on real captures, every error reproducible on demand. No tests of trivial functions
- Layer 1, origination: captured vendor failures (HTTP error bodies, in-stream error events, cut streams; the odd ones sifted from traces) replayed through fetch, executor, parser and transmitter, asserting the record each one produces
- Layer 2, flow and handling: the same captures on through the reassembler and the stored message, asserting outcome, replay, presentation and the retry decision
- Today: the chain gate (hand-written bodies, one dialect), the lab mock (the same bodies, live), and `chatGenerate.replay.test.ts` with few error captures

From the design:
- Client auto retry. Before a loop reads `recovery`: `service-error` reads `retry` for every in-band error, and an invalid request cannot be retried, so the producer has to state it (a hint on the record, set by the parser); then the attempts and delays
- One home for the permanent-429 list: the server retrier's deny list vs the policy's advice
- Deferred, each a change to code only, none to the record:
  - an HTML page from the service is `dispatch-cutoff` streaming and `dispatch-parse` non-streaming: one code, by a content-type check before the read
  - a server-side audio conversion failure is `dispatch-parse` and ends the read; a client media failure is `aix-media`, lost: make the server's `lost` too (needs a code decision)
  - the client retry code (`AixStreamRetry`, `setClientRetrying`): never run, 175 lines; decide with the retry design, `recovery` stays
  - an end guard in the reassembler: a malformed stream can still store a particle after the applied end (as on `main`)
  - a smaller end particle: with failures as records the stop reason decides alone, `terminationReason` is for logs
  - rename the three `BlockPartError_*` card files (only the issue renderer mounts them); split the as-built part out of this file
  - `relay-rejected` shows a validation error's JSON as its detail; the cutoff card advises about long responses whatever the elapsed time
- WebKit `cancelled` and `TimeoutError` throws on the relay are `aix-unknown`: measure before classifying
- An operation fact for reattach failures: an expired upstream handle reads as a 404
- A retryable vendor error after the stop reason re-runs a complete answer (pre-existing)
- Silent companion and client-transform failures
- Unknown vendor values throw in development (`dispatch-parse`) and only log in production
- Codes for the producers outside a chat generation (browse, image generation, ReAct, follow-ups, load-time conversion)

Chain and wire:
- The usage OpenRouter sends after an in-band error is not read, as on `main` (see Decisions): reading it without the stall needs a bounded wait in the executor
- The dispatch reader is never cancelled on a parse failure, a thrown signal or a consumer `return()`
- A client record (processing catch, media) can land between a reasoning text and its signature, or a call and its argument chunks: those attach to the last fragment
- `dispatch-parse` detail carries zod's `prettifyError` symbols (non-ASCII) verbatim
- The credential scrub needs 16 or more characters after `sk-`

Policy and presentation:
- No rows for vendor cause codes: Gemini `PUP_LIMITED_DISABLED` (account), `MISSING_THOUGHT_SIGNATURE` (ours), `TOO_MANY_TOOL_CALLS` (no retry); Deep Research `in_progress`/`queued`/`cancelled` get retry advice where only Recover or Resume is safe (a re-POST starts a second billable run)
- Deep Research Recover (non-streaming `in_progress`/`queued`): `main`'s markdown diagnostics stay in the answer beside a failed `service-error`, and the next turn replays both; move the diagnostics into the record
- The Request Too Large card shows the size suggestions only when Direct Connection is unavailable; no docs link for 401/402/403
- A cutoff after partial output reads 'Try again.', as one before any output

Parsers, kept as on `main`:
- Anthropic: the in-stream retry gate ignores the 429 deny list (`enforced_spend_limit_reached` is retried); no captured in-stream error
- Bedrock: an Invoke `:message-type: exception` frame throws in the Anthropic parser (`dispatch-parse`, not a `service-error`); in-stream throttles are not retried; unknown Converse `stopReason` values end `model-unfinished` with no cause code; the `:error-code`/`:error-message` names are not confirmed live
- Gemini: ratings of non-SAFETY filter rows are replayed to the model; `SafetyRating.blocked` is ignored; the proxy look-alikes are not retried; the 2.x intermediate STOP drops the rest of the answer
- Gemini Interactions: `errors[]` and error-event `code`/`status` are not modeled in the wiretypes (no capture); `is_error` tool results shown as done; PCM-to-WAV failures dropped; the error event ends the read
- OpenAI Chat Completions: an unknown finish_reason ends `model-unfinished` without the raw value; `refusal` never read; usage on the error chunk itself is dropped; an error without a message is not retried
- OpenAI Responses: a non-streaming failed response drops its partial output; when the kept event and the verdict carry different real codes, the verdict's wins; `context_length_exceeded` inside a hosted tool loop keeps the vendor's sentence; no Meta AI capture for a kept error then `[DONE]`

Readers:
- A failing Beam merge shows its failure twice, as on `main`: the instruction's own 'Issue: ...' line and the record in the fused message
- The Text_Simple throw joins every failure text and error part; `messageFailureText` is the single-text alternative

## Inbox

Inputs for the requirements: from the author, from reading the code, from captures and production logs, from other sessions. Diverse, not prioritized, not of equal weight, nothing decided; a `PROPOSED` section is one session's proposal. Validate before use.
To come: the author's inventory of error sites and what to do about each, and the diagrams.

### From the author

On what is stored, facts or decisions (2026-11-10):
> Facts, but also some decisions, for instance what would be policy nbame that governs the retry or reconnect, etc. bascially facts such as what is invalidated by an error, is it somehting that has cailed the generation and won't be able to be corected ,and would also fail. the loop if agentic.. and this is for instnace becauise there are so manu errors, that having all of them mapped everywhere could be a lot, so let's do facts, but also if important some hints. because otherweise I believe there will be too many places to check and for each 40 error kinds.. hoserver we can later patch/rederive things. figure out a suystem that allows this

On the stored shape (2026-11-10):
> We may have a new part type or extend with aixIssue however I'd prefer to legacy abandon in the future the curent part (i.e. no more generaiton for it), and maybe adopt pt: 'aix.issue' and extended attributes there. and there definintely need ot be wiretypes/fragments/particles alighment to make those fly. Note that after this definition I'll come in with a big table I already have of all the places of errors and what to do aobut them, etc.

On what else an error must answer (2026-11-10):
> Whether to replay to the AI and with which policy for the replay. also if there' a way to auto-fix it, maybe things that relate to the various layers. I do expect the presentation tobe all in ChatMessage and few other places, and there need to be functions that for instance derive the message outcome from the fragments[] and the end decision, or stuff like that (static policy-like derviations and data modification as well, sometimes (immutable in, immutable out))

On stream mechanics: where an issue is typed, and queuing it apart from stopping (2026-11-10, dictated, lightly cleaned):
> At the source point we're going to know if something is dialect terminating or not, or we can hint it. And if not, at least we can say where it was born, for instance in the vendor, and maybe hint it or not, because if we don't do it where it's born, then downstream is even more diluted. So it should be something that we do by default, to pick whether the disposition is to terminate or not. However, there's disposition and there's outcome. It's very important that we don't just say "set dialect terminating issue": we have two commands. One is to queue up the issue, which is going to be the aix.issue particle. The other one is to stop the parsing, stop and close. Depending on the implementation, some of them we may not want to stop and close, because we may want to have the issue, and then if there's data after the issue, let's keep it coming. We don't necessarily have to decide to close just because we got an issue: maybe the disposition is not to close, the disposition is to continue the parsing. Normally we enqueue one more particle and so be it. Deciding to close on our end is maybe too abrupt just because we have an issue. At the end of one agentic step, one low-level AIX call, we'll apply policies to these fragments and to the issue fragments. Keep in mind, some of the policies need to be known to the retriers, so we can say whether to retry something or not, and those are in the dispatch as well. So we would need to pass the policies to the dispatch if the policies are not on the client; some of them are on the dispatch. And those are sending particles as well, sending and clearing particles.

On the blocked image (2026-11-06), the TODO left at the site:
> send this as a dialect issue, of subkind image-gen-error, subCause: string, aiRender: true, uiColor: 'neutral', ... as we'll have a large refactor of errors coming soon, with all aix errors being typed out neatly, and then travelling in particles, etc.

### Sites waiting for typed errors

- OpenAI: a failed or blocked image generation leaves a non-terminating dialect issue with composed text - `_forwardFailedImageGenerationCallItem` (subkind `image-gen-error`, aiRender true, uiColor neutral). **Closed**: a `service-tool` record (effect `lost`), `causeCode` the vendor code, the vendor message in `detail`; replayed and in the message text
- OpenAI (#1288): an `error` after answer text is kept when the stream ends before its terminal event, by a stopgap marked `STOPGAP #1288 - REVERT` at its three sites (Responses parser, transmitter, reassembler): the error is parked in the stop reason and the client guesses it back. To redo with the typed errors. **Closed**: the stopgap is removed; the parser keeps the error for one event: `response.failed` states it, and when the stream closes first the parser states the error and then the close (a `dispatch-cutoff` notice) merged with its verdict, salvage, `completed` and `incomplete` drop it, `onReadEnd` states it when the read ends first
- Gemini (#1287): an error sent inside the stream ends the message with its status, code and text; `details` is appended to the text as JSON and not carried as fields (reason, retry delay, quota), the code reads like an HTTP status though the transport was 200, the log level is always a warning, a bare-string error is surfaced as its message. **Closed** except the log level (still a warning): text the message, `causeCode` the status, `detail` `<status> (<code>)` and the typed details as fields, `retryAfterMs` from `RetryInfo`, no `httpStatus`
- Stop errors stored twice (filter stops, refusals): the replacement code is commented under a `TODO` in `ContentReassembler` (`dialectStopExplained`). **Closed**: the parser states one `model-filter` record with the stop reason; the client adds no sentence of its own
- Gemini `TOO_MANY_TOOL_CALLS`: belongs to the truncated class with its own wording and Continue - see [AIX-outcome.md](../AIX-outcome.md), "Open: tool-budget stops"
- OpenAI `context_length_exceeded` in the middle of a hosted tool loop: the text should say the hosted tools filled the context; the terminal event carries the finished tool items and no message
- OpenRouter Chat Completions: `finish_reason: 'error'` sets `cg-issue` (RECITATION -> `filter-recitation`) with composed text in `tokenStopError` - `_fromOpenRouterErrorFinish`. **Closed**: the stop reason, then one issue (`causeCode` the native finish reason), stated once however often the finish repeats
- tRPC client fetch: a 413 or `text/html` answer is a `TRPCClientFetchError` (`request-exceeded`, `response-captive`) thrown by `streamingTransportFetch`; a custom class until the error table covers the transport. **Closed**: the classifier maps them to `relay-http` 413 and `relay-html`, and any other non-2xx that is not tRPC's envelope (`response-status`) to `relay-http` with its status; the class stays (every streaming link shares `streamingTransportFetch`)
- Gemini Interactions: run failures and budget stops are written as text content (`appendText('_Deep Research run is ..._')`), not issues. **Closed**: failures are `service-error` records, `budget_exceeded` a notice, the `incomplete` note is gone; the non-streaming Recover diagnostics stay (Open)

### Retry

- Gemini: in-stream `503 UNAVAILABLE` is real (seen as `error` events after HTTP 200) and is shown, not retried; retry only while nothing has streamed
- [Gemini, 2026-11-10, hypothesis: deadline errors on two models] an error before the first event is the HTTP status (504), on the fetch path; inside the stream it always follows content, so "nothing has streamed" does not occur there
- Gemini: "Deadline expired before operation could complete" comes under two statuses: `504 DEADLINE_EXCEEDED` when the request's own deadline expires (the `X-Server-Timeout` header, which we do not send), `503 UNAVAILABLE` from Google's side (#1287). Classify by status, not by message
- A last attempt that goes through and then fails for another reason still reads "Gave up after N attempts": the reassembler cannot tell it from the same error returning
- Anthropic: a zero fast mode rate limit is matched by message text in the fetch retrier, not by a typed cause
- Groq 498 (flex tier at capacity) is not retried; it belongs to the overloaded class
- OpenRouter HTTP 503 means no provider meets the request's routing configuration, not a transient fault; it is retried as transient
- HTTP 500 is not retried at connect
- Bedrock Invoke (Anthropic models): a `{message}` exception payload throws in the parser's error handler (P53 in [AIX-ingestion.md](../AIX-ingestion.md)) before any retry classification; Converse reads it
- Unverified: a Gemini per-minute 429 may match the `quota` text denylist and not be retried; needs a free-tier probe

### Retry after partial output (#1211, #1287)

Left for the rework by the author's ruling.

- Today the dialects disagree: OpenAI Responses retries a transient failure even after answer text has streamed, clearing it; Chat Completions stops retrying once any output has streamed
- Asked in #1287: "Fixing diagnosis should not automatically restart a long, partially completed request". In [#1211](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536775910): restart only on clear cases, like a busy flex tier or a dropped connection with an empty response; the author [agreed](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536859013) and [reopened](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6565761327) it for a configurable "Retry transient errors within [N] minutes"

### Replay

- Assistant error fragments are replayed as `[ERROR] ...` model text when the turn has other content (Q1 in [AIX-ingestion.md](../AIX-ingestion.md)). A turn of errors alone is not sent: an interim turn-shape rule in the request builder, for a per-error replay policy to replace. **Partly closed**: replay is per record (`aixIssueReplayText`, parity with `main`); the errors-alone rule stays
- Measured (a question, a stored 402 rejection turn, a new question; 9 models, 3 runs each): with the error replayed the first question went unanswered on 8 models (24 of 24) and was answered on Opus 5.5; left out, it was answered every time. "What happened?" was explained only when replayed. A neutral marker did no better than the error text
- Still sent as an errors-only model turn: reasoning followed by an error (most adapters drop the reasoning), and an error after a tool result in a tool loop (the adapter splits the message). Frequency not measured
- A change to the replay rule changes the prefix of every stored conversation it touches: once, Anthropic drops the thinking replayed after it (`prefix_binding_mismatch`, measured on Opus 5.5) and the prompt cache misses

### Stream mechanics (ideas)

Light pointers for whoever builds this, so these get looked at. Not a design. **Closed**: built as the parser API's two commands (above); the stopgap comments are gone.

- `setDialectTerminatingIssue` packed three things in one call: it reported the issue, failed the message, and stopped the read. **Closed**: `addDialectIssue` states the issue, `setDialectEnded` stops the read
- This likely changes the whole chain of functions that produce particles (what the parsers call, the transmitter, the read loop, the end), not that one call; some of today's calls become more than one
- Disposition (keep parsing or stop) and outcome (does the message fail) are two things; an issue alone is no reason to close
- What arrives after an error is worth reading: see the next section

### What the vendors send around an error (measured)

The wire a new design has to fit. Not a design: the direction is the author's, under "From the author".

- OpenAI Responses: `response.failed` followed the `error` event in 18 of 18 live runs. It repeats the message and adds the item list and `tool_usage`, never `usage`; its code can be the placeholder `unknown` where the `error` had a type and a param
- OpenAI Responses: an `error` after answer text is not a verdict. No `.done` event precedes it, and in 10 of 10 rate-limit cases the message inside `response.failed` was complete. Such an answer comes with no `usage`
- OpenAI: rate-limit `error` events carry `error.headers`, with `retry-after-ms`
- OpenRouter (2 captures, 5 production log lines): after the in-band error chunk come a chunk with a `finish_reason` (`tool_calls`, or `error`) and one with the billed usage
- Gemini (2 captures): after the in-stream error frame only an unframed copy of it follows, then the stream ends
- Gemini: the error object is Google's standard one ([AIP-193](https://google.aip.dev/193#http11json-representation)): `code`, `message`, `status`, and `details`, a list of typed entries. No in-stream error carried `details` (2 captures, 3 bodies logged in #1287). HTTP errors do, live: a bad key (`ErrorInfo` with reason `API_KEY_INVALID`, `LocalizedMessage`), an unknown field or a bad enum value (`BadRequest`); not a 404, a 504, or four other 400s. The fetch path shows the message only
- Anthropic: no in-stream error captured
- Bedrock: exception frames inside a stream name the failure in the `:exception-type` header. From the AWS event-stream format, not reproduced live
- [xAI, 2026-11-09, hypothesis: one capture] a reply that reaches the context window ends `response.completed`, cut mid-sentence, total tokens 6 under the window: nothing on the wire says it was cut

### Asked on #1288, not done

- The error keeps its type, code, message and param, and the response and event ids. **Partly closed**: code or type in `causeCode`, the message in `text`, other fields in `detail`; the ids are not kept
- A final failure less specific than the earlier `error` does not replace it. **Closed**: the kept event's facts beat the placeholder `unknown`
- Multiple errors are preserved (the stopgap keeps the last). **Partly closed**: every issue is stored at its place; a second kept error replaces the first
- Replay test rows (`chatGenerate.replay.test.ts`) for the rest of the #1288 cases, built from the real container-deleted stream: error then `response.incomplete`, error then `response.completed`, a read failure after the error, Stop after the error, `response.failed` with `error: null`
