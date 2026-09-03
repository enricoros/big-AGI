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

Most cloud vendors support CSF (OpenAI, Anthropic, Gemini, Deepseek, Groq, Mistral, xAI, Meta AI, OpenRouter, Perplexity, Together AI, Alibaba, Cohere, Moonshot, Z.ai, Cerebras, Azure). Cerebras defaults CSF on; the others are opt-in. Modular and Sakana serve no CORS headers at all, NVIDIA's hosted endpoint allowlists `*.nvidia.com` origins only (CSF there requires a custom host), Bedrock has no CORS, and Moonshot's Kimi Code subscription host 404s the preflight - all four are excluded in the vendor files. Local vendors (Ollama, LocalAI, LM Studio) require CORS enabled on the local server.

## Request headers on the CSF path

A non-safelisted request header forces a CORS preflight, so on CSF every added header is a compatibility risk that does not exist server-side. Measured across all vendor hosts 2026-08-14 (one US vantage; vendor CORS config changes without notice), hosts split in two:

- **Reflective** - echo back whatever `Access-Control-Request-Headers` asks for, so any header name is safe: OpenAI, Groq, Deepseek, Cerebras, Together, Z.ai, Alibaba, Cohere, Anthropic, xAI (wildcard), and Meta AI (wildcard origin + headers, also on error responses - measured 2026-09-02).
- **Static allowlist** - anything unlisted fails the preflight, and the browser request with it: OpenRouter (`HTTP-Referer`, `X-Title`, `X-OpenRouter-Title`, `X-OpenRouter-Categories`, `X-Stainless-*` are listed), Perplexity (`x-title`, `x-source`), Mistral (`X-Mistral-User-Agent` is the only identity slot), Fireworks (`HTTP-Referer`, `X-Title`), Moonshot (`referer`, `x-stainless-lang`), Gemini (`x-goog-api-key`, `x-goog-api-client` - anything else makes Google return 403 on the preflight itself).

Consequence: a uniform app-identity header applied to every vendor is a CSF outage on the six allowlist hosts. Identity headers belong on the server path by default; on the CSF path only per-vendor allowlisted names may be added. `User-Agent` is settable server-side only - browsers refuse to set it, whatever the allowlist says. Adding these headers does not change CORS on the actual response anywhere; the preflight is the only risk surface.

Unrelated CSF trap found in the same pass: a wrong OpenAI key (and any Cerebras 401) returns no `access-control-allow-origin`, so the browser surfaces an opaque CORS `TypeError` instead of the readable 401.

## UI

The CSF toggle appears in each vendor's setup panel under "Advanced" settings, labeled "Direct Connection". It becomes visible when the prerequisites are met (API key present for cloud vendors, host configured for local vendors). The setting is managed through `useModelServiceClientSideFetch` hook which provides `csfAvailable`, `csfActive`, `csfToggle`, and `csfReset` for UI consumption.
