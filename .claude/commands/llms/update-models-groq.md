---
description: Update Groq model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/groq.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Source:**
- Fetch https://console.groq.com/docs/models.md directly (markdown format, no search needed)
- Pricing: https://groq.com/pricing/

**Do NOT use web search.** The `.md` endpoint provides structured markdown content directly.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content