# AIX replay fixtures

Recorded vendor traffic that tests replay through the real AIX code, with only the network replaced. One folder per kind of replay; `generations` is the only one so far.

Not the same as `tools/develop/aix-protocol-lab`, which records and analyzes traces of its own.

## generations

One vendor reply to one chat-generate request, as received: `generations/<vendor>/<model>_<what it shows>[_nonstream]`.

Replayed by `src/modules/aix/server/dispatch/chatGenerate/chatGenerate.replay.test.ts`, part of `npm test`. The test runs each capture through the chat-generate chain (continuation, retry, executor, demuxer, parser, transmitter) in four groups:

- **All captures: invariants**: rules that hold for any vendor response, one test per rule over the captures of all vendors. It parses in strict mode, ends once, ends clean unless it is listed as an unclean ending, and delivers the vendor's answer text, reasoning text, function calls, error text and token totals. All read off the capture itself, so a capture added to a vendor folder is checked from then on.
- **Unclean endings**: one row per ending that is not a clean finish (cut by the output limit, refused, filtered, failed inside a 200 stream), with the stop reason and the words the user gets.
- **One group per vendor API**: what only that API does. What a hosted tool run counts as, what a paused turn sends back, what a failed step leaves behind.
- **Not covered yet**: what the test does not check (hosted tool inputs and results, citations, a streaming capture against its non-streaming twin, the message the client ends up with), and what nobody has decided.

A test states what is right, from the vendor's own data or from a written rule (`kb/modules/AIX-ingestion.md`, `AIX-outcome.md`), never from what the chain does today. Where the chain does not do it yet, the test is marked `notYet` with what happens instead: it runs, and is reported as skipped with that reason for as long as it fails. The day it passes it fails, so that the mark is removed. Where nothing is decided, nothing is asserted.

### Files

- `<name>.sse`: a streaming response body, byte for byte. `<name>.json`: a non-streaming body. HTTP 200 only. Git is told not to touch their line endings: Gemini sends CRLF (the Gemini captures taken before 2026-11-09 were saved with LF).
- `<name>.req.json`: the request that produced it. The body alone, or `{ body, betas?, headers?, note? }` when the body does not tell the whole story: `betas` are Anthropic beta header values, `headers` other request headers the capture needs, `note` what else it took (a manual step, a cut, a mask) or why `body` is null. No request file: the request was not saved.
- `_1-initial`, `_2-continuation`: the responses of one paused turn, replayed as one generation.
- `_synthetic`: a real capture cut by hand, as its note says.
- No keys and no account ids. Thinking signatures, encrypted reasoning and container ids are the vendor's and replay only on the account that made them.

### Adding a capture

Send the request body, save the response bytes unchanged:

```bash
curl -sS -N https://api.openai.com/v1/responses -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d @name.req.json -o name.sse
```

A response that does not end clean needs a row in the test's `ENDINGS`; a new vendor folder needs a row in its `VENDORS`.

A capture earns its place by making the chain run code that no other capture runs, or by backing a row of the test. Another model or another prompt for a shape that is already here does not.
