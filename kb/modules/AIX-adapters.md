# Anthropic API updates

### General look and update if something is different
```text
Please take a look at my API code for Anthropic: message wire types `anthropic.wiretypes.ts`, assembly of the request messages (adapters) `anthropic.messageCreate.ts`, and parsing of the response in streaming or not `anthropic.parser.ts`.
Then take a look at the newest API information available at the websites which I'm attaching:
- Docs API: https://docs.claude.com/en/api/messages
- Release notes: https://docs.claude.com/en/release-notes/api
- Tools use: https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview
- Handling stop reasons: https://docs.claude.com/en/api/handling-stop-reasons

Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc. Prioritize breaking changes and new capabilities that would improve the user experience.
```


# Gemini API Updates

### General look and update if something is different
```text
Please take a look at my API code for Google Gemini: message wire types `gemini.wiretypes.ts`, assembly of the request messages (adapters) `gemini.generateContent.ts`, and parsing of the response in streaming or not `gemini.parser.ts`.
Then take a look at the newest API information available at the websites which I'm attaching:
- Docs API 1/2: https://ai.google.dev/api/generate-content
- Docs API 2/2: https://ai.google.dev/api/caching#Content
- Release notes: https://ai.google.dev/gemini-api/docs/changelog

Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc. Prioritize breaking changes and new capabilities that would improve the user experience.
```


# OpenAI API Updates

### General look and update if something is different
```text
Please take a look at my API code for OpenAI: message wire types `openai.wiretypes.ts`, assembly of the request messages (adapters) `openai.chatCompletions.ts`, and parsing of the response in streaming or not `openai.parser.ts`.
Then take a look at the newest API information available at the websites which I'm attaching:
- Responses API (AIX prioritizes it): https://platform.openai.com/docs/api-reference/responses/create
- Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- Changelog: https://platform.openai.com/docs/changelog (check if accessible)
- Models: https://platform.openai.com/docs/models
- Pricing (there's a Copy Page button that downloads the markdown): https://platform.openai.com/docs/pricing

Check carefully and look if there are any discrepancies in the protocols, the available API surface, the structure of the messages, functionality, logic, etc.
Make sure you look deep in the fields of the requests and responses, especially required fields, streaming event types, and any new response shapes.

Please point out all of the differences in the API whether it's in the final parsing and reassembly of the streaming message, or the protocol changed, etc. Prioritize breaking changes and new capabilities that would improve the user experience.
```
