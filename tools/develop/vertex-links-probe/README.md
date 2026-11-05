# vertex-links-probe

Live probe of Gemini grounding redirect links (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`): where Gemini
puts them, how the redirect host answers, and what breaks it. It retakes the measurements the resolver in
`src/modules/google/vertexai.client.ts` rests on.

```bash
GEMINI_API_KEY=... npx tsx tools/develop/vertex-links-probe/probe.ts fresh gemini-4-argon 6 /tmp/links.json
npx tsx tools/develop/vertex-links-probe/probe.ts burst /tmp/links.json 64,256,512,1024
npx tsx tools/develop/vertex-links-probe/probe.ts expired
```

`fresh` streams answers the way the app requests them, with Search, URL Context and server-side tool invocations, and asks
for a markdown Sources list. It HEADs each link the moment it appears, then again at +1s and +5s. Text is scanned once
complete: mid-stream it holds cut-off links, which 404.

## Measured 2026-11-05

Residential connection, Node fetch, HEAD with `redirect: 'manual'`.

| Model | Calls | Complete links | First sight p50 | First sight p99 | Answers | Calls with links in the text |
|---|---|---|---|---|---|---|
| gemini-4-argon | 6 | 73 | 209ms | 234ms | all 302 | 6 |
| gemini-3.8-flash | 8 | 150 | 214ms | 249ms | all 302 | 4 |

The same links at +1s and +5s answer identically: no warm-up, no propagation delay.

Burst on 252 gemini-2.5-flash links:

| In flight | Requests | p50 | p99 | Failures |
|---|---|---|---|---|
| 64 | 252 | 0.23s | 0.29s | none |
| 256 | 512 | 0.68s | 2.1s | none |
| 512 | 1,024 | 1.3s | 3.9s | none |
| 1,024 | 2,048 | 2.7s | 10.1s | 39 connect timeouts |
| 256, sustained | 4,096 | 0.61s | 1.9s | 19 connect timeouts |

About 8,400 requests in two minutes drew no 429 or 5xx.

## Findings

- **Where links appear.** Grounding chunks arrive on the final event. URL Context tool calls and responses carry them
  mid-stream, which is what the live "Fetching" and "Retrieved content" chip tooltips show. The answer text carries them
  when the model lists its sources: Argon did in every call. Deep Research writes them into the text (#1114, not retaken).
- **Answers.** A complete link answers 302 in about 0.2s from first sight. 404 is final: an expired link or a malformed
  token. Failures are connection-level, under load, and a fresh attempt recovers them; waiting longer does not.
- **Miscopied links.** A link the model writes into its text can be a bad copy: in a 4-call Argon retake, 1 of 55 links
  shared its first 81 characters with a live link, was one character shorter, and answered 404 every time.
- **Lifetime.** Links expire: 302 at 8 days, 404 by 58 days, measured 2026-06-19. The `expired` samples, created
  2026-06-11, are 404. Resolving at generation time keeps the destination; a manual resolve on an old chat finds them
  expired. Consider `resolve` as the default policy so links are captured while fresh.
- **Not measured.** Latency and connection limits from the Vercel Edge runtime. The server logs each call with unresolved
  links as `[Vertex AI links] unresolved in <ms>, of <n>`, with a count per reason.

Expectations on a retake: every complete link 302 at first sight with p99 under 0.5s, the `expired` samples 404, and no
429 or 5xx in `burst` up to 512 in flight. Retake when touching the resolver, on reports of links left unresolved, and to
track the lifetime.
