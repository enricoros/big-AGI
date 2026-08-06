---
description: Update Gemini model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/gemini/gemini.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.types.ts`, `src/modules/llms/server/llm.server.types.ts`, and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://ai.google.dev/gemini-api/docs/models
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Changelog: https://ai.google.dev/gemini-api/docs/changelog
- Deprecations: https://ai.google.dev/gemini-api/docs/deprecations - the authoritative table of release + shutdown dates per model id; it overrides dates inferred from the changelog. "No shutdown date announced" means the def must carry NO `deprecated` field (Google does not auto-retire a stable model one year after release)

**Fallbacks if blocked:** Check Google AI JS SDK at https://github.com/googleapis/js-genai, search "gemini models latest pricing", "gemini latest models", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** If `.env.api-keys` has `GEMINI_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=$GEMINI_API_KEY"`. `pageSize` is required: the default is 50 and the tail (newest models included) is silently dropped behind a `nextPageToken`. Never commit or echo the key. When looping ids in zsh, write `${m}:generateContent` - bare `$m:ge...` is eaten as a zsh history modifier and every probe silently 404s.

**Listed != reachable:** the list endpoint keeps returning models that 404 on `generateContent` (`filterNotFoundModelNames`), and returns retired-preview aliases that still serve (sometimes routed to their successor - check `modelVersion` in the response). Re-verify both with a 1-token POST per suspect id before adding or removing a def.

**Important:**
- Ignore context windows (auto-determined at runtime) and training cutoffs (not supported)
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review, do NOT remove comments
- Flag broken links or unexpected content
