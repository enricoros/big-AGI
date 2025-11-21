---
description: Update OpenAI model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/openai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Manual hint:** For pricing page, expand all tables before copying content.

**Primary Sources:**
- Models: https://platform.openai.com/docs/models (use Copy Page button)
- Pricing: https://platform.openai.com/docs/pricing (expand tables first)

**Known Issue:** OpenAI docs block automated access (403 Forbidden). Manual browser access required.

**Fallbacks if blocked:**
- Search "openai models latest pricing", "openai latest models" for third-party aggregators, or search GitHub for latest model prices and context windows
- OpenAI Node SDK (https://github.com/openai/openai-node) has limited model metadata only
- As last resort: Use Chrome DevTools MCP to navigate and extract from official docs

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content