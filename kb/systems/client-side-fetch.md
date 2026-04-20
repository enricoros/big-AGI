# CSF - Client-Side Fetch

Client-Side Fetch (CSF), surfaced to users as **"Direct Connection"**, enables direct browser-to-API communication, bypassing the server for LLM requests. When enabled, the browser makes requests directly to vendor APIs (e.g., `api.openai.com`, `api.groq.com`) instead of routing through the Next.js server. This reduces latency, decreases server load, and is particularly useful for local models where the browser can communicate directly with Ollama or LM Studio.

## User-facing tradeoffs (Direct Connection vs via-server)

Wins when Direct Connection is on:
- **No 4.5MB upload limit** (Vercel body-size cap does not apply to direct browser-to-API requests).
- **No 300s function timeout** (Vercel serverless/edge timeout does not apply; call duration is bound only by the AI service).
- **More privacy**: connection metadata (IP, timestamp, edge region, Vercel telemetry) is not observable by the Big-AGI edge server.

Costs:
- **Slightly more downlink bandwidth**: when traffic passes through the Big-AGI server, repetitive streaming frames are shed/compacted; direct streams arrive verbatim.

Availability requires both:
1. The API key is on the **client** (localStorage), not a server-side env var. Server-key deployments cannot use CSF because the browser has no credential to send.
2. The AI service **allows CORS** from browsers. Most major providers do; some require specific headers which Big-AGI sets.

Net: Direct Connection is a win on speed, limits, and privacy whenever the provider permits it. It is unavailable when keys are server-side or the provider blocks browser-origin requests.

## Implementation

CSF is implemented as an opt-in setting stored as `csf: boolean` in each vendor's service settings. The vendor interface exposes `csfAvailable?: (setup) => boolean` to determine if CSF can be enabled (typically checking if an API key or host is configured). The actual execution happens in `aix.client.direct-chatGenerate.ts` which dynamically imports when CSF is active, making direct fetch calls using the same wire protocols as the server.

All 20+ supported vendors (OpenAI, Anthropic, Gemini, Ollama, LocalAI, Deepseek, Groq, Mistral, xAI, OpenRouter, Perplexity, Together AI, Alibaba, Moonshot, OpenPipe, LM Studio, Z.ai, Azure, Bedrock) support CSF. Cloud vendors require CORS support from the API provider (all tested vendors return `access-control-allow-origin: *`). Local vendors (Ollama, LocalAI, LM Studio) require CORS to be enabled on the local server.

## UI

The CSF toggle appears in each vendor's setup panel under "Advanced" settings, labeled "Direct Connection". It becomes visible when the prerequisites are met (API key present for cloud vendors, host configured for local vendors). The setting is managed through `useModelServiceClientSideFetch` hook which provides `csfAvailable`, `csfActive`, `csfToggle`, and `csfReset` for UI consumption.
