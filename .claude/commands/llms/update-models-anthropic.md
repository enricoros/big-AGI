---
description: Update Anthropic model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/anthropic/anthropic.models.ts` with latest model definitions.

Reference files (for context only, do not modify):
- `src/modules/llms/server/llm.server.types.ts`
- `src/modules/llms/server/models.mappings.ts`
- `src/common/stores/llms/llms.parameters.ts`

**Workflow: Start with recent changes, then verify the full model list.**

**Primary Sources (append `.md` to any path for clean markdown):**
1. Recent changes: https://platform.claude.com/docs/en/release-notes/overview.md
2. Models & IDs: https://platform.claude.com/docs/en/about-claude/models/overview.md
3. Pricing (base, cache, batch, long context): https://platform.claude.com/docs/en/about-claude/pricing.md
4. Deprecations & retirement dates: https://platform.claude.com/docs/en/about-claude/model-deprecations.md

**Discovering feature docs:** The release notes and models overview markdown
contain inline links to feature-specific pages (thinking modes, effort,
context windows, what's-new pages, etc.). When a new capability is
referenced, follow those links — append `.md` to get markdown. Examples of
pages you might discover this way:
- `about-claude/models/whats-new-claude-*` — per-generation changes
- `build-with-claude/extended-thinking` — thinking budget configuration
- `build-with-claude/effort` — effort parameter levels
- `build-with-claude/adaptive-thinking` — adaptive thinking mode

**Fallback web pages** (crawl if `.md` paths break or structure changes):
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/release-notes/overview
- https://claude.com/pricing

**Fallbacks if blocked:** Check the Anthropic TypeScript SDK at
https://github.com/anthropics/anthropic-sdk-typescript, or web-search
for "anthropic models latest pricing" / "anthropic latest models".

**Important:**
- Review the full model list for additions, removals, and price changes
- For new models: check which `parameterSpecs` are needed (thinking mode,
  effort levels, 1M context, skills, web tools) by reading the linked
  feature docs and comparing with existing model entries
- When thinking/effort semantics change between generations
  (e.g. adaptive vs manual thinking), document in comments
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content