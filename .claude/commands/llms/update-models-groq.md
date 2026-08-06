---
description: Update Groq model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/groq.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Source:**
- Fetch https://console.groq.com/docs/models.md directly (markdown format, no search needed)
- Pricing: the per-model card `### PRICING` block is the source of truth (input / cached input / output, one `$X.XX` per line). https://groq.com/pricing/ is JS-rendered and carries no table, and /docs/pricing.md 404s - do not rely on either
- Deprecations (exact shutdown dates + replacement model, authoritative for removals): https://console.groq.com/docs/deprecations.md - check it every pass, models stay in the API and in models.md as "Production" until the shutdown date
- Per-model card (capabilities, image/file limits, max output, best practices): https://console.groq.com/docs/model/<model-id>.md - the compound systems have no card (404), they are documented at https://console.groq.com/docs/compound.md and /docs/compound/built-in-tools.md
- Capability matrices: https://console.groq.com/docs/reasoning.md (also documents the per-family `reasoning_effort` enums), https://console.groq.com/docs/vision.md (its image cap goes stale - the card's `MAX INPUT IMAGES` wins, confirm with an over-cap request), https://console.groq.com/docs/prompt-caching.md (which models get the 50% cached-input discount)
- Changelog https://console.groq.com/docs/changelog.md lags model launches by months - do not rely on it for "what's new"

**Do NOT use web search.** The `.md` endpoint provides structured markdown content directly.

**Live endpoint (extra signal):** If `.env.api-keys` has `GROQ_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`. Never commit or echo the key. Probe with `curl`, not python `urllib` - Cloudflare 403s (error 1010) non-browser-ish clients. Enterprise-only models (e.g. MiniMax) are in the docs but 404 on standard keys.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content