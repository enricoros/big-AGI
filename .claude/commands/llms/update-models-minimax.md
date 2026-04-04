---
description: Update MiniMax model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/minimax.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models & Changelog: https://platform.minimax.io/docs/release-notes/models.md
- Pricing: https://platform.minimax.io/docs/guides/pricing-paygo.md
- Pricing Overview: https://platform.minimax.io/docs/pricing/overview.md
- Text Generation API: https://platform.minimax.io/docs/guides/text-generation.md

**Note:** MiniMax is a hardcoded-only vendor (no `/v1/models` API yet). All model IDs, context windows, and pricing must be manually maintained from the docs. Pay attention to new model releases (M-series), highspeed variants, and deprecated models.

**Fallbacks if blocked:** Search "minimax api models pricing", "minimax m2 m3 models", "minimax api changelog" or check https://openrouter.ai models list for MiniMax entries.

**Important:**
- Models are `ModelDescriptionSchema[]` objects (not ManualMappings) - match existing pattern in the file
- Review the full model list for additions, removals, and price changes
- Check for new `-highspeed` variants and new model families
- Verify context window sizes and max completion tokens against docs
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content