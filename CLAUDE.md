# CLAUDE.md

Guidance to Claude Code when working with code in this repository.


## Architecture Overview

Big-AGI is a Next.js 15 application with a sophisticated modular architecture built for professional AI interactions.

### Development Commands

Dev servers may be already running on ports 3000, 3001, 3002, or 3003 (not always this app - other projects may occupy these ports). Never start or stop dev servers, let the user do it.

```bash
# Validate (~5s, safe while dev server runs, do NOT use `next build` ~45s for same checks)
tsc --noEmit --pretty && npm run lint # Type check (~3.5s) + ESLint (~2s)
eslint src/path/to/file.ts           # Lint specific file

# Full build (~60s+, only when suspecting runtime/bundle issues)
npm run build  # next build runs compile+lint+types but stops at first type-error file; tsc shows all at once

# Database & External Services
# npm run supabase:local-update-types   # Generate TypeScript types
# npm run stripe:listen                 # Listen for Stripe webhooks
```

### Git/GitHub remotes

The `gh` command is available to interact with GitHub from the terminal, but **NEVER PUSH TO ANY BRANCH**. The user manages all 'write' git operations.
- `opensource` -> `enricoros/big-AGI` (public, default branch: `main`, MIT) - community issues/PRs/releases
- `private` -> `big-agi/big-agi-private` (private, default branch: `dev`) - main dev repo with `dev`->`staging`->`prod` pipeline

### Core Directory Structure

You are started from the root of the repository (i.e. where the git folder is or scripts should be run from).
**ISSUE ALL COMMANDS FROM THE ROOT, OMITTING 'cd' COMMANDS. DO NOT CHAIN CD AND OTHER COMMANDS**
The directory structure is as follows:

```
/app/api/          # Next.js App Router (API routes only, mostly -> /src/server/)
/pages/            # Next.js Pages Router (file-based, mostly -> /src/apps/)
/src/
├── apps/          # Feature applications (self-contained modules)
├── modules/       # Reusable business logic and integrations
├── common/        # Shared infrastructure and utilities
└── server/        # Backend API layer with tRPC
/kb/               # Knowledge base for modules, architectures
```

### Key Technologies

- **Frontend**: Next.js 15, React 18, Material-UI Joy, Emotion (CSS-in-JS)
- **State Management**: Zustand with localStorage/IndexedDB (single cell) persistence
- **API Layer**: tRPC with TanStack React Query for type-safe communication
- **Runtime**: Edge Runtime for AI operations, Node.js for data processing

### "Apps" Architecture Pattern

Each app in `/src/apps/` is a self-contained feature module:
- Main component (`App*.tsx`)
- Local state store (`store-app-*.ts`)
- Feature-specific components and layouts
- Runtime configurations

Example apps: `chat/`, `call/`, `beam/`, `draw/`, `personas/`, `settings-modal/`

### Modules Architecture Pattern

Modules in `/src/modules/` provide reusable business logic:
- **`aix/`** - AI communication framework for real-time streaming
- **`beam/`** - Multi-model AI reasoning system (scatter/gather pattern)
- **`blocks/`** - Content rendering (markdown, code, images, etc.)
- **`llms/`** - Language model abstraction supporting 20+ vendors

### Key Subsystems & Their Patterns

#### AIX - Real-time AI Communication
**Location**: `/src/modules/aix/`
**Pattern**: Client-server streaming architecture with provider abstraction

- **Client** -> tRPC -> **Server** -> **AI Providers**
- Handles streaming/non-streaming responses with batching and error recovery
- Particle-based streaming: `AixWire_Particles` -> `ContentReassembler` -> `DMessage`
- Provider-agnostic through adapter pattern (OpenAI, Anthropic, Gemini protocols)

#### Beam - Multi-Model Reasoning
**Location**: `/src/modules/beam/`
**Pattern**: Scatter/Gather for parallel AI processing

- **Scatter**: Multiple models (rays) process input in parallel
- **Gather**: Fusion algorithms combine outputs
- Real-time UI updates via vanilla Zustand stores
- BeamStore per conversation via ConversationHandler

#### Conversation Management
**Location**: `/src/common/stores/chat/` and `/src/common/chat-overlay/`
**Pattern**: Overlay architecture with handler per conversation

- `ConversationHandler` orchestrates chat, beam, ephemerals
- Per-chat stores: `PerChatOverlayStore` + `BeamStore`
- Message structure: `DMessage` -> `DMessageFragment[]`
- Supports multi-pane with independent conversation states

#### Layout System ("Optima")

The Optima layout system provides:
- **Responsive design** adapting desktop/mobile
- **Drawer(left)/Toolbar/Panel(right)** composition
- **Portal-based rendering** for flexible component placement

Located in `/src/common/layout/optima/`

### Storage System

Big-AGI uses a local-first architecture with Zustand + IndexedDB:
- **Zustand** stores for in-memory state management
- **localStorage** for persistent settings/all storage (via Zustand persist middleware)
- **IndexedDB** for persistent chat-only storage (via Zustand persist middleware) on a single key-val cell
- **Local-first** architecture with offline capability

Key storage patterns:
- Stores use `createIDBPersistStorage()` for IndexedDB persistence
- Version-based migrations handle data structure changes
- Partialize/merge functions control what gets persisted
- Rehydration logic repairs and upgrades data on load

Located in `/src/common/stores/` with stores like:
- `chat/store-chats.ts`: Conversations and messages
- `llms/store-llms.ts`: Model configurations

### State Management Patterns

1. **Global Stores** (Zustand with IndexedDB persistence)
   - `store-chats`: Conversations and messages
   - `store-llms`: Model configurations
   - `store-ux-labs`: UI preferences and labs features
   - **Zustand pattern**: Always wrap multi-property selectors with `useShallow` from `zustand/react/shallow` to prevent re-renders on reference changes

2. **Per-Instance Stores** (Vanilla Zustand)
   - `store-beam_vanilla`: Beam scatter/gather state
   - `store-perchat_vanilla`: Chat overlay state
   - `store-attachment-drafts_vanilla`: Attachment drafts
   - High-performance, no React integration

3. **Module Stores**
   - Feature-specific configuration and state
   - Example: `store-module-beam`, `store-module-t2i`

### User Flows & Interdependencies

#### Chat Message Flow
1. User input -> `Composer` -> `DMessage` creation
2. `ConversationHandler.messageAppend()` -> Store update
3. `_handleExecute()` / `ConversationHandler.executeChatMessages()` -> AIX client request
4. AIX streaming -> `ContentReassembler` -> UI updates
5. Zustand auto-persistence -> IndexedDB

#### Beam Multi-Model Flow
1. User triggers Beam -> `BeamStore.open()` state update
2. Scatter: Parallel `aixChatGenerateContent()` to N models
3. Real-time ray updates -> UI progress
4. Gather: User selects fusion -> Combined output
5. Result -> New message in conversation

### Development Patterns

#### TypeScript & Code Quality
- Type-safe through strict TypeScript interfaces
- Clear interface-first approach for modules and components
- Use latest TypeScript 5.9+ features
- Use forward-looking patterns to minimize future refactors (e.g., discriminated unions, `satisfies` operator, as const assertions)
- Type guards and exhaustiveChecks for robustness
- Type inference where possible
- Runtime validation with Zod schemas for API inputs/outputs (usually server-side, with the client importing as types the inferred types)

#### Module Integration
- Modules register with central registries (e.g., `vendors.registry.ts`)
- Configuration objects define module behavior

#### API Patterns
- **tRPC routers** for type-safe API endpoints
- **Zod schemas** for runtime validation
- **tRPC procedures middleware** for authorization and logging (authorization is on a httpOnly cookie)
- **Edge functions** for performance-critical operations

#### Security Considerations
- API keys in environment variables only (server-side); on the client they're in localStorage for now, but we want to move away from this
- XSS protection through proper content escaping


## Common Development Tasks

### Testing & Quality
- Run `npm run lint` before committing
- Type-check with `tsc --noEmit`
- Test critical user flows manually

### Debugging Storage Issues
- Check IndexedDB: DevTools -> Application -> IndexedDB -> `app-chats`
- Monitor Zustand state: Use Zustand DevTools
- Check migration logs in console during rehydration


## Server Architecture

The server uses a split architecture with two tRPC routers:

### Edge Network (`trpc.router-edge`)
Distributed edge runtime for low-latency AI operations:
- **AIX** [1] - AI streaming and communication
- **LLM Routers** [1] - Vendor-specific operations such as list models (OpenAI, Anthropic, Gemini, Ollama)
- **Speex** [1] - Unified TTS router (ElevenLabs, Inworld, and other TTS vendors)
- **External Services** - Google Search, YouTube transcripts

[1]: also supports client-side fetch (CSF) via client-side inclusion (rebundling with stubs),
for direct browser-to-API communication when possible (CORS), to reduce latency and network barriers

Located at `/src/server/trpc/trpc.router-edge.ts`

### Cloud Network (`trpc.router-cloud`)
Centralized server for data processing operations:
- **Browse** - Web scraping and content extraction
- **Trade** - Import/export functionality (ChatGPT, markdown, JSON)

Located at `/src/server/trpc/trpc.router-cloud.ts`

**Key Pattern**: Edge runtime for AI (fast, distributed), Cloud runtime for data ops (centralized, Node.js)

@kb/KB.md

@kb/vision-inlined.md

As a side note, the product tiers (independent, non-VC-funded) are: **Open** (self-host, MIT) · **Free** (big-agi.com) · **Pro** (paid, includes Sync + backup). All tiers use the user's own API keys.
