---
description: Sync xAI Responses API implementation with latest upstream documentation
argument-hint: specific feature to check
---

Review the xAI Responses API implementation:
- xAI wire types: `src/modules/aix/server/dispatch/wiretypes/xai.wiretypes.ts` (xAI-specific request schema, tools)
- Request adapter: `src/modules/aix/server/dispatch/chatGenerate/adapters/xai.responsesCreate.ts` (AIX → xAI Responses API)
- Response parser: `src/modules/aix/server/dispatch/chatGenerate/parsers/openai.responses.parser.ts` (shared with OpenAI Responses)
- Dispatch routing: `src/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch.ts` (dialect='xai' routing)
- OpenAI shared types: `src/modules/aix/server/dispatch/wiretypes/openai.wiretypes.ts` (InputItem/OutputItem schemas reused by xAI)

IMPORTANT context:
- We use ONLY the xAI Responses API (`POST /v1/responses`). We do NOT use the Chat Completions API (`/v1/chat/completions`) for xAI anymore.
- xAI's Responses API is similar to OpenAI's but has key differences - the skill should find what changed since our last sync.
- Response streaming/parsing reuses the OpenAI Responses parser since the format is compatible.
- We do NOT implement: Files API, Collections Search, Remote MCP tools, Voice Agent API, Image/Video generation, Batch API, or Deferred Completions.

Then take a look at the newest API information available. Try these sources, and be creative if some are blocked:

**Primary Sources (guide pages work well with WebFetch despite being JS-rendered):**
- Responses API Guide: https://docs.x.ai/docs/guides/chat
- Stateful Responses: https://docs.x.ai/docs/guides/responses-api
- Tools Overview: https://docs.x.ai/docs/guides/tools/overview
- Search Tools (web_search, x_search): https://docs.x.ai/docs/guides/tools/search-tools
- Code Execution Tool: https://docs.x.ai/docs/guides/tools/code-execution-tool
- Function Calling: https://docs.x.ai/docs/guides/function-calling
- Streaming: https://docs.x.ai/docs/guides/streaming-response
- Reasoning: https://docs.x.ai/docs/guides/reasoning
- Structured Outputs: https://docs.x.ai/docs/guides/structured-outputs
- Models & Pricing: https://docs.x.ai/developers/models
- Release Notes: https://docs.x.ai/developers/release-notes
- API Reference: https://docs.x.ai/developers/api-reference#create-new-response

**Alternative Sources if primary blocked:**
- xAI Python SDK: https://github.com/xai-org/xai-sdk-python
- Web Search for "xai grok api changelog 2026" or "xai responses api new features"

**If all blocked:** Explain what you attempted and ask user to provide documentation manually.

$ARGUMENTS
Check carefully for discrepancies between our implementation and the current API docs:

1. **Request fields**: Compare `XAIWire_API_Responses.Request_schema` against current docs - any new, changed, or deprecated parameters?
2. **Tool definitions**: Compare `XAIWire_Responses_Tools` - any new parameters on web_search/x_search/code_interpreter? Any new hosted tool types?
3. **Input/Output item types**: Any xAI-specific output items not handled by the shared OpenAI parser (e.g., x_search_call, web_search_call, code_interpreter_call)?
4. **Streaming events**: Any xAI-specific SSE event types beyond what the OpenAI Responses parser handles?
5. **Response shape**: Usage reporting differences, new fields in the response object?
6. **Adapter logic**: Message role mapping, content type handling, system message approach - still correct?
7. **Include options**: Any new values for the `include` array?
8. **Reasoning config**: Which models support it and with what values?

Prioritize breaking changes and new capabilities that would improve the user experience.
When making changes, add comments with date: `// [xAI, 2026-MM-DD]: explanation`

**Self-update this skill**: After completing the sync, if your research reveals that assumptions in THIS skill file (`.claude/commands/aix/sync-xai-api.md`) are wrong or outdated - e.g., new APIs we now implement, new tool types added, URLs moved, file paths changed - update this skill file to stay accurate for next time.
