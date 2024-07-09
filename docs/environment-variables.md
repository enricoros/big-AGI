# Environment Variables

This document provides an explanation of the environment variables used in the big-AGI application.

**All variables are optional**; and _UI options_ take precedence over _backend environment variables_,
which take place over _defaults_. This file is kept in sync with [`../src/server/env.mjs`](../src/server/env.mjs).

### Setting Environment Variables

Environment variables can be set by creating a `.env` file in the root directory of the project.

The following is an example `.env` for copy-paste convenience:

```bash
# Database (Postgres)
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Database (MongoDB)
MDB_URI=

# LLMs
OPENAI_API_KEY=
OPENAI_API_HOST=
OPENAI_API_ORG_ID=
AZURE_OPENAI_API_ENDPOINT=
AZURE_OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_API_HOST=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
LOCALAI_API_HOST=
LOCALAI_API_KEY=
MISTRAL_API_KEY=
OLLAMA_API_HOST=
OPENROUTER_API_KEY=
PERPLEXITY_API_KEY=
TOGETHERAI_API_KEY=

# Model Observability: Helicone
HELICONE_API_KEY=

# Browse
PUPPETEER_WSS_ENDPOINT=

# Search
GOOGLE_CLOUD_API_KEY=
GOOGLE_CSE_ID=

# Text-To-Speech: ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_API_HOST=
ELEVENLABS_VOICE_ID=
# Text-To-Image: Prodia
PRODIA_API_KEY=

# Backend HTTP Basic Authentication (see `deploy-authentication.md` for turning on authentication)
HTTP_BASIC_AUTH_USERNAME=
HTTP_BASIC_AUTH_PASSWORD=

# Backend Analytics Flags
BACKEND_ANALYTICS=


# Frontend variables
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_PLANTUML_SERVER_URL=
```

## Backend Variables

These variables are used only by the server-side code, at runtime. Define them before running the nextjs local server (in development or
cloud deployment), or pass them to Docker (--env-file or -e) when starting the container.

### Database

To enable Chat Link Sharing, you need to connect the backend to a database. We currently support Postgres and MongoDB.

For Database configuration see [deploy-database.md](deploy-database.md).

### LLMs

The following variables when set will enable the corresponding LLMs on the server-side, without
requiring the user to enter an API key

| Variable                    | Description                                                                                                                   | Required                                                          |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| `OPENAI_API_KEY`            | API key for OpenAI                                                                                                            | Recommended                                                       |
| `OPENAI_API_HOST`           | Changes the backend host for the OpenAI vendor, to enable platforms such as Helicone and CloudFlare AI Gateway                | Optional                                                          |
| `OPENAI_API_ORG_ID`         | Sets the "OpenAI-Organization" header field to support organization users                                                     | Optional                                                          |
| `AZURE_OPENAI_API_ENDPOINT` | Azure OpenAI endpoint - host only, without the path                                                                           | Optional, but if set `AZURE_OPENAI_API_KEY` must also be set      |
| `AZURE_OPENAI_API_KEY`      | Azure OpenAI API key, see [config-azure-openai.md](config-azure-openai.md)                                                    | Optional, but if set `AZURE_OPENAI_API_ENDPOINT` must also be set |
| `ANTHROPIC_API_KEY`         | The API key for Anthropic                                                                                                     | Optional                                                          |
| `ANTHROPIC_API_HOST`        | Changes the backend host for the Anthropic vendor, to enable platforms such as [config-aws-bedrock.md](config-aws-bedrock.md) | Optional                                                          |
| `DEEPSEEK_API_KEY`          | The API key for Deepseek AI                                                                                                   | Optional                                                          |
| `GEMINI_API_KEY`            | The API key for Google AI's Gemini                                                                                            | Optional                                                          |
| `GROQ_API_KEY`              | The API key for Groq Cloud                                                                                                    | Optional                                                          |
| `LOCALAI_API_HOST`          | Sets the URL of the LocalAI server, or defaults to http://127.0.0.1:8080                                                      | Optional                                                          |
| `LOCALAI_API_KEY`           | The (Optional) API key for LocalAI                                                                                            | Optional                                                          |
| `MISTRAL_API_KEY`           | The API key for Mistral                                                                                                       | Optional                                                          |
| `OLLAMA_API_HOST`           | Changes the backend host for the Ollama vendor. See [config-local-ollama.md](config-local-ollama)                             |                                                                   |
| `OPENROUTER_API_KEY`        | The API key for OpenRouter                                                                                                    | Optional                                                          |
| `PERPLEXITY_API_KEY`        | The API key for Perplexity                                                                                                    | Optional                                                          |
| `TOGETHERAI_API_KEY`        | The API key for Together AI                                                                                                   | Optional                                                          |

### LLM Observability: Helicone

Helicone provides observability to your LLM calls. It is a paid service, with a generous free tier.
It is currently supported for:

- **Anthropic**: by setting the Helicone API key, Helicone is automatically activated
- **OpenAI**: you also need to set `OPENAI_API_HOST` to `oai.hconeai.com`, to enable routing

| Variable           | Description              |
|--------------------|--------------------------|
| `HELICONE_API_KEY` | The API key for Helicone |

### Features

Enable the app to Talk, Draw, and Google things up.

| Variable                   | Description                                                                                                             |
|:---------------------------|:------------------------------------------------------------------------------------------------------------------------|
| **Text-To-Speech**         | [ElevenLabs](https://elevenlabs.io/) is a high quality speech synthesis service                                         |
| `ELEVENLABS_API_KEY`       | ElevenLabs API Key - used for calls, etc.                                                                               |
| `ELEVENLABS_API_HOST`      | Custom host for ElevenLabs                                                                                              |
| `ELEVENLABS_VOICE_ID`      | Default voice ID for ElevenLabs                                                                                         |
| **Text-To-Image**          | [Prodia](https://prodia.com/) is a reliable image generation service                                                    |
| `PRODIA_API_KEY`           | Prodia API Key - used with '/imagine ...'                                                                               |
| **Google Custom Search**   | [Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)  produces links to pages        |
| `GOOGLE_CLOUD_API_KEY`     | Google Cloud API Key, used with the '/react' command - [Link to GCP](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CSE_ID`            | Google Custom/Programmable Search Engine ID - [Link to PSE](https://programmablesearchengine.google.com/)               |
| **Browse**                 |                                                                                                                         |
| `PUPPETEER_WSS_ENDPOINT`   | Puppeteer WebSocket endpoint - used for browsing (pade downloadeing), etc.                                              |
| **Backend**                |                                                                                                                         |
| `BACKEND_ANALYTICS`        | Semicolon-separated list of analytics flags (see backend.analytics.ts). Flags: `domain` logs the responding domain.     |
| `HTTP_BASIC_AUTH_USERNAME` | See the [Authentication](deploy-authentication.md) guide. Username for HTTP Basic Authentication.                       |
| `HTTP_BASIC_AUTH_PASSWORD` | Password for HTTP Basic Authentication.                                                                                 |

### Frontend Variables

The value of these variables are passed to the frontend (Web UI) - make sure they do not contain secrets.

| Variable                          | Description                                                                              |
|:----------------------------------|:-----------------------------------------------------------------------------------------|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID`  | The measurement ID for Google Analytics 4. (see [deploy-analytics](deploy-analytics.md)) |
| `NEXT_PUBLIC_PLANTUML_SERVER_URL` | The URL of the PlantUML server, used for rendering UML diagrams. (code in RederCode.tsx) |

> Important: these variables must be set at build time, which is required by Next.js to pass them to the frontend.
> This is in contrast to the backend variables, which can be set when starting the local server/container.

---

For a higher level overview of backend code and environment customization,
see the [big-AGI Customization](customizations.md) guide.
