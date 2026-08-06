---
description: Update/validate dynamic vendor model parsers (OpenRouter, TogetherAI, Azure, Novita, ChutesAI, FireworksAI, TLUS, LM Studio, LocalAI, FastAPI)
---

Validate that the dynamic (API-fetched) vendor model parsers are up to date and not silently broken.

These vendors do NOT have hardcoded model lists - they fetch models from APIs at runtime. But their parsers, filters, heuristic detection, and capability mapping can break if upstream APIs change. This skill covers all dynamic vendors NOT covered by the other `llms:update-models-{vendor}` skills.

## Vendors to Validate

### High Risk

**OpenRouter** - `src/modules/llms/server/openai/models/openrouter.models.ts`
- Most complex parser. Vendor-specific parameter inheritance (Anthropic thinking variants, Gemini thinking/image, OpenAI reasoning effort, xAI/DeepSeek reasoning).
- `orModelFamilyOrder` doubles as the visibility allow-list - check if new leading vendors are missing (they'd be hidden, not just mis-sorted).
- `orOldModelIDs` hiding list - check if stale.
- Ids: `~vendor/model-latest` must be resolved through `alias_target.slug` (dropping the '~' leaves an unlookupable ref like 'claude-opus-latest') and `vendor/model-fast` are resold priority tiers - both must match their base family/vendor definition, not fall through to the generic branch.
- `reasoning.mandatory` models reject effort 'none' - never offer it, in any vendor branch.
- OR outlives vendor shutdowns: Azure serves `openai/*` codex ids that are dead on OpenAI direct. Vendor-side defs must stay (hidden + deny-listed natively) for the `llmOrt*Lookup` inheritance to keep working - flag any OR id whose vendor lookup went dead.
- Cache pricing detection (Anthropic-style vs OpenAI-style) - verify format still valid.
- `pricing.overrides` = long-context surcharge tiers (ascending `min_prompt_tokens`, ~57/399 models) - must fold into our `{ upTo, price }[]` arrays, else long prompts are costed at the cheapest tier.
- Variant injection for Anthropic thinking/non-thinking - verify still correct.
- Reference: https://openrouter.ai/docs/models ; live list: `GET https://openrouter.ai/api/v1/models`

### Medium Risk

**Novita** - `src/modules/llms/server/openai/models/novita.models.ts`
- Features array mapping (`function-calling`, `reasoning`, `structured-outputs`) and input modalities parsing.
- Pricing unit conversion (hundredths of cent per million → dollars per 1K).
- Hostname heuristic: `novita.ai`.

**ChutesAI** - `src/modules/llms/server/openai/models/chutesai.models.ts`
- Custom `max_model_len` field for context window.
- Assumes all models support Vision + Functions (aggressive).
- Hostname heuristic: `.chutes.ai`.

**FireworksAI** - `src/modules/llms/server/openai/models/fireworksai.models.ts`
- Relies on provider capability flags: `supports_chat`, `supports_image_input`, `supports_tools`; `kind` also gates (embedding/reranker models are listed with `supports_chat: true`).
- Two id shapes: `accounts/fireworks/models/*` and `accounts/fireworks/routers/*` (the Fast/Turbo serving tiers, which need their own editorial price: 1.5x-2.1x Standard, no fixed multiplier); slugs use 'p' as decimal point.
- `/inference/v1/models` is unpaginated (20 serverless models today) and has no name/description/price: labels+descriptions from `GET /v1/accounts/fireworks/models/{id}` (control plane, same key), prices from https://docs.fireworks.ai/serverless/pricing (NOT fireworks.ai/pricing, which is training-only).
- Hostname heuristic: `fireworks.ai/`.

**TogetherAI** - `src/modules/llms/server/openai/models/together.models.ts`
- Type allow-list (`type: 'chat'`; 'language' = base LMs, correctly excluded), vision detection by id pattern - the API exposes no modality field, so cross-check families against OpenRouter/Fireworks. `config.chat_template` is not a substitute: GLM-5.2's template handles images but Together serves it text-only.
- `created` is endpoint churn (0 for the newest arrivals) - pubDate comes only from `_togetherEditorialPubDates`.
- Custom wire schema with pricing conversion.

**TLUS** - `src/modules/llms/server/openai/models/tlusapi.models.ts`
- Detected by response structure (`total_models`, `free_models`, `pro_models` fields).
- Capability enum mapping (`text`, `vision`, `audio`, `tool-calling`, `reasoning`, `websearch`).
- Tier-based pricing (`free` vs paid).

### Low Risk (local/generic - validate only if issues reported)

**Azure** - `src/modules/llms/server/openai/models/azure.models.ts`
- Custom deployments API, not `/v1/models`. User-specific. Deployment name fallback logic.

**LM Studio** - `src/modules/llms/server/openai/models/lmstudio.models.ts`
- Local service, native API (`/api/v1/models`). GGUF metadata parsing, capability flags.

**LocalAI** - `src/modules/llms/server/openai/models/localai.models.ts`
- Local service. Substring hide list for the non-chat gallery models it also serves (image/TTS/STT/embedding/reranker/VAD), vision/reasoning detection by name pattern.

**FastAPI** - `src/modules/llms/server/openai/models/fastapi.models.ts`
- Generic passthrough. Detected by `owned_by === 'fastchat'`. Minimal parsing.

## Validation Checklist

For each vendor (prioritize High > Medium > Low):

1. **Read the parser file** and check for:
   - Deny/allow lists that may be stale (new model families missing)
   - Capability assumptions that may be wrong (e.g. "all models support vision")
   - Field names that may have changed upstream
   - Pricing conversion math that may use wrong units

2. **Check upstream docs** (where available) for:
   - API response schema changes
   - New model types or capability fields
   - Deprecated fields

3. **Cross-reference with OpenRouter** (aggregator):
   - OpenRouter surfaces models from many of these vendors
   - If OpenRouter shows capabilities that a vendor's parser misses, the parser is stale

4. **Fix issues found** - update parsers, filters, deny lists as needed.

5. Run `tsc --noEmit` after changes.

**Live endpoint (extra signal):** If `.env.api-keys` has a key for one of these vendors (e.g. `FIREWORKSAI_API_KEY`, `TOGETHERAI_API_KEY`), hit its live models endpoint (authenticating with the key; path varies - e.g. Together `/v1/models`, Fireworks `/inference/v1/models`) to get the real, current response shape - the fastest way to catch parser drift, new capability fields, or changed field names. Never commit or echo the key.

**Important:**
- Do NOT convert dynamic vendors to hardcoded lists - the dynamic approach is intentional
- Focus on parser correctness, not model coverage
- Flag any vendor whose API response format seems to have changed substantially
