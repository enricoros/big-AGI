---
description: Update OpenAI model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/openai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:** docs moved from `platform.openai.com/docs/*` (301s) to `developers.openai.com/api/docs/*`.
Appending `.md` to any docs URL returns clean markdown that plain `curl` fetches (no 403, no browser needed):
- Pricing: https://developers.openai.com/api/docs/pricing.md - standard/batch/flex/fast tables, all rows inline
- Models index: https://developers.openai.com/api/docs/models.md; per-model https://developers.openai.com/api/docs/models/<id>.md (context window, max output, cutoff, endpoints, supported features/tools, price)
- Deprecations: https://developers.openai.com/api/docs/deprecations.md - upcoming + past shutdown dates and official replacements
- Changelog: https://developers.openai.com/api/docs/changelog.md - price cuts and new API features, newest first
- Doc index: https://developers.openai.com/llms.txt

**Fallbacks if blocked:** third-party aggregators via search, or Chrome DevTools MCP on the official docs.

**Ground truth vs docs:** `/v1/models` keeps listing models for weeks after shutdown. A 1-token
`v1/chat/completions` (or `v1/responses`) call returns 404 "has been deprecated" for dead ids - probe before
concluding a model is alive.

**Live endpoint (extra signal):** If `.env.api-keys` has `OPENAI_API_KEY`, scan the served model list for what's new and cross-check the docs above: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content