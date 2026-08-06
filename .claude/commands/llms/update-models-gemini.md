---
description: Update Gemini model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/gemini/gemini.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.types.ts`, `src/modules/llms/server/llm.server.types.ts`, and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://ai.google.dev/gemini-api/docs/models
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Changelog: https://ai.google.dev/gemini-api/docs/changelog

**Fallbacks if blocked:** Check Google AI JS SDK at https://github.com/googleapis/js-genai, search "gemini models latest pricing", "gemini latest models", or search GitHub for latest model prices and context windows

**Important:**
- Ignore context windows (auto-determined at runtime) and training cutoffs (not supported)
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review, do NOT remove comments
- Flag broken links or unexpected content
