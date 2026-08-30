# CLAUDE.md

Guidance to Claude Code when working with code in this repository.


## Architecture Overview

**Stack**: Next.js 15 (Pages Router for pages, App Router for API routes only), React 18, Emotion (CSS-in-JS), Zustand, tRPC + TanStack React Query, Edge runtime for AI and Node.js for data ops. UI is Material-UI **Joy**, not Material: import from `@mui/joy`; `next.config.ts` webpack-aliases `@mui/material` -> `@mui/joy` so stray/transitive Material imports still resolve to Joy (webpack only - turbopack skips that hook).

**Distinctive**, vs other chat UIs: Beam runs N models in parallel and fuses the answers (scatter/gather); every vendor sits behind one AIX protocol layer, reusing a few wire dialects instead of one integration each; chat is stored client-side in IndexedDB by default; BYO-keys (self-hosters may additionally set server-side vendor keys in env vars); AI calls can go browser-direct to the vendor (CSF); messages are typed fragments, not strings; personas and multi-pane conversations are first-class.

### Development Commands

Dev servers may be already running on ports 3000, 3001, 3002, or 3003 (not always this app - other projects may occupy these ports). Never start or stop dev servers, let the user do it.

```bash
# Validate - safe while a dev server runs, and far quicker than `next build` for the same checks
npm run tscheck && npm run lint      # types (all projects), then a typed ESLint pass
eslint src/path/to/file.ts           # lint one file

# Full build - slow, only when suspecting runtime/bundle issues
npm run build  # compile+lint+types, but stops at the first type-error file; tsc shows all at once
```

For AI protocol development (model listing, live API requests/responses, parameter probing), real vendor API keys are in `.env.api-keys` if present (Anthropic, OpenAI, Gemini, etc., one VENDOR_API_KEY per line). Use them for empirical verification; never commit or echo the values.

### Git/GitHub remotes

The `gh` command is available to interact with GitHub from the terminal, but **NEVER PUSH TO ANY BRANCH**. The user manages all 'write' git operations.
- `opensource` -> `enricoros/big-AGI` (public, default branch: `main`, MIT) - community issues/PRs/releases
- `private` -> `big-agi/big-agi-private` (private, default branch: `dev`) - main dev repo with `dev`->`staging`->`prod` pipeline
- **Always use `git mv` instead of `mv`** when renaming or moving files - preserves git history tracking
- **NEVER run `git stash`** - it causes work loss
- **Commit subjects**: `Area: terse imperative` (e.g. `LLMs: OpenAI: ...`, `Build: ...`), single line, no body unless needed, and no `Co-Authored-By` trailer

**Branch contents:**
- `main` is the open-source build: local-first, BYO-keys, full AIX and provider coverage
- `dev` extends `main` with the hosted/cloud layer: auth, Zync sync, Cloud Fabric, Stripe, multi-tenant, admin pages, it's the way to go for users, the best user experience of any multi-model chat application
- Cloud/auth/sync code stays on `dev`; non-cloud improvements (UX, AIX, model support, bug fixes) can land on either branch

**Branch workflow:**
- `dev` is rebased on top of `main` (never merged) - `main` changes flow into `dev` on the next rebase, no manual forward-port needed
- Never `git merge` between the two branches - breaks the linear topology
- Backporting `dev` -> `main` is a re-implementation, never a cherry-pick - keep `main`-side edits minimal/additive so the existing `dev` version lands cleanly on rebase; split into small commits when natural
- Rebasing `dev` onto `main`: work on a scratch branch (never `private/dev` directly); only files `main` changed since the merge-base can conflict - forecast with `git diff --name-only $(git merge-base private/dev opensource/main) opensource/main`
- Resolve that rebase per-conflict: keep `dev` where it diverges, UNION where `main` only added (never blanket `-X theirs`/`-X ours` - they drop `main`'s additions). Check no `<<<<<<<` markers survive before each `--continue`

### Repository Layout

You are started from the root of the repository (i.e. where the git folder is or scripts should be run from).
**ISSUE ALL COMMANDS FROM THE ROOT, OMITTING 'cd' COMMANDS. DO NOT CHAIN CD AND OTHER COMMANDS**
**NEVER RUN COMPOUND `cd` COMMANDS LIKE `cd some-folder && command` - ONLY RUN `command` FROM THE ROOT, ALWAYS.**

- `/app/api/` - App Router, API routes only (thin, mostly -> `/src/server/`)
- `/pages/` - Pages Router, the app's pages (thin, mostly -> `/src/apps/`)
- `/src/apps/` - self-contained feature modules, entry `App*.tsx`, some with a local `store-app-*.ts`. Note `/src/apps/beam/` is a dev harness, not the Beam feature (that lives in `/src/modules/beam/`)
- `/src/modules/` - reusable business logic: `aix/` (AI streaming), `beam/` (scatter/gather), `blocks/` (content rendering), `llms/` (vendor abstraction), and more
- `/src/common/` - shared infrastructure and utilities; `/src/server/` - tRPC backend
- `/kb/` - knowledge base, indexed in `kb/KB.md`

### Key Subsystems

**AIX** (`/src/modules/aix/`) - real-time AI communication, Client -> tRPC -> Server -> AI Providers. Particle-based streaming: `AixWire_Particles` -> `ContentReassembler` -> `DMessage`. Provider-agnostic adapters, one per wire dialect; streaming and non-streaming, with batching and error recovery.

**Beam** (`/src/modules/beam/`) - scatter/gather for parallel AI reasoning. Scatter: N models (rays) process the input in parallel. Gather: fusion algorithms combine outputs. Real-time UI via vanilla Zustand; one `BeamStore` per conversation, via `ConversationHandler`.

**Conversations** (`/src/common/stores/chat/`, `/src/common/chat-overlay/`) - overlay architecture, one handler per conversation. `ConversationHandler` orchestrates chat, beam and ephemerals; per-chat `PerChatOverlayStore` + `BeamStore`; messages are `DMessage` -> `DMessageFragment[]`; multi-pane with independent conversation states.

**Optima** (`/src/common/layout/optima/`) - the layout system: responsive desktop/mobile, Drawer(left)/Toolbar/Panel(right) composition, portal-based rendering for flexible component placement.

### Storage & State

Local-first: Zustand in memory with `persist` to localStorage, except chats, which go to IndexedDB (`keyval-store` -> `keyval` -> key `app-chats`) via `createIDBPersistStorage()`. Binary blobs live in their own Dexie database (`src/modules/dblobs/`). Version-based migrations handle structure changes, partialize/merge control what persists, and rehydration repairs and upgrades data on load. `/src/common/stores/` holds the cross-app stores; apps and modules keep their own beside their code, by the `store-*.ts` convention.

1. **Global stores** - Zustand + `persist`; `chat/store-chats` is the only one on IndexedDB, the rest on localStorage
  - **Zustand pattern**: Always wrap multi-property selectors with `useShallow` from `zustand/react/shallow` to prevent re-renders on reference changes
2. **Per-instance stores** - vanilla Zustand, no React integration, suffixed `_vanilla` (beam scatter/gather, per-chat overlay, attachment drafts)
3. **Module stores** - feature-scoped configuration and state, named `store-module-*`

### Key Flows

- **Chat**: `Composer` -> `DMessage` -> `ConversationHandler.messageAppend()` -> `_handleExecute()` (in `src/apps/chat/editors/`) -> `runPersonaOnConversationHead()` -> AIX request -> `ContentReassembler` -> UI -> Zustand auto-persist to IndexedDB
- **Beam**: user triggers Beam -> `BeamStore.open()` -> one parallel AIX request per ray -> live ray progress -> user selects fusion -> result becomes a new message

### Development Patterns

#### TypeScript & Code Quality
- Use latest TypeScript 6.0+ features, and forward-looking patterns that minimize future refactors (discriminated unions, `satisfies`, `as const`, type inference)
- Type guards and exhaustiveChecks for robustness
- No unnecessary TS casts: prefer narrowing/inference; only `as` when the compiler genuinely can't know the type
- Runtime validation with Zod schemas for API inputs/outputs (usually server-side, with the client importing as types the inferred types)

#### Module Integration
- Modules register with central registries (e.g., `vendors.registry.ts`)

#### UI & Icons
- Prefer `@mui/icons-material` icons/variants already imported elsewhere in the app over new ones (keeps the bundle lean); new icons only when depicting genuinely novel functionality

#### API Patterns
- No auth on `main`: `trpc.server.ts` installs no middleware, and every procedure alias in it resolves to bare `t.procedure` (the cloud layer lives on `dev`)

#### Security Considerations
- Server-side keys come from env vars only; client-held keys are user-supplied

#### Writing Style
- **Never use emdashes (—).** Use normal dashes (-) instead, in all generated text, code comments, and documentation.
- Register: sharp, terse, precise - in all prose (docs, UI copy, comments, commits, replies). No inflation, no sales tone, no clever headings (plain nouns). Cut sentences that carry no information.


## Common Development Tasks

### Testing & Quality
- Browser floor: `eslint.config.mjs` hard-bans ES2023 `toSorted/toReversed/toSpliced/with` and `new Intl.Segmenter` via `no-restricted-syntax` (they crash Chrome <110 / Win7-8 holdouts); a separate `compat/compat` pass checks Web APIs against `browserslist`. Use `[...x].sort()` etc.; don't lower `browserslist` to "fix" the banned syntax - that rule doesn't read it, and SWC won't polyfill prototype methods

### Debugging Storage Issues
- Chats: DevTools -> Application -> IndexedDB -> `keyval-store` -> `keyval` -> key `app-chats`

### Production errors (app.big-agi.com)
- That host is the deployed build - triage runtime errors via the PostHog MCP (filter `url: app.big-agi.com`). Client noise filter (`before_send` / `shouldSuppressPostHogCapture`, matched on `$exception_list`) lives in `src/common/components/3rdparty/PostHogAnalytics.tsx`; `mechanism.handled:false` = an unhandled rejection via autocapture. Suppress only environmental/extension noise, never real bugs


## Server Architecture

Two tRPC routers, split by runtime. **Key pattern**: Edge runtime for AI (fast, distributed), Cloud runtime for data ops (centralized, Node.js).

- **Edge** (`/src/server/trpc/trpc.router-edge.ts`) - AIX streaming, per-vendor LLM routers, unified Speex TTS, external services; one mount per vendor/service, so the router file is the list. AIX, LLM and Speex also support **client-side fetch (CSF)**: the same code is rebundled with stubs and included client-side, so the browser can call the vendor directly where CORS allows, cutting latency and network barriers.
- **Cloud** (`/src/server/trpc/trpc.router-cloud.ts`) - Node-only data ops: Browse (fetch and extract page content), and the shared-link store.

@kb/KB.md

@kb/vision-inlined.md
