# AIX - Transport Errors

How a broken connection surfaces on each path, what classifies it, and what Vercel does to long streams. Snapshot measured 2026-10-29 on Vercel previews of the `big-agi` project (Edge and Node functions, iad1, 300s function limit), @trpc 11.19.0 vs 11.22.1, Chrome 154, Safari 27.2, Firefox 159.

## Where errors are classified

Every failure becomes one record, `DAixIssue` (`src/modules/aix/shared/aix.issues.ts`: the codes and the texts; `aix.issues.policy.ts`: what a code means for the retry, the replay and the presentation). The record is built where the failure is seen and carried unchanged: from the executor side in an `aix-issue` particle, from a throw by the client, and stored as an `aix.issue` part. The layers, the code table and the rules: [aix/AIX-TODO-errors.md](aix/AIX-TODO-errors.md). The relay is the tRPC pipe between the client and the executor on our server; Direct Connection (CSF) has none.

| Path | Site | Builds |
|---|---|---|
| tRPC client | `streamingTransportFetch` (`src/common/util/trpc.client.ts`) | 413, `text/html` and any other non-2xx that is not tRPC's own error envelope -> `TRPCClientFetchError`, before tRPC parses them. The stream link answers 200 for every failure of a procedure, so an error status is the answer of what sits in front |
| tRPC client | `aixClassifyStreamingError` (`src/modules/aix/client/aix.client.errors.ts`) | a throw across the relay -> `relay-connect`, `relay-read`, `relay-cutoff`, `relay-http`, `relay-html`, `relay-rejected` (a tRPC code other than `INTERNAL_SERVER_ERROR`); anything else, and our procedure throwing (`INTERNAL_SERVER_ERROR`), `aix-unknown`. A Stop only when the user's signal is aborted. On the CSF path nothing is `relay-*` |
| Both | `BlockPartAixIssue` | `relay-cutoff` -> the Connection Terminated card with the Direct Connection toggle (off and disabled, with the reason, where it cannot be used); `relay-http` 413 -> the Request Too Large card; any other record: a block (label or service name, sentence, detail, advice, Details with the facts row) or a chip, by `aixIssuePresentation` |
| Server dispatch, and CSF in the browser | `fetchResponseOrTRPCThrow`, `fetchWithAbortableConnectionRetry` (`src/server/trpc/`) | connect and HTTP failures -> `TRPCFetcherError` categories; connection errors get 3 attempts |
| Server dispatch, and CSF in the browser | `chatGenerate.executor.ts` and the continuation wrapper | `dispatch-prepare`, `dispatch-connect` (`causeCode` the system code), `dispatch-http`, `dispatch-read`, `dispatch-parse`, `dispatch-unknown`; `runtime` `client` or `relay` on connect and read failures |
| Server dispatch, and CSF in the browser | `ChatGenerateTransmitter`, at the end | a body closed without a dialect end and without a stop reason -> `dispatch-cutoff`; the abort signal fired with no stop reason -> `dispatch-aborted` (under a user Stop the client applies nothing after it); a dialect end with no stop reason -> `model-unfinished`, a notice. All in `aix-issue` particles |
| Both | `ContentReassembler` | no end particle -> `aix-unknown` (`no-end`); a particle that throws in processing -> `aix-unknown`; a throw after the verdict -> logged, no record |

The failure texts live in one place, `src/common/util/fetchFailures.ts`, as checks by who throws them: `isBrowserNetworkError`, `isNodeStreamTerminated`, `isEdgeConnectionLost`, `isTRPCNetworkError` (bare or wrapped in a `TRPCClientError`), `isTRPCStreamClosedEarly`, plus `isBrowserOffline`. Each site sits on one leg, uses the checks of that leg, and builds its record: the sentence is the code's, the engine text goes to `detail`.

## Browser fetch failure texts

All are `TypeError`; the Fetch spec fixes the type, not the text. Measured with a local server that fails on purpose.

| Engine | Before the response (refused, DNS, reset, CORS) | Reading the body (reset, truncated chunked, short Content-Length) |
|---|---|---|
| Chromium (Chrome 154) | `Failed to fetch` | `network error` |
| WebKit (Safari 27.2) | `Load failed` | `Load failed` |
| Gecko (Firefox 159) | `NetworkError when attempting to fetch resource.` | `Error in input stream` |

Older WebKit surfaced NSURLError texts (`The network connection was lost.` and similar); these come from field reports and are matched but not measured. Matching ignores case and a trailing period. Node (undici) throws `fetch failed` and `terminated` instead; Vercel's Edge runtime throws `Network connection lost.` (seen in its logs, not measured).

## What the user sees (11.22.1)

The record's code per event; the sentence is the code's text in `aix.issues.ts`, the engine or runtime text is the record's `detail` (shown under Details, with the facts row).

| Event | tRPC path | CSF path |
|---|---|---|
| Vercel 300s limit, Edge or Node | `Stream closed unexpectedly` -> `relay-cutoff`, the Connection Terminated card | no function in the path |
| Function process dies mid-stream | same as the limit: a clean end of body | - |
| Body ends before the first line | `Stream closed before head was received` -> `relay-cutoff` | - |
| Connection reset or cut mid-stream | bare `TypeError` -> `relay-read` | `dispatch-read`, runtime `client`, detail `<engine text>` |
| Connection fails before the response | `TypeError` wrapped in `TRPCClientError` -> `relay-connect`, with the Direct Connection turn-on row when online | `dispatch-connect`, runtime `client`, after 3 attempts; detail the engine text, cause and host; the turn-off row when online |
| Server's provider socket drops (undici `terminated`, Edge `Network connection lost.`) | `dispatch-read`, runtime `relay`, detail `<runtime text>` | - |
| Front-door 413 | `relay-http` 413, the Request Too Large card | provider 413 -> `dispatch-http` 413 |
| Front-door 5xx, 429, 401, 403, 404 (a gateway, a firewall, a platform limit), plain or JSON | `relay-http` with the status: 'Try again in a moment.', or 'Reload the app, then try again.' for 401/403/404 | - |
| HTML instead of JSON | `relay-html` | - |
| Our server's procedure throws | `aix-unknown`, `causeCode` `INTERNAL_SERVER_ERROR` (an executor throw is `dispatch-unknown` before it gets there) | `dispatch-unknown` |
| Provider closes the body with no end event and no finish reason | `dispatch-cutoff` | same |
| Provider ends (`[DONE]`) without a finish reason | `model-unfinished` notice, outcome completed | same |
| Stop | aborted, no record stored (the executor's closing `dispatch-aborted` is not applied) | same |
| The relay fails after the verdict (the end applied, or an issue that failed) | logged only, see AIX-outcome.md (Issue after the stop reason) | same |

When the browser reports no network (`navigator.onLine === false`, `isBrowserOffline`), the record carries `offline`: the advice reads "You appear to be offline." and a connect failure offers no Direct Connection row.

On 11.19.0 the 300s cut surfaced as a minified `TypeError` (`i is not iterable` on V8, `undefined is not an object (evaluating '[s,l,u]')` on JSC) and, before the result envelope, as a wrapped `TypeError`; the classifier reads both as `aix-unknown`.

## Vercel behavior

- **300s limit.** Edge and Node functions end with `Vercel Runtime Timeout Error: Task timed out after 300 seconds`. The client reads a clean end of body. No `finally` block and no abort signal runs in the function.
- **Edge runs on Node.** `runtime = 'edge'` routes see the `EdgeRuntime` global, while Vercel's logs report `runtime: nodejs24.x`; the limit and the kill are the same as Node.
- **Stop never reaches the function.** A client abort fires neither `req.signal` (`ctx.reqSignal`) nor the procedure `signal`; tRPC 11.22's body-cancel abort does not trigger either. After an abort at 8s, `aix.chatGenerateContent` kept consuming its upstream until the 300s kill (291 particles), and a relay procedure with the same `fetch(..., { signal: ctx.reqSignal })` wiring kept reading - in Chrome, Safari and Firefox, on Edge and Node. A stopped non-CSF generation keeps the provider call running, and billing, until it ends or the limit hits. CSF closes the provider connection from the browser.
- **One connection per host.** Chrome multiplexes every stream to a host over one HTTP/2 connection; one reset (seen once, 79s in) failed all 12 parallel streams at once with `network error`. Beam rays share that connection.
- An uncaught exception thrown from a timer in an Edge function does not end the invocation.

## Stop on Vercel: fix options

| Option | Covers | Cost |
|---|---|---|
| On Stop, cancel at the provider through the upstream handle (`aixDeleteUpstreamContent_orThrow`, already used by Beam reattach and the chat's delete action) | runs with a handle: OpenAI Responses with resumability, Gemini Interactions | one call on Stop; nothing for runs without a handle |
| Direct Connection (CSF) for long runs: Stop closes the provider connection from the browser | CSF-capable vendors | CORS-capable vendors only |
| A stop call keyed by run, checked by the running function | every vendor on the tRPC path | state shared across function instances (a KV store), polled in the stream loop |
| A shorter function limit | bounds the waste | cuts legitimate long runs |

## tRPC stream-close shape by version

| tRPC | Mid-stream cut throws | Upstream |
|---|---|---|
| <= 11.5.1 | `Error('Stream closed')` | - |
| 11.6 - 11.13 | bare `undefined` | PR #6960 introduced it; trpc#6989, big-AGI #857 (pinned 11.5.1) |
| 11.14 - 11.19.0 | `TypeError`, engine-dependent text | PR #7233 |
| >= 11.20 (npm: 11.22.1) | `Error('Stream closed unexpectedly')` | trpc#7603, PR #7604 |

## Open

- The Stop leak above: the server cannot learn about the abort on Vercel; a fix needs another signal (a stop call, or the provider's own cancel).
- Client-side retry is off (`new AixStreamRetry(0, 0)`): its policy is open. `shallRetry` reads the record's policy `recovery` and `httpStatus`; an abort during the backoff ends `aborted`; a throw after the verdict is not retried.

## Re-measuring

Push a branch with a throwaway probe page and synthetic endpoints (a stream that outlives 300s, a fake OpenAI-compatible upstream, a relay that fetches it with `ctx.reqSignal`), open it in each browser, and log results with `console.log` to read from the Vercel logs. Browser texts need a local server that resets or truncates connections. HTTPS pages reach `http://127.0.0.1` from Firefox, and from Chrome after the Local Network Access prompt; Safari fails them, `localhost` included, with `Load failed` and no prompt. To run the app's own code in every browser, serve the test page from the local server over HTTP: an esbuild bundle of the tRPC client, the classifier and `clientSideChatGenerate`, with the `next.config.ts` client mocks and a `process` shim.
