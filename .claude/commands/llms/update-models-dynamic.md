---
description: Update/validate dynamic vendor model parsers (OpenRouter, TogetherAI, Alibaba, Azure, Novita, ChutesAI, FireworksAI, TLUS, LM Studio, LocalAI, FastAPI)
---

Validate that the dynamic (API-fetched) vendor model parsers are up to date and not silently broken.

These vendors do NOT have hardcoded model lists - they fetch models from APIs at runtime. But their parsers, filters, heuristic detection, and capability mapping can break if upstream APIs change. This skill covers all dynamic vendors NOT covered by the other `llms:update-models-{vendor}` skills.

## Vendors to Validate

### High Risk

**OpenRouter** - `src/modules/llms/server/openai/models/openrouter.models.ts`
- Most complex parser. Vendor-specific parameter inheritance (Anthropic thinking variants, Gemini thinking/image, OpenAI reasoning effort, xAI/DeepSeek reasoning).
- Hardcoded family ordering list (lines ~24-37) - check if new leading vendors are missing.
- Hardcoded old/deprecated model hiding list (lines ~39-49) - check if stale.
- Cache pricing detection (Anthropic-style vs OpenAI-style) - verify format still valid.
- Variant injection for Anthropic thinking/non-thinking - verify still correct.
- Reference: https://openrouter.ai/docs/models

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
- Relies on provider capability flags: `supports_chat`, `supports_image_input`, `supports_tools`.
- Hostname heuristic: `fireworks.ai/`.

**TogetherAI** - `src/modules/llms/server/openai/models/together.models.ts`
- Type allow-list (`type: 'chat'`), vision detection by string match.
- Custom wire schema with pricing conversion.

**TLUS** - `src/modules/llms/server/openai/models/tlusapi.models.ts`
- Detected by response structure (`total_models`, `free_models`, `pro_models` fields).
- Capability enum mapping (`text`, `vision`, `audio`, `tool-calling`, `reasoning`, `websearch`).
- Tier-based pricing (`free` vs paid).

**Alibaba** - `src/modules/llms/server/openai/models/alibaba.models.ts`
- Model list was cleared (dynamic-only). Exclusion patterns for non-chat models.
- Assumes 128K context and Vision+Functions for all models (overly permissive).
- Check if hardcoded data should be restored now that naming has stabilized.

### Low Risk (local/generic - validate only if issues reported)

**Azure** - `src/modules/llms/server/openai/models/azure.models.ts`
- Custom deployments API, not `/v1/models`. User-specific. Deployment name fallback logic.

**LM Studio** - `src/modules/llms/server/openai/models/lmstudio.models.ts`
- Local service, native API (`/api/v1/models`). GGUF metadata parsing, capability flags.

**LocalAI** - `src/modules/llms/server/openai/models/localai.models.ts`
- Local service. String-based hide list, vision/reasoning detection by name pattern.

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

**Important:**
- Do NOT convert dynamic vendors to hardcoded lists - the dynamic approach is intentional
- Focus on parser correctness, not model coverage
- Flag any vendor whose API response format seems to have changed substantially
