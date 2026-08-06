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

**Fetching the docs:** `curl -L -A "Mozilla/5.0 ..."` returns the full server-rendered page (the tables are in the HTML); strip `<script>` and convert `<tr>/<td>` to text. Both help pages lag new launches by weeks - a model can be live on the API and absent from the models list AND the price tables. Per-model pages also omit whole regions (qwen3.7-max/-flash have no Singapore section while the price table prices them there), so a missing region is not evidence of unavailability. Cache-hit rate is a per-family ratio of input price, stable across regions: read it off any region on the model page and apply it to the Singapore input price (Qwen/Kimi 20%, GLM 25%, deepseek-v4-pro ~8%).

**OpenRouter as the tiebreaker (no key needed):** `curl -s https://openrouter.ai/api/v1/models/qwen/<id>/endpoints` - the `Alibaba` endpoint is Alibaba's own passthrough and carries the exact International list tiers (`pricing.overrides[].min_prompt_tokens` = the tier boundaries), `input_cache_read`, `max_completion_tokens`, `max_prompt_tokens`, and the modality string. It is often the ONLY published International price for a just-launched model. Note `pricing.discount` / promo cuts: OpenRouter may show the promotional rate, while this file records the list price (the price tables mark these "List price $X Limited-time N% off").

**Fallbacks if blocked:**
- Search "alibaba model studio latest pricing", "alibaba latest models", "qwen models pricing", or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** The DashScope key in `.env.api-keys` is `ALIBABA_API_KEY`. Scan the OpenAI-compatible model list as ground-truth for what's new/available and cross-check the docs above: `curl https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models -H "Authorization: Bearer $ALIBABA_API_KEY"`. Never commit or echo the key. The list carries only id/created/owned_by, but two caps are cheaply probed on `/chat/completions`: `max_tokens: 999999` returns `Range of max_tokens should be [1, N]` (N differs with `enable_thinking` on/off), and an oversized prompt returns `Range of input length should be [1, N]`. Free-tier quota can be exhausted per model, which masks probes. Treat N as the accepted *parameter* range, not the real output cap - it is permissive (qwen3.7-flash accepts 131072 while the model page and OpenRouter both cap it at 65536); prefer the docs/OpenRouter value when they agree against the probe.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
