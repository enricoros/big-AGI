---
description: Update DeepSeek model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/deepseek.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Model List: https://api-docs.deepseek.com/api/list-models
- Release Notes: https://api-docs.deepseek.com/updates (check for version updates like V3.2-Exp)

**Note:** DeepSeek frequently releases new versions with significant pricing changes. Always check release notes first.

**Fallbacks if blocked:** Search "deepseek api latest pricing", "deepseek latest models", "deepseek models list" or search GitHub for latest model prices and context windows

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content