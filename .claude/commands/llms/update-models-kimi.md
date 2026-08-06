---
description: Update Kimi model definitions with latest pricing and capabilities
---

Update `src/modules/llms/server/openai/models/moonshot.models.ts` with latest model definitions.

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary Sources (fetch directly, no search needed):** platform.kimi.ai (was platform.moonshot.ai - now 301 redirect).
Append `.md` to any docs URL to get clean markdown - the HTML pages render pricing/parameter tables via a JS component that WebFetch drops.
`curl -sL <url>.md` beats WebFetch on these: the .md still embeds those tables as a JSX `<DocTable rows={[...]}/>` literal, which curl gives you verbatim.
- Model list + deprecation/sunset notices: https://platform.kimi.ai/docs/models.md
- Pricing: https://platform.kimi.ai/docs/pricing/chat.md is only an index of cards; the numbers live in per-model pages `pricing/chat-k3.md`, `chat-k27-code.md`, `chat-k26.md`, `chat-k25.md`, `chat-v1.md` (a page can outlive its index card - K2.5's card is gone but chat-k25.md still serves)
- Skip https://platform.kimi.ai/docs/platform-changelog.md - abandoned, last entry 2025-04-07
- Per-model parameter matrix (thinking vs reasoning_effort, temperature/top_p/n locks, tool_choice): https://platform.kimi.ai/docs/api/models-overview.md
- API reference: https://platform.kimi.ai/docs/api/chat.md; machine-readable: https://platform.kimi.ai/docs/openapi.json (per-model request schemas)
- Full doc index: https://platform.kimi.ai/docs/llms.txt

**Do NOT use web search.** Fetch the URLs directly, or ask the user to provide data, if unaccessible.

**Live endpoint (extra signal):** If `.env.api-keys` has `MOONSHOT_API_KEY`, scan the served model list as ground-truth for what's new/available and cross-check the docs above: `curl https://api.moonshot.ai/v1/models -H "Authorization: Bearer $MOONSHOT_API_KEY"`. Never commit or echo the key.
Each entry carries capability flags worth diffing against the file: `supports_image_in`, `supports_video_in`, `supports_reasoning`, `supports_dynamic_tools`, `supports_thinking_type`, `think_efforts`/`reasoning_efforts` (valid list + default), `context_length`.

**Probing tips:** request validation runs before engine dispatch, so `invalid_request_error` vs `engine_overloaded_error` already tells you whether a param is accepted (K3 capacity is often tight - retry with backoff). Note `reasoning_effort` is NOT strictly validated (bogus values pass), so confirm effort levels with a reasoning-token differential, not with an error probe.

**Important:**
- Review the full model list for additions, removals, and price changes
- Minimize whitespace/comment changes, focus on content
- Preserve comments to make diffs easy to review
- Flag broken links or unexpected content
