---
description: Update Mistral model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/mistral.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://docs.mistral.ai/getting-started/models/models_overview/
- Pricing: https://mistral.ai/pricing#api-pricing
- Changelog: https://docs.mistral.ai/getting-started/changelog/

**Fallbacks if blocked:**
- Search "mistral [model-name] latest pricing",  "mistral api latest pricing", "mistral latest models", or search GitHub for latest model prices and context windows
- Cross-reference: pricepertoken.com, helicone.ai, artificialanalysis.ai
- Check Mistral API list models response
- As last resort: Use Chrome DevTools MCP to render pricing table

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
