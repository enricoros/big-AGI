# Security Model

How big-AGI is exposed, what it protects, and which attackers matter. Complements [SECURITY.md](SECURITY.md) (reporting, scope, supported versions). Covers `main`: the open-source, local-first build.

## System

Next.js app. UI runs in the browser; chats persist in IndexedDB, user API keys in localStorage. The server is a set of tRPC routers with no authentication on `main` (`src/server/trpc/trpc.server.ts`: every procedure alias is bare `t.procedure`). Operators may set server-side vendor keys in env vars and an optional Postgres for shared links.

## Components

| Component         | Code                                                                                                                                                    |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| Web client        | `pages/`, `src/apps/`, `src/common/`, `public/`                                                                                                         |
| Blocks            | `src/modules/blocks/` (Markdown, Mermaid, SVG, PlantUML, HTML iframe), `src/apps/chat/components/live-svg/`                                             |
| AIX/LLM           | `app/api/edge/`, `src/modules/aix/`, `src/modules/llms/`, `src/modules/speex/`, `src/modules/t2i/`                                                      |
| Browse & fetchers | `app/api/cloud/`, `src/modules/browse/`, `src/modules/youtube/`, `src/modules/google/`, `src/modules/backend/`, `src/server/trpc/trpc.router.fetchers.ts` |
| Share links       | `src/modules/trade/`, `src/server/prisma/`, `pages/link/`                                                                                               |
| Infra             | `Dockerfile`, `docker-compose.yaml`, `docs/k8s/`, `docs/docker/`, `next.config.ts`, `.github/workflows/`                                                |

## Trust boundaries and entry points

- Browser -> server: `/api/edge/[trpc]` (AIX, vendor routers, Speex, YouTube, Google, backend capabilities) and `/api/cloud/[trpc]` (browse, share links). Reachable by anyone who can reach the server; on `main` access control is the operator's job (reverse proxy, HTTP Basic Auth middleware, see [deploy-authentication](docs/deploy-authentication.md)).
- Other web pages -> a local install: pages the user visits can send requests to `http://localhost:3000`, and DNS rebinding can make them same-origin with it.
- Server -> vendors and hosts: client-supplied hosts (`ollamaHost`, `oaiHost`, LocalAI, Azure, the browse `wssEndpoint`) make the server connect where the caller asks, including loopback and LAN.
- Untrusted content -> app origin: LLM output (steerable by prompt injection from browsed pages, attachments, YouTube transcripts), imported or shared chats, rendered by Blocks in the app origin.
- CSF: the browser calls vendors directly with the user's key, where CORS allows.

## Assets

- User API keys (localStorage) and chat history (IndexedDB): an XSS in the app origin reads both.
- Server-side vendor keys (env): quota and billing abuse by anyone who can call the routers.
- Shared-link database (Postgres): link content, `deletionKey`, metadata.
- The server's network position: loopback, LAN, cloud metadata endpoints (SSRF).

## Attackers

| Attacker                          | Reaches                                                                                              |
|-----------------------------------|------------------------------------------------------------------------------------------------------|
| Content author                    | Chat content via prompt injection, documents, browsed pages, shared links. Targets Blocks rendering. |
| Malicious web page                | A local install via cross-site requests or DNS rebinding, while the user runs big-AGI.               |
| Network attacker                  | The routers directly, only when the operator exposes the server without access control.             |
| Supply chain                      | npm dependencies, CDN-loaded Mermaid and Chart.js, CI workflows.                                     |

## Existing controls

- Zod validation on tRPC inputs; browse accepts only `http(s)` page URLs.
- SVG sanitized with DOMPurify (`src/common/util/svgSanitizeUtils.ts`); HTML preview iframe sandboxed without `allow-same-origin` (`RenderCodeHtmlIFrame.tsx`).
- Docker image runs as non-root `nextjs`.

## Out of scope

Per [SECURITY.md](SECURITY.md): upstream AI vendor APIs, and infrastructure operators run themselves (reverse proxies, hosting platforms).

## Open questions

- Host/Origin validation on the tRPC routes, against DNS rebinding of local installs.
- Destination filtering for client-supplied hosts and browse URLs.
- Size and expiry limits on shared-link writes.
