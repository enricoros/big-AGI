# LLM pricing - direction

🧭 Target shape for pricing and usage accounting, and the incremental path from what shipped on 2026-09-03 (`LLM-pricing-pipeline.md`). Grounded in live probes on four vendors, twelve aggregator catalogs, eleven provider usage objects, and every server-side loop we drive (2026-09-03).

## Findings that fix the design

1. **Six concepts cover the head**: input, output, cache read, cache write, one context tier, one web-search fee. Twelve catalogs converge on the four token classes and diverge on everything else. LiteLLM needs 41 keys for 95 percent coverage and still cannot express batch with cache; a structured shape needs two additions.
2. **The tier is one request-level switch.** Trigger: total prompt tokens including cache. It reprices the whole request, every class, output included. 87 of 87 LiteLLM entries with a 200K input tier carry the matching output tier. Spelling it per class (our `upTo` arrays) stores one boolean four times.
3. **Units are the hazard.** The same `web_search` key is $ per call on OpenRouter and $ per 1,000 on Vercel for the same model. Portkey is in cents. OpenRouter `image` is a token price. Every non-token price needs its unit in the name or beside the number.
4. **Orthogonal axes are multipliers**, never restated prices: service tier (OpenAI flex 0.5, fast 2; Gemini priority 1.8; Anthropic batch 0.5), region (10 percent at five vendors), off-peak clocks. The served tier echo corrects the requested one.
5. **Usage is a disjoint partition.** Nine providers report cache inclusive of input, two additive (Anthropic, Bedrock). Gemini puts thoughts outside candidates and tool-use tokens outside the prompt. xAI flips convention between its own endpoints. Langfuse and OpenTelemetry independently arrive at "each token counted in exactly one key". Our parsers already normalize to that at parse time; the one exception is reasoning as a subset of output, which breaks when reasoning bills at its own rate (Perplexity Sonar).
6. **Loops do not double count today.** Three under-counts: Anthropic `pause_turn` chains report the last turn only (each turn has its own transmitter, last `set-metrics` wins), an XE tool-loop message keeps only its last iteration, and a failed attempt drops the input the vendor billed. Reattach is safe only because usage arrives on the terminal event.
7. **Multi-model responses cannot be flattened.** Anthropic advisor and compaction put two models' usage at two rate cards in one response; top-level input excludes compaction (45K reported, 203K billed in the documented example). Neither is adopted; the record needs a slot before they are.
8. **Real money nobody encodes**: Gemini cache storage per token-hour, free tool-call quotas with a period, scheduled price changes (Gemini publishes two prices with a switch date in one cell today; Sol's promo ends 2026-11-21).
9. **Zero is overloaded** as free, unknown, and not applicable. Keep `'free'` distinct from 0, absent as unknown. Two ingest paths launder unknown into free (Novita flat zeros, xAI `search_price: 0`).

## Target

### Rate card (per model)

```ts
chatPrice: {
  input: 10, output: 50,                                   // $/M tokens; number | 'free'
  cache: { read: 1, write: 12.5, write1h?: 20, minTokens?: 1024, storagePerTokenHour?: 4.5 },
  reasoning?: 3,                                           // only when reasoning bills apart from output
  modality?: { audioIn?: 0.5, audioOut?: 8, imageIn?: 8, imageOut?: 30, videoOut?: 17.5 }, // $/M tokens; absent = text rate
  tiers?: [{ over: 272000, input: 20, output: 75, cache: { read: 2, write: 25 } }],  // ONE switch on total prompt tokens; partial overlay, replaces
  per1KCalls?: { webSearch: 10, xSearch: 5, mapsGrounding: 14 },  // unit in the container name
  perSession?: { codeExec: 0.03 }, perHour?: { container: 0.05 },
  quotas?: { webSearch: { free: 5000, per: 'month' } },   // upper-bound note, never subtracted
  schedule?: [{ from: '2027-01-01', input: 1.5, output: 7.5 }],  // partial overlay, resolved at cost time
  x?: { fast: 2, flex: 0.5, priority: 1.8, batch: 0.5, region: 1.1 },  // named request-level multipliers, per model
}
```

Rules: prices are per model, never vendor ratios (cache read is 0.1x on most Claude, 0.025x on Fable 5.1). Absent means unknown, and a class with no price bills at its registry parent (write at input, reasoning at output, modality at text) with `partial-price` set.

Multipliers: the card owns the rate (`x.fast: 2` on Opus 5, `6` on Opus 4.6), the parameter is only the request switch, and the parser emits the served tier as a tag (`fast`, `flex`, `standard`, plus `region`) that the finalizer resolves against the card. Today the rate sits in the parameter registry (`enumPriceMultiplier` on `llmVndAntInfSpeed` and `llmVndOaiServiceTier`) and the parser emits a number (`$xPrice`) only when it can compute it without the model, which loses the fast rate on a downgrade-free fast response paired with a region uplift. Moving the rate into the card removes that gap and gives prediction (composer, modal, ranking) and confirmation (echo) one source.

### Usage record (wire and at rest)

```ts
metrics: {
  u: { in, inCacheRead, inCacheWrite, inCacheWrite1h?, inTool?, inAudio?, inImage?, out, outReasoning, outImage?, outAudio? }, // disjoint leaves, T = sum
  n?: { webSearch, xSearch, webFetch, codeExec, imageGen },   // per-unit counts, separate map (different units)
  chk?: { in, out, all },                                      // provider totals as check digits: warn on mismatch, never sum
  sub?: [{ kind: 'advisor' | 'compaction' | 'fallback' | 'imageGen', modelRef, tier?, u, n? }], // usage billed on another rate card
  $cReported?, $xPrice?, dtStart?, dtInner?, dtAll?, vTOutInner?, TsR?,
}
```

A compile-time class registry declares each leaf's direction, cache class, modality, kind, and `priceParent`. The calculator iterates the registry: `$[cls] = u[cls] * rate(cls)[tier] / 1e6`, `$n[k] = n[k] * fee[k] / unit`, plus `sum(cost(sub))`. Reasoning becomes a leaf carved out of output, so the sum has no exception. Parsers subtract inclusive providers down to leaves, pass additive providers through, and fill `chk` from the raw totals.

### Cost lines (per message) and aggregation

A message carries a rollup (`generator.metrics`, today's shape upgraded) plus optional `generator.lines[]`: one line per AIX call (tool-loop iteration, continuation segment) and one per `sub` entry, each with `modelRef`, `u`, `n`, `$c`, `$cReported`, `$xPrice`, `$code`, and `segment: { turn, attempt, superseded }`. Message total is the sum of non-superseded lines. Chat and service totals pivot lines by model, class, and day. Service totals are keyed by generation id, so a reattach, resume, or re-finalize adds at most once.

### Dedupe contract

- A `set-metrics` particle is a cumulative snapshot of the logical generation, never a delta.
- Continuation banks, retry replaces. Superseded attempts stay as lines flagged superseded: the vendor billed them.
- Price by the served model (`response.model`, fallback iterations, router choice), not the requested id.
- Count-known, price-unknown is a first-class outcome (`partial-price`), never zero.

## Incremental path

| Step | Scope | Migration |
|---|---|---|
| 0 (shipped 2026-09-03) | one cache shape with write; `tools.webSearch`; `$xPrice` from the served tier; per-class cost fields; parser fixes on Responses, Anthropic delta, Gemini tool tokens, Bedrock cache, xAI ticks; OpenAI service-tier parameter | none: the defs buckets roll and clients re-list |
| 1 | hoist tiers to one `tiers: [{ over, ...overlay }]`; unit-named fee containers (`per1KCalls`); fix the two unknown-as-free ingests; Anthropic `write1h` + parse the TTL split from `message_start`; split `nWebSearch` into per-tool counts | store-llms v7 (per-class `upTo` to overlay), defs sweep on ~20 tiered entries, OpenRouter mapping |
| 2 | usage record v2: `u`/`n`/`chk` maps and the class registry; reasoning as a leaf; modality classes where reported; calculator and tooltip iterate the registry; multipliers move from the parameter registry into the card (`x`), parsers emit the served tier as a tag | wire: particle carries `u` and the tier tag; at rest: read-time upgrade of v1 fields, no bulk migration |
| 3 | cost lines and `sub[]`: continuation turns and XE tool-loop iterations each a line, rolled up (continuation banks, retry replaces); image generation through tools priced on the image model's card; service totals idempotent by generation id | additive message field |
| 4 | schedule overlays; quotas as tooltip notes; cache storage per token-hour (needs a service-level home, not a message); containers counted and priced where per-call | defs only |

Step 1 is the smallest change with structural payoff. Step 2 is the forward-compatibility step: after it, a new billable class is a registry entry, a parser line, and a def price.
