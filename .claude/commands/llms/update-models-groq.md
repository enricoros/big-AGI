---
description: Update Groq model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/groq.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Source:**
- Fetch https://console.groq.com/docs/models.md directly (markdown format, no search needed)
- Pricing: https://groq.com/pricing/

**Do NOT use web search.** The `.md` endpoint provides structured markdown content directly.

**Live endpoint (extra signal):** If `.env.api-keys` has `GROQ_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content