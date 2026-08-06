---
description: Sync Google Gemini API implementation with latest upstream documentation
argument-hint: specific feature to check
---

Please take a look at my API code for Google Gemini: message wire types `src/modules/aix/server/dispatch/wiretypes/gemini.wiretypes.ts`, assembly of the request messages (adapters) `src/modules/aix/server/dispatch/chatGenerate/adapters/gemini.generateContent.ts`, and parsing of the response in streaming or not `src/modules/aix/server/dispatch/chatGenerate/parsers/gemini.parser.ts`.

IMPORTANT: we only support the generateContent API, not other Gemini APIs such as embeddings, etc.
Caching is only supported when implicit, we do not explicitly manage Gemini Caches. Same for file uploads and other systems.
Image generation happens through models, i.e. 'Gemini 2.5 Flash - Nano Banana' generates images using AIX from generateContent (chat input).

Then take a look at the newest API information available. Try these sources, and be creative if some are blocked:

**Primary Sources:**
- Docs API 1/2: https://ai.google.dev/api/generate-content
- Docs API 2/2: https://ai.google.dev/api/caching#Content
- Release notes: https://ai.google.dev/gemini-api/docs/changelog

**Alternative Sources if primary blocked:**
- Google AI JavaScript SDK: https://github.com/googleapis/js-genai (check latest commits, README, type definitions)
  Recent news and announcements: Web Search for "gemini api changelog" or "nwe gemini api updates" or "new gemini api pricing"

**If all blocked:** Explain what you attempted and ask user to provide documentation manually.

$ARGUMENTS
Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc.
Prioritize breaking changes and new capabilities that would improve the user experience.