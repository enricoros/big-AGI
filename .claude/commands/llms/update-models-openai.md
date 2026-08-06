---
description: Update OpenAI model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/openai.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:** docs moved from `platform.openai.com/docs/*` (301s) to `developers.openai.com/api/docs/*`.
Appending `.md` to any docs URL returns clean markdown that plain `curl` fetches (no 403, no browser needed):
- Pricing: https://developers.openai.com/api/docs/pricing.md - standard/batch/flex/fast tables, all rows inline. The flagship table is NOT the full list: Codex/ChatGPT(`*-chat-latest`)/Cyber/Search rows sit in a separate "Specialized models" table, audio in its own
- Models index: https://developers.openai.com/api/docs/models.md; per-model https://developers.openai.com/api/docs/models/<id>.md (context window, max output, cutoff, endpoints, supported features/tools, price)
- Deprecations: https://developers.openai.com/api/docs/deprecations.md - shutdown dates + official replacements. Split matters: "Upcoming deprecations" = still callable, "Past deprecations" = already dead (yet often still on /v1/models)
- Changelog: https://developers.openai.com/api/docs/changelog.md - price cuts and new API features, newest first
- Doc index: https://developers.openai.com/llms.txt

**Fallbacks if blocked:** third-party aggregators via search, or Chrome DevTools MCP on the official docs.

**Ground truth vs docs:** `/v1/models` keeps listing models after shutdown (even `GET /v1/models/<id>`
returns 200 for dead ids) - only a generation attempt is a liveness signal. A 1-token `v1/chat/completions`
call returns 404 "has been deprecated" for dead ids; `v1/responses` says only "Model not found" for the
same dead ids (equivalent verdict, weaker message). Probe before concluding a model is alive OR dead.

**Before removing a model def, all three must hold** (removal = delete the entry + add it to `openAIModelsShutdownDenyList`, which filters native api.openai.com listings only - compatible hosts/proxies that still serve the id keep it):
1. OpenAI direct generation is dead (404 deprecated) - and the error is not a permission/entitlement error,
   which means the model EXISTS and some keys still have access (keep the def).
2. The docs name that exact id: bare aliases can outlive their deny-listed snapshot (gpt-4o-search-preview
   still served after gpt-4o-search-preview-2025-03-11 shut down) - probe alias and snapshot separately.
3. OpenRouter `openai/<id>` has no working endpoint (probe a 1-token generation, not just the listing) -
   Azure kept the 5.1/5.2 codex family alive post-shutdown. If OR still serves it, keep the def (hidden,
   deny-listed) so `llmOrtOaiLookup` keeps native interfaces/params - same pattern as gemini.models.ts
   phantom models.

**Live endpoint (extra signal):** If `.env.api-keys` has `OPENAI_API_KEY`, scan the served model list for what's new and cross-check the docs above: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`. Never commit or echo the key.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content