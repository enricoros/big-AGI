---
description: Update xAI model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/xai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models & Pricing: https://docs.x.ai/developers/models (canonical since ~2026; `/docs/models` still resolves). Two kinds of per-model pages: detail/pricing pages at `/developers/models/<dotted-id>` (e.g. `/developers/models/grok-4.3`) exist for every served model and carry context/pricing tiers/modalities/capability flags; hand-written guides at `/developers/<dashed-id>` (e.g. `/developers/grok-4-5`) exist for only a few models (`grok-4-3`, `grok-build-0-1` 404) and are the only place with knowledge cutoffs. `/developers/changelog` 404s; `/developers/release-notes` exists but was stale (no 2026 entries) as of 2026-08.
- Docs' effort lists are incomplete: they omitted `xhigh` for grok-4.5 while the API accepts it. Always probe efforts rather than trusting the table.
- Note: docs/press now brand the vendor "SpaceXAI" (post-merger); model ids and the `xai` `owned_by` are unchanged.

**Known Issue:** `curl` on docs.x.ai returns 521; WebFetch works. x.ai/news/* still 403s - use fallbacks below for release dates.

**Fallbacks if blocked:**
- Search "xai grok latest pricing", "xai latest models", "xai api models", or search GitHub for latest model prices and context windows
- Random sites? https://the-rogue-marketing.github.io/grok-api-latest-llms-pricing-october-2025/ (find a newer version), https://langdb.ai/app/providers/xai/ (browse by model, limited coverage)
- As last resort: Use Chrome DevTools MCP to access docs.x.ai

**Live endpoint (extra signal):** If `.env.api-keys` has `XAI_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above. Fetch BOTH, they are complementary: `/v1/models` is the only source of `context_length` (and lists the non-chat imagine models), `/v1/language-models` is the only source of `input_modalities`/`output_modalities`/`fingerprint` and is what the app actually calls; pricing/aliases/long-context tiers appear in both. `curl https://api.x.ai/v1/models -H "Authorization: Bearer $XAI_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content