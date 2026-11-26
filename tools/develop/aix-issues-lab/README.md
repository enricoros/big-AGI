# AIX issues lab

A mock OpenAI-compatible service that plays one failure per scenario: a live target for the running app, to see how
each failure is stored and shown (`kb/modules/aix/AIX-TODO-errors.md`).

`src/modules/aix/client/aix.issues.chain.test.ts` is the committed gate: the same bodies through a stubbed `fetch`, the
real executor chain and the real `ContentReassembler`, for the scenarios that need no retry wait. The mock adds the
retry waits, a closed port, a Stop mid-stream, and the browser.

## Usage (from the repo root)

```bash
node tools/develop/aix-issues-lab/mock-service.mjs [port]           # default 8791
```

Add an OpenAI service with the API host `http://127.0.0.1:8791` and any key; the model list holds every scenario.
CORS is open, so Direct Connection works too.

## Scenarios

The model id picks the scenario: `mock-<scenario>`.

| scenario | the service |
|---|---|
| `ok`, `length` | answers, finish `stop` / `length` |
| `no-finish`, `empty` | text and `[DONE]` with no finish reason / `[DONE]` alone |
| `http401` `http402` `http403` `http404` `http500` | a JSON error body with that status |
| `http413` | 413 in plain text |
| `http429`, `http503` | retried by the connect retrier, then given up |
| `html` | a 200 with an HTML page (a Wi-Fi sign-in) |
| `rst-pre` | socket reset before the response: retried, then given up |
| `rst-mid`, `cut-mid` | socket reset / clean close after four words |
| `stream-error`, `stream-error-first` | an in-stream error after four words / as the first event (retried by the operation retrier) |
| `filter` | finish `content_filter` after four words |
| `garbage` | a chunk that fails the schema, then one that is not JSON |
| `late-error` | an in-stream error after the finish |
| `slow` | one word a second for two minutes: for a Stop in the app |

Non-streaming, the service answers the whole completion for every scenario but the HTTP ones, `html` and `rst-pre`.
A closed port (a service host with nothing listening) is the refused connect.
