---
description: Update Perplexity model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/perplexity.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:** (append `.md` to any docs URL for raw markdown - the HTML is MDX-heavy)
- Served model ids + full request schema (authoritative): https://docs.perplexity.ai/api-reference/sonar-post.md - the `model` enum is the served list
- Per-model context length + prices: https://docs.perplexity.ai/docs/sonar/models/{sonar,sonar-pro,sonar-reasoning-pro,sonar-deep-research}
- Pricing (single source of truth `PRICING` object in the page - read `PRICING.sonar.models[]`; the other tables on that page are Agent API/Gateway): https://docs.perplexity.ai/getting-started/pricing
- Changelog: https://docs.perplexity.ai/changelog/changelog
- Media/attachments (image + file input support): https://docs.perplexity.ai/guides/image-guide

Note: https://docs.perplexity.ai/getting-started/models is now marketing-only (no ids, no context windows).

**Fallbacks if blocked:** Search "perplexity api latest pricing", "perplexity latest models", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** The Sonar API has no list-models endpoint, but if `.env.api-keys` has `PERPLEXITY_API_KEY` a minimal `/chat/completions` probe against a candidate id confirms it's served (docs now name the path `POST /v1/sonar`; `/chat/completions`, the path big-AGI calls, is an alias with the identical schema) (`max_tokens` must be >= 16; retired ids 400 with an explicit "deprecated"/"Invalid model" message). Never commit or echo the key.

**Not this vendor:** the Agent API (`/v1/agent`, resells Anthropic/OpenAI/Google/xAI) and the Gateway (`https://api.perplexity.ai/router/v1`, incl. `GET /router/v1/models`, open-weight models hosted by Perplexity) are separate Perplexity products - out of scope for this file. Since July 2026 every Sonar docs page carries a banner steering to the Agent API; the four Sonar ids are still served and still in scope.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content