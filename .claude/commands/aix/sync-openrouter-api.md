---
description: Sync OpenRouter API implementation with latest upstream documentation
argument-hint: specific feature to check
---

Review the OpenRouter implementation:
- Models list: `src/modules/llms/server/openai/openrouter.wiretypes.ts` (list API response schema)
- Chat wire types: `src/modules/aix/server/dispatch/wiretypes/openai.wiretypes.ts` (OpenAI-compatible)
- Request adapter: `src/modules/aix/server/dispatch/chatGenerate/adapters/openai.chatCompletions.ts` ('openrouter' dialect)
- Response parser: `src/modules/aix/server/dispatch/chatGenerate/parsers/openai.parser.ts` (shared OpenAI parser)
- Vendor config: `src/modules/llms/vendors/openrouter/openrouter.vendor.ts`

GOAL: Ensure complete support for OpenRouter's API including advanced features like reasoning/thinking tokens, tool use, search integration, and multi-modal capabilities. OpenRouter is OpenAI-compatible but has important extensions and differences.

Use Task tool with subagent_type=Explore and thoroughness="very thorough" to discover:
1. Map API structure - all endpoints, parameters, capabilities from https://openrouter.ai/docs
2. **Advanced features** - How to use: reasoning/thinking tokens (o1, DeepSeek R1), tool use/function calling, search integration, multi-modal (vision/audio)
3. Changelog location - How does OpenRouter communicate API updates and breaking changes?
4. Model metadata - What capabilities are exposed in the models list API? How to detect feature support?
5. OpenAI deviations - Extensions, special headers (HTTP-Referer, X-Title), response fields, streaming differences

Then check the latest API information. Try these sources (be creative if blocked):

**Primary Sources:**
- API Reference: https://openrouter.ai/docs/api-reference
- Chat Completions: https://openrouter.ai/docs/api-reference#chat-completions
- Models List: https://openrouter.ai/docs/api-reference#models-list
- Parameters Guide: https://openrouter.ai/docs/parameters
- Announcements: https://openrouter.ai/announcements (feature launches, API updates, new models)
- Models Directory: https://openrouter.ai/models (check metadata for capabilities)

**Alternative Sources:**
- GitHub: https://github.com/OpenRouterTeam (SDKs, examples, issues for recent changes)
- Web Search: "openrouter api changelog" or "openrouter reasoning tokens" or "openrouter tool use"

**If blocked:** Ask user to provide documentation.

$ARGUMENTS
Focus on discrepancies and gaps:
- **Request/Response structure**: New fields, changed requirements, streaming event types
- **Feature support**: Thinking tokens format, tool calling protocol, search parameters
- **Model capabilities**: How to detect and enable advanced features per model
- **OpenRouter extensions**: Headers, routing, fallbacks, rate limiting (free vs paid)
- **Breaking changes**: Protocol updates, deprecated fields, new required parameters

Report differences in wire types, adapter logic, parser handling, or dialect-specific quirks.
Prioritize new capabilities that improve user experience (reasoning visibility, better tool use, etc.).

When making changes, add comments with date: `// [OpenRouter, 2025-MM-DD]: explanation`
