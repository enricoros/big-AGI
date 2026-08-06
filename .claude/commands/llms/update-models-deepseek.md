---
description: Update DeepSeek model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/deepseek.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:** (trailing slash required - without it Docusaurus 302s)
- Pricing + model details (context, max output, per-model feature matrix, and the MODEL VERSION row - the authoritative tell for in-place weight swaps, e.g. DeepSeek-V4-Flash-0731): https://api-docs.deepseek.com/quick_start/pricing/
- Model List: https://api-docs.deepseek.com/api/list-models/
- Release Notes: https://api-docs.deepseek.com/updates/ (check for version updates like V4-Flash-0731)
- Thinking Mode: https://api-docs.deepseek.com/guides/thinking_mode/ - authoritative for the `reasoning_effort` enum and the per-model requested->actual effort mapping that drives `parameterSpecs`

**Note:** DeepSeek frequently swaps weights in place behind an unchanged, undated model id, and releases new versions with significant pricing changes. Always check release notes first.

**Fallbacks if blocked:** Search "deepseek api latest pricing", "deepseek latest models", "deepseek models list" or search GitHub for latest model prices and context windows

**Live endpoint (extra signal):** If `.env.api-keys` has `DEEPSEEK_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.deepseek.com/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content