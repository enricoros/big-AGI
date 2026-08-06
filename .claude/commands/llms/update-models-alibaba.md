---
description: Update Alibaba model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/alibaba.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models list: https://www.alibabacloud.com/help/en/model-studio/models
- Price tables (per region, USD for International/Singapore): https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Per-model pages, e.g. https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max (id with `.` -> `-`): the only source for max input / max output / max CoT and the per-model cache-hit price, which the price tables omit
- Cache billing rules: https://www.alibabacloud.com/help/en/model-studio/context-cache
- Billing Guide: https://www.alibabacloud.com/help/en/model-studio/billing-for-model-studio

**Fallbacks if blocked:**
- Search "alibaba model studio latest pricing", "alibaba latest models", "qwen models pricing", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** The DashScope key in `.env.api-keys` is `ALIBABA_API_KEY`. Scan the OpenAI-compatible model list as ground-truth for what's new/available and cross-check the docs above: `curl https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models -H "Authorization: Bearer $ALIBABA_API_KEY"`. Never commit or echo the key. The list carries only id/created/owned_by, but two caps are cheaply probed on `/chat/completions`: `max_tokens: 999999` returns `Range of max_tokens should be [1, N]` (N differs with `enable_thinking` on/off), and an oversized prompt returns `Range of input length should be [1, N]`. Free-tier quota can be exhausted per model, which masks probes.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
