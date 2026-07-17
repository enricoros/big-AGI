---
description: Update Kimi model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/moonshot.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources (fetch directly, no search needed):**
- Pricing: https://platform.kimi.ai/docs/pricing/chat (was platform.moonshot.ai - now 301 redirect)
- K3 pricing (separate page): https://platform.kimi.ai/docs/pricing/chat-k3
- API Reference: https://platform.kimi.ai/docs/api/chat

**Do NOT use web search.** Fetch the URLs directly, or ask the user to provide data, if unaccessible.

**Live endpoint (extra signal):** If `.env.api-keys` has `MOONSHOT_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.moonshot.ai/v1/models -H "Authorization: Bearer $MOONSHOT_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
