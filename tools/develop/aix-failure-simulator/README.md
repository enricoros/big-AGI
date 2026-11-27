# AIX failure simulator

Makes any failure of an AI call happen on demand, with the real code in between: a service that answers as the
vendors do, a relay that breaks our own server's hop, and a driver that runs it all and prints one row per case.
What each failure should store and show is in `kb/modules/aix/AIX-TODO-errors.md`.

```
browser app  --relay hop-->  our server: executor, retriers, parser  --vendor hop-->  AI service
                 relay.mjs                                               service.mjs
     (Direct Connection: the browser makes the vendor hop itself)
```

The committed gates stay in `npm test`: `chatGenerate.replay.test.ts` (captures through the parsers) and
`aix.issues.chain.test.ts` (a stubbed `fetch` through the executor chain). The simulator adds what they cannot: real HTTP, the
retriers' waits, a refused or reset connection, a stalled stream, the relay hop, and a browser.

## Reproducing a failure

Place it on its hop first:

| What happened | Where it is reproduced |
|---|---|
| The vendor answered an error status, or its connection broke | the service: a defect on `ok` (`http429x2`, `reset4`, `stall4`) |
| The vendor's stream said something wrong (an error event, a refusal, a failed tool, an odd finish) | the service: a capture; none fits: record one (`tools/data/aix-replay/README.md`), and hand-build only what cannot be captured |
| Our own server's hop broke (the edge network, a gateway, the function killed) | the relay: a fault (`http413`, `cut8`, `noend`, `down`) |
| The browser itself (how it words a dropped connection, a hidden tab, media) | a browser, on the relay's port |

Then, in this order:

1. Find the case: `run.ts --list`. Missing: add the capture, or one scenario function (Extending, below).
2. Node first: `run.ts <words> --verbose`. Read each row against the codes table of the KB doc: outcome, issues, end, retries.
3. For a code change, rows before and after: `--json before.json`, change, `--json after.json`, `--compare`. Every row
   that differs is explained, or it is a regression. Two checkouts compare the same way (`TREE=`).
4. The relay hop: `start.mjs` on its own ports, then `run.ts --relay <url>`.
5. A browser only for what Node cannot tell (Limits, below): the browser pass runs its cases by itself; a new one is a
   row in `browser/cases.json`.
6. What must keep holding goes into the committed gates, not here: a row in `aix.issues.chain.test.ts`, or a capture
   with its row in `chatGenerate.replay.test.ts`.

Use your own ports, and never stop or restart a server that was already running. Report rows, not impressions: the
case id, what was expected, what came back. Stop what you started: the launcher, its app server, any tab.

## Parts

| File | What it is |
|---|---|
| `service.mjs` | One port that answers as OpenAI (Chat Completions, Responses), Anthropic and Gemini |
| `relay.mjs` | A proxy in front of the app's server that breaks the relay hop |
| `run.ts` | The driver: every scenario through the real chain, rows to read, save and compare |
| `start.mjs` | Service, app server and relay in one command, for a browser |
| `browser/runner.js`, `browser/cases.json` | The pass a browser runs by itself: the script the relay injects, and its cases |
| `lib/dialects.mjs` | The wire grammars: routes, model lists, error bodies, hand-built scenarios |
| `lib/captures.mjs` | The capture corpus (`tools/data/aix-replay/generations`) as scenarios |
| `lib/defects.mjs` | The one defect vocabulary both hops use |

## A model id is a scenario

```
<dialect prefix><scenario>[~<defect>]        sim-ok      claude-sim-ok~cut4      gemini-sim-gemini-3.5-flash-lite_finish-SAFETY_after-text
```

| Dialect | Prefix | Service to add in the app |
|---|---|---|
| OpenAI Chat Completions | `sim-` | OpenAI |
| OpenAI Responses | `gpt-5-sim-` | OpenAI (the same one) |
| Anthropic Messages | `claude-sim-` | Anthropic |
| Gemini generateContent | `gemini-sim-` | Gemini |

A scenario is what the service answers: a capture, by its file name, or a hand-built answer for what no capture shows
(`ok`, `length`, `filter`, `stream-error`, `pause-forever`, `prompt-blocked`, `bad-image` ...: `GET /__sim` lists them).
A paused turn's parts are served in order, one per request.

A defect is what the transport does to that answer:

| Defect | The hop |
|---|---|
| `http<status>` | answers with that status, and the body its kind of server sends |
| `refuse` | resets the socket before any response |
| `html` | answers a 200 HTML page: a Wi-Fi sign-in page, a gateway |
| `cut<N>` | ends the body cleanly after N chunks |
| `reset<N>` | resets the socket after N chunks |
| `stall<N>` | after N chunks sends nothing more and keeps the connection open |
| `garbage<N>` | replaces chunk N with one that is not JSON |
| `slow<ms>` | waits between chunks |

`x<K>` on the first three: K requests in a row get it, the next passes (`http429x2`: fail, fail, pass). `+` joins:
`http503x1+slow200`. A chunk is one SSE event on the vendor hop, one line of the tRPC stream on the relay hop. A defect
placed past the end of a short body lands on its last chunk.

The relay adds its own: `json<status>` (a JSON body that is no tRPC envelope), `badinput` (the call without its
`access`: a real tRPC `BAD_REQUEST`), `noend` (the stream without its end particle), `badparticle` (an issue particle
with no record), `down` (every request reset: the server is unreachable).

## Commands (from the repo root)

**The driver.** No setup: it starts its own service on a free port.

```bash
npx tsx tools/develop/aix-failure-simulator/run.ts                  # every case
npx tsx tools/develop/aix-failure-simulator/run.ts anthropic~http   # the cases whose id holds a word
npx tsx tools/develop/aix-failure-simulator/run.ts --list           # the cases
npx tsx tools/develop/aix-failure-simulator/run.ts --models         # what the app's model listing makes of the service's lists
npx tsx tools/develop/aix-failure-simulator/run.ts --json a.json    # save the rows
npx tsx tools/develop/aix-failure-simulator/run.ts --compare a.json b.json
```

A row is the outcome, the issues stored (code, effect, status, cause code), the end particle, the retries and
continuations. Two cases need no service: `settings/closed-port` (nothing listens) and `settings/bad-gateway-host` (a host
the dispatch refuses to use). Two trees are compared by their rows: `TREE=<other checkout> npx tsx --tsconfig
<other checkout>/tsconfig.json tools/develop/aix-failure-simulator/run.ts --json b.json`, then `--compare`.

Each capture runs through its own vendor's dialect (OpenRouter, DeepSeek and Sakana too). xAI's service takes no API
host, so its captures are replayed by `chatGenerate.replay.test.ts` only.

**A browser.**

```bash
node tools/develop/aix-failure-simulator/start.mjs                              # or: --app http://localhost:3000
```

Open the relay's URL it prints, in one tab (the app is single-instance per origin). Add the OpenAI, Anthropic and Gemini
services with the API host `http://127.0.0.1:8791`, then any key. **The host first**: a setup panel lists models as soon
as it has a key, and a key typed before the host goes to the real vendor. Every scenario is then a model, `ok ~ <defect>`
included, but for `stall`: the app titles a chat with a listed model of its own choice, and one that never answers would
hold a connection per turn. Any other defect is armed for the next request:

```
http://127.0.0.1:8791/__sim?defect=reset4          the vendor hop     [&count=1][&match=claude]
http://localhost:3405/__sim?fault=cut8             the relay hop      [&count=1][&ctx=conversation | *]
```

A relay fault needs the call to cross the relay: on a service with Direct Connection on, the browser reaches the vendor
by itself and only the service's defects apply.

**A browser, by itself.** With the OpenAI service added once in that browser, open

```
http://localhost:3405/__sim/browser                 or ?only=relay, ?only=direct
```

and the app's page runs `browser/cases.json` on its own: it picks each model, arms the relay, sends, reads the stored
message back, and reports each row to the relay's output and to `GET /__sim/report`. Two phases with a reload between
them: calls through our server, then Direct Connection, which it puts back as it found it. Any browser that opens the
URL will do, which is how one engine's wording of a dropped connection is compared with another's.

**The relay layer in Node**, against a running relay: `npx tsx tools/develop/aix-failure-simulator/run.ts --relay http://localhost:3405`.

## Extending

- A capture: add it to `tools/data/aix-replay/generations/<vendor>/` (its README has the rules). It is a scenario at once.
- A hand-built answer: one function in its dialect's `scenarios` (`lib/dialects.mjs`).
- A dialect, or a vendor folder served by an existing one: one object, or one name in `vendors`, in `lib/dialects.mjs`; the
  driver reaches a vendor through its entry in `ACCESS` (`run.ts`).
- A defect: `lib/defects.mjs`; both hops get it.

## Limits

- Node words a refused or reset connection unlike a browser: on the relay layer those two rows read `aix-unknown` in
  Node, and are final only in a browser.
- Media scenarios (`image`, `bad-image`, `bad-audio`) decode in the browser: in Node an image is always lost.
- The relay knows the chat generation call only; other procedures pass untouched.
- The browser pass works the app through its page (the model picker, the composer) and reads the open-source build's
  storage: a change to either breaks it, and on the hosted build it finds no stored message.
- Chrome retries a refused connection once by itself: the pass refuses eight in a row to get a refusal.
- The service counts requests per model to serve parts and `x<K>` cycles; a run that stops halfway is forgotten after
  30 seconds of silence, or at once with `/__sim?reset`.
- The service does not look at the request body beyond the model: it answers the scenario, whatever was asked.
