# CSF - Client-Side Fetch

Client-Side Fetch (CSF) enables direct browser-to-API communication, bypassing the server for LLM requests. When enabled, the browser makes requests directly to vendor APIs (e.g., `api.openai.com`, `api.groq.com`) instead of routing through the Next.js server. This reduces latency, decreases server load, and is particularly useful for local models where the browser can communicate directly with Ollama or LM Studio.

## Implementation

CSF is implemented as an opt-in setting stored as `csf: boolean` in each vendor's service settings. The vendor interface exposes `csfAvailable?: (setup) => boolean` to determine if CSF can be enabled (typically checking if an API key or host is configured). The actual execution happens in `aix.client.direct-chatGenerate.ts` which dynamically imports when CSF is active, making direct fetch calls using the same wire protocols as the server.

All 16 supported vendors (OpenAI, Anthropic, Gemini, Ollama, LocalAI, Deepseek, Groq, Mistral, xAI, OpenRouter, Perplexity, Together AI, Alibaba, Moonshot, OpenPipe, LM Studio) support CSF. Cloud vendors require CORS support from the API provider (all tested vendors return `access-control-allow-origin: *`). Local vendors (Ollama, LocalAI, LM Studio) require CORS to be enabled on the local server.

## UI

The CSF toggle appears in each vendor's setup panel under "Advanced" settings, labeled "Direct Connection". It becomes visible when the prerequisites are met (API key present for cloud vendors, host configured for local vendors). The setting is managed through `useModelServiceClientSideFetch` hook which provides `csfAvailable`, `csfActive`, `csfToggle`, and `csfReset` for UI consumption.
