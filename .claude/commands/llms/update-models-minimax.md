---
description: Update MiniMax model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/minimax.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources:**
- Models & Changelog: https://platform.minimax.io/docs/release-notes/models.md
- Pricing: https://platform.minimax.io/docs/guides/pricing-paygo.md
- Pricing Overview: https://platform.minimax.io/docs/pricing/overview.md
- Text Generation API (context-window table, model overview): https://platform.minimax.io/docs/guides/text-generation.md
- OpenAI-compatible reference (authoritative `model` enum, per-model `max_completion_tokens` caps, `thinking`/`reasoning_split`/`service_tier`, image/video parts): https://platform.minimax.io/docs/api-reference/text-chat-openai.md
- Doc index (raw `.md` fetch works for every page): https://platform.minimax.io/docs/llms.txt

**Note:** MiniMax stays hardcoded: `GET https://api.minimax.io/v1/models` exists but returns bare `{id, created, owned_by}` (no context/pricing/capabilities) and omits still-served legacy ids. Context windows, max output, and pricing must be maintained from the docs. Pay attention to new model releases (M-series), highspeed variants, and deprecated models.

**Fallbacks if blocked:** Search "minimax api models pricing", "minimax m2 m3 models", "minimax api changelog" or check https://openrouter.ai models list for MiniMax entries.

**Live probes (ground truth, needs `MINIMAX_API_KEY` from `.env.api-keys`, never echo it):**
- `GET /v1/models` for the served-and-supported set (its `created` is the vendor release date, often +1 day vs the release notes - keep the file's doc-derived pubDate)
- A 1-token `POST /v1/chat/completions` confirms unlisted/legacy ids are still served (400 `unknown model` = dead). Careful: not every served id carries the `MiniMax-` prefix (e.g. `M2-her`), and `MiniMax-01` is dead while `MiniMax-Text-01` is live
- An over-large `max_completion_tokens` 400s with the exact per-model ceiling in the message (M3 524288, M2.x/M1 196608, Text-01 40000, M2-her 2048) - cheapest way to check max output
- Tool support: send `tools` + `tool_choice: 'required'`; M2-her silently ignores both (no function calling)

**Important:**
- Models are `ModelDescriptionSchema[]` objects (not ManualMappings) - match existing pattern in the file
- Review the full model list for additions, removals, and price changes
- Check for new `-highspeed` variants and new model families
- Verify context window sizes and max completion tokens against docs
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content