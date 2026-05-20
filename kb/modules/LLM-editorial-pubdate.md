 # LLM Editorial Control Surface

This document maps where Big-AGI has editorial control over per-model metadata (and therefore can guarantee fields like `pubDate`, curated `description`, `chatPrice`, `benchmark`, `parameterSpecs`, etc.) versus where it must rely on the vendor API's dynamic discovery (and therefore cannot guarantee them).

For the forward-looking pipeline (extraction script, snapshot, website consumption, future schema extensions), see [LLM-models-catalog-pipeline.md](LLM-models-catalog-pipeline.md).


## The `pubDate` field

`pubDate?: string` (validated as `/^\d{8}$/`, e.g. `'20250929'`) is **optional** in the wire schema and on `DLLM`. It was added to:

- `ModelDescription_schema` in `src/modules/llms/server/llm.server.types.ts` - the canonical wire type
- `OrtVendorLookupResult` in the same file - so OpenRouter inherits it via `llmOrt*Lookup`
- `DLLM` in `src/common/stores/llms/llms.types.ts` - the persisted client model

### Where `pubDate` is guaranteed (always emitted)

- **Editorial entries** in 12 hybrid/editorial vendors (282 models). Hand-curated, externally corroborated. Future entries in these arrays are expected to include `pubDate`.
- **Anthropic 0-day placeholder** (`llmsAntCreatePlaceholderModel`): when the API surfaces an Anthropic model not in the editorial list, the placeholder uses the API's `created_at` ISO date, falling back to today via `formatPubDate()`.
- **Gemini 0-day fallback** (`geminiModelToModelDescription`): when the API returns a Gemini model not in `_knownGeminiModels`, the converter falls back to today via `formatPubDate()` (Gemini API does not expose a creation timestamp).

### Where `pubDate` is omitted (optional)

- **Symlink entries** (`KnownLink`) - inherit the target's `pubDate` via the merge logic in `fromManualMapping`.
- **Unknown variants resolved through `super`/`fallback`** in `fromManualMapping` for non-Anthropic/non-Gemini vendors - the field is left undefined rather than fabricated.
- **Dynamic-only vendors** (OpenRouter, TogetherAI, Novita, ChutesAI, FireworksAI, TLUS, Azure, LM Studio, LocalAI, FastAPI, ArceeAI, LLMAPI) - no editorial knob; pubDate flows in only when the underlying lookup or upstream API populates it.

The rationale: today's date is a defensible 0-day proxy only when we know we're seeing a brand-new model the vendor just announced (Anthropic and Gemini's "discovery via official model list" paths). For arbitrary dynamic vendors, fabricating today would mark old/well-known models as new - misleading. Better to omit.

### Propagation chain

- `fromManualMapping()` in `src/modules/llms/server/models.mappings.ts` - copies the field for OAI-style vendors when present
- `geminiModelToModelDescription()` in `src/modules/llms/server/gemini/gemini.models.ts` - copies for Gemini, falls back to today for unknowns
- `llmsAntCreatePlaceholderModel()` in `src/modules/llms/server/anthropic/anthropic.models.ts` - emits from API `created_at` (or today)
- `_mergeLookup()` in `src/modules/llms/server/openai/models/openrouter.models.ts` - merges for OpenRouter cross-vendor inheritance
- `_createDLLMFromModelDescription()` in `src/modules/llms/llm.client.ts` - copies onto the persisted DLLM when present
- `formatPubDate()` helper in `src/modules/llms/server/models.mappings.ts` - shared `'YYYYMMDD'` formatter for the 0-day-fillable paths

### Semantics

`pubDate` is the **earliest public availability** of the model - the date on which the vendor first made this specific model usable by external users via any channel (consumer app, web, console, API, partner, open-weights upload).

It is **not**:

- The date Big-AGI added the entry to its catalog (Ollama uses `added` for that)
- The training-data cutoff (proposed but not implemented; see `src/common/stores/llms/llms.types.next.ts:217`)
- The date the model snapshot was built (suffixes like `-1212` may refer to build dates, but `pubDate` tracks public availability)

### Resolution rules (when sources conflict)

1. **Date-suffixed model IDs**: when the suffix matches a documented announcement, the suffix is canonical (vendor convention). xAI, OpenAI, and Mistral all use suffixes that closely track release dates.
2. **Anthropic exception**: Anthropic's date suffixes are typically the **snapshot/training-cutoff date, not the public release date**. For example, `claude-3-7-sonnet-20250219` was released on 2025-02-24, `claude-opus-4-20250514` was released 2025-05-22, and `claude-haiku-4-5-20251001` was released 2025-10-15. Always corroborate against Anthropic's blog/press for the actual release date. Only `claude-sonnet-4-5-20250929` and `claude-opus-4-1-20250805` have suffixes that match.
3. **Closed beta -> public beta -> GA**: use the first date *external* users could access the specific variant.
4. **Family-headline IDs and dated snapshots** (e.g., `claude-opus-4-1` and `claude-opus-4-1-20250805`): typically share a release date.
5. **Hosted on a third party** (Groq hosting Llama, OpenRouter aggregating): use the *underlying* model's original release date by its creator, not when the host added it.
6. **Symlinks** (entries with `symLink:`): inherit the target's date.
7. **Partial dates** (only month known): use the 1st of the month and tag as MEDIUM confidence in the editor's note.


## Editorial control matrix

Three categories:

- **Editorial** - the vendor file contains hand-curated entries; we control descriptions, pricing, benchmarks, interfaces, parameter specs, and `pubDate`.
- **Hybrid** - the API returns the live model list, and editorial entries (keyed by id/idPrefix) merge over the API data via `fromManualMapping`. We control everything except *which models exist*.
- **Dynamic** - the API is the only source of model identity and metadata. Big-AGI cannot reliably populate `pubDate` here (no editorial knob).

| Vendor | Category | File | Array | Entries | `pubDate` populated |
|---|---|---|---|---|---|
| Anthropic | Hybrid | `anthropic/anthropic.models.ts` | `hardcodedAnthropicModels` | 12 | 12/12 HIGH |
| Gemini | Hybrid | `gemini/gemini.models.ts` | `_knownGeminiModels` | 33 | 33/33 HIGH |
| OpenAI | Hybrid | `openai/models/openai.models.ts` | `_knownOpenAIChatModels` | 96 | 95/96 HIGH/MED (`osb-120b` skipped, speculative) |
| xAI | Hybrid | `openai/models/xai.models.ts` | `_knownXAIChatModels` | 13 | 13/13 HIGH (pilot) |
| Mistral | Hybrid | `openai/models/mistral.models.ts` | `_knownMistralModelDetails` | 41 | 41/41 (40 HIGH, 1 MED for legacy `mistral-medium`) |
| Moonshot (Kimi) | Hybrid | `openai/models/moonshot.models.ts` | `_knownMoonshotModels` | 13 | 13/13 (10 HIGH, 3 MED for v1 base models) |
| Perplexity | Editorial | `openai/models/perplexity.models.ts` | `_knownPerplexityChatModels` | 4 | 4/4 HIGH |
| MiniMax | Editorial | `openai/models/minimax.models.ts` | `_knownMiniMaxModels` | 10 | 10/10 HIGH |
| DeepSeek | Hybrid | `openai/models/deepseek.models.ts` | `_knownDeepseekChatModels` | 4 | 4/4 HIGH |
| Groq | Hybrid (host) | `openai/models/groq.models.ts` | `_knownGroqModels` | 11 | 11/11 HIGH (underlying-model date) |
| Z.AI / GLM | Hybrid | `openai/models/zai.models.ts` | `_knownZAIModels` | 17 | 16/17 (`glm-5-code` UNCONFIRMED) |
| Bedrock | Reuses Anthropic | `bedrock/bedrock.models.ts` | -> `hardcodedAnthropicModels` | (12) | inherited |
| Ollama | Editorial (catalog) | `ollama/ollama.models.ts` | `OLLAMA_BASE_MODELS` | 209 | **deferred** - see notes |
| Arcee AI | Dynamic | `openai/models/arceeai.models.ts` | `_arceeKnownModels` | 0 | n/a (empty) |
| LLMAPI | Dynamic | `openai/models/llmapi.models.ts` | `_llmapiKnownModels` | 0 | n/a (empty) |
| Alibaba | Dynamic | `openai/models/alibaba.models.ts` | `_knownAlibabaChatModels` | 0 | n/a (empty) |
| OpenRouter | Dynamic + delegated lookup | `openai/models/openrouter.models.ts` | (parser) | -- | inherited via `llmOrt*Lookup` |
| TogetherAI | Dynamic | `openai/models/together.models.ts` | (parser) | -- | no |
| FireworksAI | Dynamic | `openai/models/fireworksai.models.ts` | (parser) | -- | no |
| Novita | Dynamic | `openai/models/novita.models.ts` | (parser) | -- | no |
| ChutesAI | Dynamic | `openai/models/chutesai.models.ts` | (parser) | -- | no |
| TLUS | Dynamic | `openai/models/tlusapi.models.ts` | (parser) | -- | no |
| Azure | Dynamic | `openai/models/azure.models.ts` | (parser) | -- | no |
| LM Studio | Dynamic | `openai/models/lmstudio.models.ts` | (parser) | -- | no |
| LocalAI | Dynamic | `openai/models/localai.models.ts` | (parser) | -- | no |
| FastAPI | Dynamic | `openai/models/fastapi.models.ts` | (parser) | -- | no |

**Totals**: 284 editorial entries across 12 vendors, of which **282** have corroborated `pubDate` and **2** are intentional gaps (`osb-120b` speculative, `glm-5-code` not yet announced). All 12 vendor files type-check clean.

### Notes

- **Hybrid** vendors are still effectively editorial for the models we know about: when an API id matches a hardcoded `idPrefix` (or `id`), `fromManualMapping` injects all the editorial fields. Unknown ids fall through to a default-shaped placeholder where `pubDate` is undefined.
- **OpenRouter** delegates back to Anthropic / Gemini / OpenAI editorial lookups via `llmOrtAntLookup_ThinkingVariants`, `llmOrtGemLookup`, `llmOrtOaiLookup`. `pubDate` flows through these lookups, so OpenRouter-served Claude/Gemini/GPT models get `pubDate` automatically once the underlying editorial entry has it.
- **Bedrock** finds Anthropic editorial via `llmBedrockFindAnthropicModel` and strips unsupported interfaces - `pubDate` inherits from Anthropic.
- **Ollama** is deferred: 209 entries keyed by upstream model family (e.g. `qwen3.6`, `kimi-k2`, `glm-4.6`). Each entry's `pubDate` would need to be the upstream creator's release date (Meta, Alibaba, Moonshot, Z.AI, etc.). This is large-scale upstream research; better handled in a follow-up pass once cross-vendor `pubDate` data is consolidated and reusable.
- **Dynamic-only** vendors get nothing automatic. To add `pubDate` for them we'd have to seed editorial entries (which is what `fromManualMapping`'s mapping mechanism was built for); this is a per-vendor decision and out of scope for the initial rollout.
