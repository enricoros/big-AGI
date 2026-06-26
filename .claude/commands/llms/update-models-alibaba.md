---
description: Update Alibaba model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/alibaba.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models & Pricing: https://www.alibabacloud.com/help/en/model-studio/models
- Billing Guide: https://www.alibabacloud.com/help/en/model-studio/billing-for-model-studio

**Fallbacks if blocked:**
- Search "alibaba model studio latest pricing", "alibaba latest models", "qwen models pricing", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** If `.env.api-keys` has a DashScope key (`DASHSCOPE_API_KEY`), scan the OpenAI-compatible model list as ground-truth for what's new/available and cross-check the docs above: `curl https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models -H "Authorization: Bearer $DASHSCOPE_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
