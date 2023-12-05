# Environment Variables

This document provides an explanation of the environment variables used in the big-AGI application.

**All variables are optional**; and _UI options_ take precedence over _backend environment variables_,
which take place over _defaults_. This file is kept in sync with [`../src/server/env.mjs`](../src/server/env.mjs).

### Setting Environment Variables

Environment variables can be set by creating a `.env` file in the root directory of the project.

The following is an example `.env` for copy-paste convenience:

```bash
# Database
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# LLMs
OPENAI_API_KEY=
OPENAI_API_HOST=
OPENAI_API_ORG_ID=
AZURE_OPENAI_API_ENDPOINT=
AZURE_OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_API_HOST=
OLLAMA_API_HOST=
OPENROUTER_API_KEY=

# Model Observability: Helicone
HELICONE_API_KEY=

# Text-To-Speech
ELEVENLABS_API_KEY=
ELEVENLABS_API_HOST=
ELEVENLABS_VOICE_ID=
# Text-To-Image
PRODIA_API_KEY=
# Google Custom Search
GOOGLE_CLOUD_API_KEY=
GOOGLE_CSE_ID=
# Browse
PUPPETEER_WSS_ENDPOINT=

# Backend Analytics
BACKEND_ANALYTICS=
```

## Variables Documentation

### Database

To enable features such as Chat Link Shring, you need to connect the backend to a database. We require
serverless Postgres, which is available on Vercel, Neon and more.

Also make sure that you run `npx prisma db:push` to create the initial schema on the database for the
first time (or update it on a later stage).

| Variable                   | Description                                                                                                                                                     |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `POSTGRES_PRISMA_URL`      | The URL of the Postgres database used by Prisma - example: `postgres://USER:PASS@SOMEHOST.postgres.vercel-storage.com/SOMEDB?pgbouncer=true&connect_timeout=15` |
| `POSTGRES_URL_NON_POOLING` | The URL of the Postgres database without pooling                                                                                                                |

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
| `OLLAMA_API_HOST`           | Changes the backend host for the Ollama vendor. See [config-ollama.md](config-ollama.md)                                      |                                                                   |
| `OPENROUTER_API_KEY`        | The API key for OpenRouter                                                                                                    | Optional                                                          |

### Model Observability: Helicone

Helicone provides observability to your LLM calls. It is a paid service, with a generous free tier.
It is currently supported for:

- **Anthropic**: by setting the Helicone API key, Helicone is automatically activated
- **OpenAI**: you also need to set `OPENAI_API_HOST` to `oai.hconeai.com`, to enable routing

| Variable           | Description              |
|--------------------|--------------------------|
| `HELICONE_API_KEY` | The API key for Helicone |

### Specials

Enable the app to Talk, Draw, and Google things up.

| Variable                 | Description                                                                                                             |
|:-------------------------|:------------------------------------------------------------------------------------------------------------------------|
| **Text-To-Speech**       | [ElevenLabs](https://elevenlabs.io/) is a high quality speech synthesis service                                         |
| `ELEVENLABS_API_KEY`     | ElevenLabs API Key - used for calls, etc.                                                                               |
| `ELEVENLABS_API_HOST`    | Custom host for ElevenLabs                                                                                              |
| `ELEVENLABS_VOICE_ID`    | Default voice ID for ElevenLabs                                                                                         |
| **Google Custom Search** | [Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)  produces links to pages        |
| `GOOGLE_CLOUD_API_KEY`   | Google Cloud API Key, used with the '/react' command - [Link to GCP](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CSE_ID`          | Google Custom/Programmable Search Engine ID - [Link to PSE](https://programmablesearchengine.google.com/)               |
| **Text-To-Image**        | [Prodia](https://prodia.com/) is a reliable image generation service                                                    |
| `PRODIA_API_KEY`         | Prodia API Key - used with '/imagine ...'                                                                               |
| **Browse**               |                                                                                                                         |
| `PUPPETEER_WSS_ENDPOINT` | Puppeteer WebSocket endpoint - used for browsing, etc.                                                                  |
| **Backend**              |                                                                                                                         | 
| `BACKEND_ANALYTICS`      | Semicolon-separated list of analytics flags (see backend.analytics.ts). Flags: `domain` logs the responding domain.     |

---



