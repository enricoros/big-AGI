# AIX - Transport Errors

How a broken connection surfaces on each path, what classifies it, and what Vercel does to long streams. Snapshot measured 2026-10-29 on Vercel previews of the `big-agi` project (Edge and Node functions, iad1, 300s function limit), @trpc 11.19.0 vs 11.22.1, Chrome 154, Safari 27.2, Firefox 159.

## Where errors are classified

| Path | Site | Turns a failure into |
|---|---|---|
| tRPC client | `streamingTransportFetch` (`src/common/util/trpc.client.ts`) | tags 413 and `text/html` responses (`aixTransportCode`) before tRPC parses them |
| tRPC client | `aixClassifyStreamingError` (`src/modules/aix/client/aix.client.errors.ts`) | thrown transport errors -> error fragment text + `aix-<type>` hint |
| tRPC client | `BlockPartError` | `aix-net-disconnected` + `**connection terminated**` -> the Connection Terminated card with the Direct Connection toggle; `**network error**` -> plain text |
| Server dispatch, and CSF in the browser | `fetchResponseOrTRPCThrow`, `fetchWithAbortableConnectionRetry` (`src/server/trpc/`) | connect and HTTP failures -> `TRPCFetcherError` categories; connection errors retried 3 times |
| Server dispatch, and CSF in the browser | `chatGenerate.executor.ts` | `[Service Issue]`, `[Streaming Issue]`, `[Reading Issue]`, `[Parsing Issue]` in-band error particles (no hint) |
| Both | `ContentReassembler` termination | a stream that ends without a terminal event -> "Response may be incomplete - the stream ended before completion." |

The failure texts live in one place, `src/common/util/fetchFailures.ts`, as checks by who throws them: `isBrowserNetworkError`, `isNodeStreamTerminated`, `isTRPCNetworkError` (bare or wrapped in a `TRPCClientError`), `isTRPCStreamClosedEarly`, plus `isBrowserOffline`. Each site sits on one leg, uses the checks of that leg, and words the message itself.

## Browser fetch failure texts

All are `TypeError`; the Fetch spec fixes the type, not the text. Measured with a local server that fails on purpose.

| Engine | Before the response (refused, DNS, reset, CORS) | Reading the body (reset, truncated chunked, short Content-Length) |
|---|---|---|
| Chromium (Chrome 154) | `Failed to fetch` | `network error` |
| WebKit (Safari 27.2) | `Load failed` | `Load failed` |
| Gecko (Firefox 159) | `NetworkError when attempting to fetch resource.` | `Error in input stream` |

Older WebKit surfaced NSURLError texts (`The network connection was lost.` and similar); these come from field reports and are matched but not measured. Matching ignores case and a trailing period. Node (undici) throws `fetch failed` and `terminated` instead.

## What the user sees (11.22.1)

| Event | tRPC path | CSF path |
|---|---|---|
| Vercel 300s limit, Edge or Node | `Stream closed unexpectedly` -> **connection terminated** | no function in the path |
| Function process dies mid-stream | same as the limit: a clean end of body | - |
| Body ends before the first line | `Stream closed before head was received` -> **connection terminated** | - |
| Connection reset or cut mid-stream | bare `TypeError` -> **network error** | `[Streaming Issue] D: the connection to D dropped mid-response (<engine text>).` |
| Connection fails before the response | `TypeError` wrapped in `TRPCClientError` -> **network error** | `[Service Issue] D: Could not connect to <host>: <engine text>. The browser hides the cause: offline, a blocking extension, or the service refusing browser requests (CORS; ...)` after 3 retries |
| Server's provider socket drops (undici `terminated`) | `[Streaming Issue] D: the connection to D dropped mid-response (terminated).` | - |
| Front-door 413 | Request too large card | provider 413 -> `[Service Issue] ... 413` |
| HTML instead of JSON | captive-portal message | - |
| Provider ends without `[DONE]` or a finish reason | "Response may be incomplete - the stream ended before completion." | same |
| Stop | aborted, no error fragment | same |
| Transport fails after a clean or truncated end | kept as is, see AIX-outcome.md (Issue after the stop reason) | same |

When the browser reports no network (`navigator.onLine === false`, `isBrowserOffline`), the network-error texts on both paths end with "You appear to be offline."; for a CSF connect failure it replaces the list of possible causes.

On 11.19.0 the 300s cut surfaced as a minified `TypeError` (`i is not iterable` on V8, `undefined is not an object (evaluating '[s,l,u]')` on JSC) and, before the result envelope, as a wrapped `TypeError` classified **net-unknown**.

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

## History of the tRPC stream-close shape

| tRPC | Mid-stream cut throws | Upstream |
|---|---|---|
| <= 11.5.1 | `Error('Stream closed')` | - |
| 11.6 - 11.13 | bare `undefined` | PR #6960 introduced it; trpc#6989, big-AGI #857 (pinned 11.5.1) |
| 11.14 - 11.19.0 | `TypeError`, engine-dependent text | PR #7233 |
| >= 11.20 (npm: 11.22.1) | `Error('Stream closed unexpectedly')` | trpc#7603, PR #7604 |

Earlier tRPC workarounds: the 10.44.1 pin (bundle size, trpc#5249), stream abort (trpc#5851), and the Edge `reading 'return'` exception (trpc#6785, big-AGI #805, fixed in 11.1.3). The `Failed to Fetch` case (capital F, 0338b3d2e99) never matched Chrome's text until it moved into `isBrowserNetworkError`.

## Open

- The Stop leak above: the server cannot learn about the abort on Vercel; a fix needs another signal (a stop call, or the provider's own cancel).
- Client-side retry is off (`new AixStreamRetry(0, 0)`) and has two latent bugs: the status is read from `error.status` (a `TRPCClientError` has none), and an abort during the backoff ends `failed`, not `aborted`.

## Re-measuring

Push a branch with a throwaway probe page and synthetic endpoints (a stream that outlives 300s, a fake OpenAI-compatible upstream, a relay that fetches it with `ctx.reqSignal`), open it in each browser, and log results with `console.log` to read from the Vercel logs. Browser texts need a local server that resets or truncates connections. HTTPS pages reach `http://127.0.0.1` from Firefox, and from Chrome after the Local Network Access prompt; Safari fails them, `localhost` included, with `Load failed` and no prompt. To run the app's own code in every browser, serve the test page from the local server over HTTP: an esbuild bundle of the tRPC client, the classifier and `clientSideChatGenerate`, with the `next.config.ts` client mocks and a `process` shim.
