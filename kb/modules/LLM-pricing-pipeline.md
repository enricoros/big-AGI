# LLM pricing pipeline

How a chat generation becomes a cost: price shape, usage parsing, metrics, the calculator, and the surfaces that show it. Updated 2026-09-03 (GPT-6 Astra, cache writes, tool fees, service tiers).

## Price shape

`chatPrice` on a model def (server `PricingChatGenerate_schema`, client `DPricingChatGenerate`), USD per 1M tokens:

```ts
chatPrice: {
  input: 10,                                   // uncached input; number | 'free' | [{ upTo, price }]
  output: 50,                                  // all output, reasoning included
  cache: { read: 1, write: 12.5, duration: 300 }, // write and duration optional
  tools: { webSearch: 10 },                    // $ per 1K calls, flat
}
```

Rules:
- One cache shape for every vendor. `write` absent means writes bill as plain input (Gemini implicit, DeepSeek, OpenAI before GPT-5.6). The former `cType` tag ('ant-bp' | 'oai-ac') is gone from the client types. The wire still carries it, derived by the server ('ant-bp' when writes are priced, else 'oai-ac') so clients built before this change keep working; current clients drop it on ingest. A persisted copy is inert and is replaced on the next re-list.
- Tiers: `[{ upTo: 272000, price }, { upTo: null, price }]` on any token class. The tier is chosen on the request's total input (uncached + cache read + cache write) and applies to every class of the request, output included. That is how OpenAI (>272K), Anthropic legacy 1M-beta and Gemini Pro (>200K) all bill.
- Per-call fees are flat: not tiered, not scaled by service-tier multipliers. The tokens a tool injects bill as input on top.
- Prices are per model, never ratios: cache reads are 0.1x input on most models but 0.025x on Fable 5.1.

Not modeled: Anthropic 1h cache writes (2x; the adapter only sends 5m breakpoints), image-generation and audio token classes, explicit-cache storage per hour, container time, Perplexity per-request fees (its reported cost covers them).

## Usage parsing

Every parser fills the same particle (`AixWire_Particles.CGSelectMetrics`):

| Field | Meaning | OpenAI Responses | Anthropic | Gemini | xAI (Responses) |
|---|---|---|---|---|---|
| `TIn` | uncached input | `input_tokens` minus cached minus written | `input_tokens` (already exclusive) | `promptTokenCount + toolUsePromptTokenCount` minus cached | as OpenAI |
| `TCacheRead` | cache hits | `input_tokens_details.cached_tokens` | `cache_read_input_tokens` | `cachedContentTokenCount` | `cached_tokens` |
| `TCacheWrite` | cache writes | `input_tokens_details.cache_write_tokens` | `cache_creation_input_tokens` | never | never |
| `TOut`, `TOutR` | output, reasoning subset | `output_tokens`, `reasoning_tokens` | `output_tokens`, `thinking_tokens` | `candidatesTokenCount + thoughtsTokenCount` | as OpenAI |
| `nWebSearch` | billed searches | `tool_usage.web_search.num_requests` | `server_tool_use.web_search_requests` | `groundingMetadata.webSearchQueries.length` | `server_side_tool_usage_details` web + X search |
| `$xPrice` | served-tier multiplier | `service_tier`: default 1, flex 0.5, priority 2 | batch 0.5 x geo-us 1.1; absent when `speed: fast` | `usageMetadata.serviceTier`: flex/batch 0.5, priority 1.8 | `service_tier` |
| `$cReported` | exact charge, cents | - | - | - | `cost_in_usd_ticks` / 1e10 (OpenRouter `cost`, Perplexity `total_cost` on Chat Completions) |

Streaming specifics: OpenAI usage sits only on the terminal event, the tier already on `response.created`. Anthropic's `message_delta` carries the authoritative input side (server tool result tokens land there, not in `message_start`). Gemini usage is cumulative on every chunk; the cache count only on the last. Chat Completions mirrors the Responses fields under `prompt_tokens_details` / `completion_tokens_details`.

Continuation turns (Anthropic `pause_turn`) each start a fresh transmitter and the last turn's `set-metrics` wins, so a chained generation reports the final turn only. Folding turns server-side is a direction item, not shipped.

## Cost computation

Once, at finalization (`_finalizeLlmMetricsWithCosts` in `aix.client.ts`), stored on the message as `DMetricsChatGenerate_Md`. Nothing recomputes history.

```
pricing  = llmChatPricing_adjusted(llm, $xPrice)   // $xPrice (served tier) replaces the parameter multiplier
tier     = TIn + TCacheRead + TCacheWrite
$cIn     = TIn * input[tier]
$cCacheR = TCacheRead * cache.read[tier]
$cCacheW = TCacheWrite * (cache.write ?? input)[tier]   // absent write inside a priced cache block = input rate
$cOut    = TOut * output[tier]
$cTools  = nWebSearch * tools.webSearch / 1000
$c       = sum, in cents (4 decimals)
$cdCache = (TIn+TCacheRead+TCacheWrite) * input[tier] - ($cIn + $cCacheR + $cCacheW)   // negative on cold GPT-5.6+ prompts; only when every cache class is priced
```

Unknown prices are the norm (dynamic vendors, OpenRouter rows without cache prices, tier gaps): a class with no price contributes nothing to `$c`, emits no breakdown key, and sets `$code: 'partial-price'`. Never an invented rate. Unknown input or output price: no `$c` at all.

`$cReported` wins over `$c` for the headline and the service totals; `$c` stays as the estimate for reconciliation. `$xPrice` is stored only when not 1.

Parameter-side multipliers (`enumPriceMultiplier` in the parameter registry) predict the tier before the response: `llmVndOaiServiceTier` flex 0.5 / fast 2, `llmVndAntInfSpeed` fast 2x or 6x. The echo corrects a downgrade.

## Surfaces

- Message tooltip (`dMessageUtils.tsx`): tokens incl. searches, headline cost, cache savings or surcharge, tier multiplier, cost by class when cache or tools are in play.
- Composer preview (`TokenTooltip.tsx`): input, max output, and the cold-prompt cache write cost on write-surcharge models.
- Service totals (`store-metrics`): cost and cache delta per service.
- Model options modal: cache read/write/duration string.
- Server analytics: token breakdown only, never cost.

## Persistence

- Model pricing: `app-models` localStorage, no version bump. A def-file change rolls the vendor's defs bucket and clients re-list, which replaces the persisted pricing.
- Message metrics: additive optional fields only (`$cIn`, `$cCacheR`, `$cCacheW`, `$cOut`, `$cTools`, `$xPrice`, `nWebSearch`); older messages lack them.

## Verification

The AIX protocol lab (`tools/develop/aix-protocol-lab`) replays real streams through the production parsers; check the `set-metrics` particle against the wire usage. Verified 2026-09-03 on OpenAI Luna (cache writes, searches, tier), Anthropic Haiku (delta input, searches), Gemini Flash-Lite (grounding queries, tier).
