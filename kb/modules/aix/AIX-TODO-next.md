# AIX TODO: next

This document contains inptus, requirements, roadmap items `[ ] -> [x]` for next pieces for AIX.
As with `AIX-TODO-errors.md` this is partially defined by the author, and largely added to by AI, so please let's validate the architecture and choices before we implement them, we do not want accumulation of hallucinations.

== what precedes was written by the author, what follows is added by AI ==

Inputs for planned AIX work other than error handling ([AIX-TODO-errors.md](AIX-TODO-errors.md)). One line per item; a larger item gets its own `AIX-TODO-*.md` page.

## Requests

- OpenAI: hosted-tool loops that outgrow the context window (#1211): [AIX-TODO-openai-context-compaction.md](AIX-TODO-openai-context-compaction.md)
- `tool_choice` `auto` on every dialect: measure how often each vendor skips the call under `auto` with the steering hint, for the four forced callers (diagram, auto UI, code fixup, attachment prompts), then switch
- Forced call with hosted tools on: xAI and Gemini keep web search and code execution, so the model can satisfy the forced call with a hosted tool and skip ours; Anthropic, OpenAI and OpenRouter drop them. Needs a probe
- Bedrock: Mantle uses the OpenAI dialect, so Kimi and DeepSeek get a forced call with thinking on, which the native dialects work around; a Claude 5.x model on Converse sends a forced call with no fallback. Needs a probe
- Gemini: continuation support (`requires_continuation` on Interactions, the `CONTINUATION` finish reason on generateContent); both are only read today
- Anthropic: the system prompt changes with the hour tick and resets preserved thinking; root fix parked

## Responses

- Counts: Gemini searches are counted in queries, Google's own messages count calls (one call can carry several queries); the billing unit is unverified
- Counts: an OpenAI run that ends without its terminal event reports no searches or fetches (#1288 keeps its error text, not its counts)
- Open departures from the lossless rule are listed in [AIX-ingestion.md](../AIX-ingestion.md): a 0-byte Gemini file is skipped, a failed OpenAI image is stored as composed text, thinking is not replayed with thinking off on Haiku 5.x and Sonnet 5.x
- Meta AI: Spark's code fixup answers in text without calling; re-measure with the steering hint

## Model data

- Sakana's search fee is never priced
- The gpt-image-1-mini quality clamp is stale
- Arena scores in the definitions lag the snapshot quoted by the editorial picks

## From the tool_choice downgrade pass

- Mistral accepts a forced call now (`required` and `any` return 200); it goes out as `auto` with the hint because Mistral Small 4 writes the answer as text before a forced call, at times without ever calling. Re-check per model before switching it back
- Moonshot: the K3 exception matches `k3` and `kimi-k3*` only; the Kimi Code ids (`k3-256k`, `k3.1-pro`, `k3.1-pro-highspeed`) get the downgrade, and whether they accept a forced call is unprobed
- Anthropic keeps its own copy of the steering hint text; it could use the shared `AIX_FORCED_TOOLS_HINT_TEXT`
- `probe.scenarios.ts`: the line saying forced calls work on OpenAI, xAI, Gemini and Bedrock is unverified; the DeepSeek V4 line says thinking is always on, while the adapter turns it off under a forced call
