---
description: Sync Anthropic API implementation with latest upstream documentation
argument-hint: specific feature to check
---

Please take a look at my API code for Anthropic: message wire types `src/modules/aix/server/dispatch/wiretypes/anthropic.wiretypes.ts`, assembly of the request messages (adapters) `src/modules/aix/server/dispatch/chatGenerate/adapters/anthropic.messageCreate.ts`, and parsing of the response in streaming or not `src/modules/aix/server/dispatch/chatGenerate/parsers/anthropic.parser.ts`.

IMPORTANT: we only support the Messages API (message create). We do NOT support other APIs such as the older Completions API.
We support Anthropic caching natively, and want to make sure tools and state (crafting the history) are also done well.

Then take a look at the newest API information available. Try these sources, and be creative if some are blocked:

**Primary Sources:**
- Docs API: https://docs.claude.com/en/api/messages
- Release notes: https://docs.claude.com/en/release-notes/api
- Tools use: https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview
- Handling stop reasons: https://docs.claude.com/en/api/handling-stop-reasons

**Alternative Sources if primary blocked:**
- Anthropic TypeScript SDK: https://github.com/anthropics/anthropic-sdk-typescript
- Anthropic Python SDK: https://github.com/anthropics/anthropic-sdk-python
- Recent news and announcements: Web Search for "anthropic api changelog" or "new claude api" or "new claude api pricing"

**If all blocked:** Explain what you attempted and ask user to provide documentation manually.

$ARGUMENTS
Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc.
Prioritize breaking changes and new capabilities that would improve the user experience.