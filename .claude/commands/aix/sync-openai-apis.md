---
description: Sync OpenAI API implementation with latest upstream documentation
argument-hint: specific feature to check
---

Please take a look at my API code for OpenAI: message wire types `src/modules/aix/server/dispatch/wiretypes/openai.wiretypes.ts`, assembly of the request messages (adapters) `src/modules/aix/server/dispatch/chatGenerate/adapters/openai.chatCompletions.ts`, and parsing of the response in streaming or not `src/modules/aix/server/dispatch/chatGenerate/parsers/openai.parser.ts`.

IMPORTANT: we prioritize the new Responses API, while Chat Completions is still supported but legacy.
We do NOT support other APIs such as Realtime (incl. websockets), etc.
We also do not support Agentic APIs (Agent SDK, AgentKit, ChatKit, Assistants API etc), as we perform similar functionality in AIX (server or client side).

Then take a look at the newest API information available. Try these sources, and be creative if some are blocked:

**Primary Sources:**
- Responses API (AIX prioritizes it): https://platform.openai.com/docs/api-reference/responses/create
- Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- Changelog: https://platform.openai.com/docs/changelog
- Models: https://platform.openai.com/docs/models
- Pricing (use Copy Page button to download markdown): https://platform.openai.com/docs/pricing

**Alternative Sources if primary blocked:**
- OpenAI Node.js SDK: https://github.com/openai/openai-node
- OpenAI Python SDK: https://github.com/openai/openai-python
- OpenAI OpenAPI spec: https://github.com/openai/openai-openapi
  Recent news and announcements: Web Search for "openai api changelog" or "openai new models" or "openai new prices"

**If all blocked:** Explain what you attempted and ask user to provide documentation manually.

$ARGUMENTS
Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc.
Prioritize breaking changes and new capabilities that would improve the user experience.