---
description: Update Mistral model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/mistral.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://docs.mistral.ai/models/overview - also has the deprecated/retired table (deprecation + retirement dates + replacement)
- Pricing: per-model cards at https://docs.mistral.ai/models/model-cards/<slug> (price, context, release date, deprecation) - the https://mistral.ai/pricing#api-pricing table is client-rendered and not in the HTML
- Changelog: https://docs.mistral.ai/resources/changelogs

**Fallbacks if blocked:**
- Search "mistral [model-name] latest pricing",  "mistral api latest pricing", "mistral latest models", or search GitHub for latest model prices and context windows
- Cross-reference: pricepertoken.com, artificialanalysis.ai
- Check Mistral API list models response
- As last resort: Use Chrome DevTools MCP to render pricing table

**Live endpoint (extra signal):** If `.env.api-keys` has `MISTRAL_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.mistral.ai/v1/models -H "Authorization: Bearer $MISTRAL_API_KEY"`. Never commit or echo the key. Each entry carries `aliases`, `max_context_length`, `capabilities` (incl. `reasoning`), and `deprecation` / `deprecation_replacement_model`; retired models disappear from this list, which is the signal to drop their `_knownMistralModelDetails` entries.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
