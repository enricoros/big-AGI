---
description: Update Perplexity model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/perplexity.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:** (append `.md` to any docs URL for raw markdown - the HTML is MDX-heavy)
- Sonar status: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview.md - Sonar Chat Completions support ended 2026-09-27; requests to the four ids keep working, reformulated as Agent API requests, rolling out per model. The old per-model pages (`docs/sonar/models/*`), `api-reference/sonar-post` and the media guide all redirect here: there is no published model enum or per-model context table anymore
- Pricing: https://docs.perplexity.ai/docs/getting-started/pricing - the page body has no Sonar table; the numbers live only in the embedded `PRICING={...}` object (curl the HTML, read `PRICING.sonar`)
- Changelog: https://docs.perplexity.ai/docs/resources/changelog
- Doc index: https://docs.perplexity.ai/llms.txt

**Fallbacks if blocked:** Search "perplexity api latest pricing", "perplexity latest models", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal, and now the only per-model source):** The Sonar API has no list-models endpoint, but if `.env.api-keys` has `PERPLEXITY_API_KEY` a minimal `/chat/completions` probe against a candidate id confirms it's served (`max_tokens` must be >= 16; retired ids 400 with an explicit "deprecated"/"Invalid model" message). A reformulated id answers with a `resp_` response id and a `usage.cost` that no longer follows the Sonar card; a not-yet-reformulated one returns a UUID id and card prices. Never commit or echo the key.

**Not this vendor:** the Agent API (`/v1/agent`, resells Anthropic/OpenAI/Google/xAI) and the Orchestrator API (formerly Gateway, `https://api.perplexity.ai/router/v1`, open-weight and third-party models) are separate Perplexity products - out of scope for this file.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content