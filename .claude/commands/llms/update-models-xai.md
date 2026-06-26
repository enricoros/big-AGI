---
description: Update xAI model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/xai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models & Pricing: https://docs.x.ai/docs/models?cluster=us-east-1#detailed-pricing-for-all-grok-models

**Known Issue:** docs.x.ai blocks automated access (403 Forbidden). Use fallbacks below.

**Fallbacks if blocked:**
- Search "xai grok latest pricing", "xai latest models", "xai api models", or search GitHub for latest model prices and context windows
- Random sites? https://the-rogue-marketing.github.io/grok-api-latest-llms-pricing-october-2025/ (find a newer version), https://langdb.ai/app/providers/xai/ (browse by model, limited coverage)
- As last resort: Use Chrome DevTools MCP to access docs.x.ai

**Live endpoint (extra signal):** If `.env.api-keys` has `XAI_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.x.ai/v1/models -H "Authorization: Bearer $XAI_API_KEY"` (also `/v1/language-models` for richer pricing/modalities). Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content