# CLAUDE.md

Guidance to Claude Code when working with code in this repository.


## Architecture Overview

**Stack**: Next.js 15 (Pages Router for pages, App Router for API routes only), React 18, Emotion (CSS-in-JS), Zustand, tRPC + TanStack React Query, Edge runtime for AI and Node.js for data ops. UI is Material-UI **Joy**, not Material: import from `@mui/joy`; `next.config.ts` webpack-aliases `@mui/material` -> `@mui/joy` so stray/transitive Material imports still resolve to Joy (webpack only - turbopack skips that hook).

**Distinctive**, vs other chat UIs: Beam runs N models in parallel and fuses the answers (scatter/gather); every vendor sits behind one AIX protocol layer, reusing a few wire dialects instead of one integration each; chat is stored client-side in IndexedDB by default; BYO-keys (self-hosters may additionally set server-side vendor keys in env vars); AI calls can go browser-direct to the vendor (CSF); messages are typed fragments, not strings; personas and multi-pane conversations are first-class.

### Development Commands

Dev servers may already run on ports 3xxx, started by the user or other agents: never kill those.

```bash
# Validate - safe while a dev server runs, and far quicker than `next build` for the same checks
npm run tscheck && npm run lint  # includes npm install

# Full build - slow, only when suspecting runtime/bundle issues
npm run build  # compile+lint+types, stops at the first type-error file; tsc shows all at once
```

For AI protocol development (model listing, live API requests/responses, parameter probing), real vendor API keys are in `.env.api-keys` if present (one VENDOR_API_KEY per line). Use them for empirical verification; never commit or echo the values.

### Git

Remotes: `opensource` -> `enricoros/big-AGI` (public, MIT, default `main`) for community issues, PRs and releases; `private` -> `big-agi/big-agi-private` (default `dev`, then `staging` -> `prod`) for development.
- Never push to `opensource`: commits on `main` are the user's. Push to `private` only when asked in the session, and only to the branch named
- `git mv` for renames, not `mv`; never `git stash`
- Commit subjects `Area: terse imperative` (`LLMs: OpenAI: ...`, `Build: ...`), one line, no body unless needed, no `Co-Authored-By` trailer

**Branches:** `main` is the open-source build: local-first, BYO-keys, full AIX and provider coverage. `dev` is `main` plus the hosted layer (auth, ZYNC sync, Cloud Fabric, Stripe, multi-tenant, admin pages); that layer never crosses to `main`, shared foundations (UX, AIX, model support, fixes) land on either.

**`dev` is rebased on `main`, never merged**, so a change on `main` replays through `dev`'s whole history: think it through for `dev` too, and never port `main` -> `dev` by hand.
- Backport `dev` -> `main` with the `code:backport` skill; land shared-file data (type unions, registry and editorial rows) on `main` early
- Forecast before rebasing. Files both lines changed can conflict; `git log -G'<old symbol>' main..dev` finds the `dev` commits that break silently when `main` removes or reshapes a symbol. Fix those at their origin commit (`edit` in `rebase -i`) so every intermediate commit still builds; later commits on adjacent lines, or a rename, will stop too
- Resolve at marker level, `dev`'s intent on `main`'s API; never blanket `-X theirs`/`-X ours` or whole-file takes. When `main` restructured code that `dev` kept changing, build the target tree first (`dev`'s tip plus the change in `dev`'s form) and gate on equality with it; past a few dozen stops, derive each stop's file by script, since hand resolution drifts
- Gate per stop: no error the original commit did not have. Commits whose content `main` now carries replay empty: drop and list them. Verify the tip with `git range-diff` and `npm run tscheck`
- Traps: `--onto <base> <merge-base>` dedups cherry-picks against the merge-base and replays them into conflicts, so use plain `git rebase <base> <branch>`; trial runs need `-c rerere.enabled=false`, or `rerere.autoupdate` replays mechanical resolutions silently; work on a scratch branch in a worktree, move `dev` only once verified

### Repository Layout

Run every command from the repository root: no `cd`, and no `cd dir && command`.

- `/app/api/` - App Router, API routes only (thin, mostly -> `/src/server/`)
- `/pages/` - Pages Router, the app's pages (thin, mostly -> `/src/apps/`)
- `/src/apps/` - self-contained app sections, entry `App*.tsx`
- `/src/modules/` - reusable business logic: `aix/` (AI streaming), `beam/` (scatter/gather), `blocks/` (content rendering), `llms/` (vendor abstraction), and more
- `/src/common/` - shared infrastructure and utilities (`util/` holds the shared helpers); `/src/server/` - tRPC backend
- `/kb/` - knowledge base, indexed in `kb/KB.md`

### Key Subsystems

**AIX** (`/src/modules/aix/`) - real-time AI communication, Client -> tRPC -> Server -> AI Providers. Particle-based streaming: `AixWire_Particles` -> `ContentReassembler` -> `DMessage`. Provider-agnostic adapters, one per wire dialect; streaming and non-streaming, with batching and error recovery.

**Beam** (`/src/modules/beam/`) - scatter/gather for parallel AI reasoning. Scatter: N models (rays) process the input in parallel. Gather: fusion algorithms combine outputs. Real-time UI via vanilla Zustand; one `BeamStore` per conversation, via `ConversationHandler`.

**Conversations** (`/src/common/stores/chat/`, `/src/common/chat-overlay/`) - overlay architecture, one handler per conversation. `ConversationHandler` orchestrates chat, beam and ephemerals; per-chat `PerChatOverlayStore` + `BeamStore`; messages are `DMessage` -> `DMessageFragment[]`; multi-pane with independent conversation states.

**Optima** (`/src/common/layout/optima/`) - the layout system: responsive desktop/mobile, Drawer(left)/Toolbar/Panel(right) composition, portal-based rendering for flexible component placement.

### Storage & State

Local-first, all Zustand in memory. Global stores `persist` to localStorage (discouraged for new state: it is global, not per-user; `dev` is moving stores to per-user and cloud-backed tiers), except chats, which go to IndexedDB (`keyval-store` -> `keyval` -> key `app-chats`, via `createIDBPersistStorage()`); binary blobs have their own Dexie database (`src/modules/dblobs/`). Version-based migrations handle structure changes, partialize/merge control what persists, rehydration repairs and upgrades data on load. Cross-app stores live in `/src/common/stores/`; apps and modules keep theirs beside the code, by the `store-*.ts` convention.

- **Per-instance stores** - vanilla Zustand, no React integration, suffixed `_vanilla` (beam, per-chat overlay, attachment drafts; expect refactor for agentic operation); module stores are `store-module-*`
- **Selectors** - always wrap multi-property selectors in `useShallow` from `zustand/react/shallow`

### Key Flows

- **Chat**: `Composer` -> `DMessage` -> `ConversationHandler.messageAppend()` -> `_handleExecute()` (in `src/apps/chat/editors/`) -> `runPersonaOnConversationHead()` -> AIX request -> `ContentReassembler` -> UI -> Zustand auto-persist to IndexedDB

### Development Patterns

#### Design
- Choose for the long term: modern, principled, scalable patterns over the file's current habits; one responsibility and a small surface per module, so concurrent agents edit different files. Design the shape the codebase will need, build the part asked for
- Improve or share the existing function rather than add a copy; what a second module could use goes in `src/common/`
- TS interfaces: discriminated unions so misuse fails at compile time, the fewest types that achieve it. Model on the best current pattern in the codebase, not the nearest one
- Comments carry the why and the contract: a short file header, notes on non-obvious shapes and decisions, none that restate the code
- Root claims in data: run it, measure it, read the logs, before asserting what the code or production does
- When touching a comment, clean it: drop expired history and anything of no value to the next reader
 
#### Irreversible (zero-regret) choices
- Cost to change, highest first: persisted data (on every user's disk, synced, no central migration: a format break is forever), then interfaces and coupling, then user habits (add or reshape, rarely remove), then UI, free to change
- Before a change in the upper tiers: list the options, pick the one later work extends rather than changes (new field, variant, module; never reinterpret an existing one), state choice and alternatives in the reply, keep going
- Precedent is not proof here: the code is mixed quality, so model on its well-made parts, not the nearest convention

#### UI & Icons
- Prefer `@mui/icons-material` icons already imported elsewhere in the app over new ones (keeps the bundle lean); new icons only for genuinely novel functionality

#### API Patterns
- Zod schemas validate API inputs/outputs, usually server-side, the client importing the inferred types
- No auth on `main`: `trpc.server.ts` installs no middleware, and every procedure alias in it resolves to bare `t.procedure` (the cloud layer lives on `dev`)

#### Security Considerations
- Server-side keys come from env vars only; client-held keys are user-supplied

#### Writing Style
- Never use emdashes (—), use normal dashes (-); never unicode symbols in place of ascii. In all generated text, code, comments, docs
- Register: sharp, terse, precise - in all prose (docs, UI copy, comments, commits, replies). No inflation, no sales tone, no clever headings (plain nouns). Cut sentences that carry no information


## Common Development Tasks

### Testing & Quality
- `npm test` runs `src/**/*.test.ts`. A test earns its place by driving the real code through a hard edge case, not by restating the implementation
- Browser floor: lint flags syntax and Web APIs below the engines we support; follow the rule messages, and never lower `browserslist` to silence them (SWC won't polyfill prototype methods)
- Production builds minify with SWC, which miscompiles some code shapes; `tools/eslint/swc-miscompile.mjs` bans the known ones

### Production errors
- `app.big-agi.com` is the deployed `dev` private build; triage its runtime errors via the PostHog MCP


## Server Architecture

Two tRPC routers, split by runtime: **Edge** (`/src/server/trpc/trpc.router-edge.ts`) for AI: AIX streaming, per-vendor LLM routers, Speex TTS, external services; **Cloud** (`/src/server/trpc/trpc.router-cloud.ts`) for Node-only data ops. One mount per vendor/service, so the router files are the list.
AIX, LLM and Speex also support **client-side fetch (CSF)**: the same code is rebundled with stubs and included client-side, so the browser can call the vendor directly where CORS allows, cutting latency and network barriers.

@kb/KB.md

@kb/vision-inlined.md
