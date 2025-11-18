---
description: Update Anthropic model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/anthropic/anthropic.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models: https://docs.claude.com/en/docs/about-claude/models/overview
- Pricing: https://claude.com/pricing#api
- Deprecations: https://docs.claude.com/en/docs/about-claude/model-deprecations

**Fallbacks if blocked:** Check Anthropic TypeScript SDK at https://github.com/anthropics/anthropic-sdk-typescript, search "anthropic models latest pricing", "anthropic latest models", or search GitHub for latest model prices and context windows

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content