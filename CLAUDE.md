# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Targeted Code Quality (safe while dev server runs)
npx tsc --noEmit                      # Type check without building
npx eslint src/path/to/file.ts        # Lint specific file
npm run lint                          # Lint entire project
```

## Architecture Overview

Big-AGI is a Next.js 15 application with a modular architecture built for advanced AI interactions. The codebase follows a three-layer structure with distinct separation of concerns.

### Core Directory Structure

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
- **State Management**: Zustand with localStorge/IndexedDB (single cell) persistence
- **API Layer**: tRPC with React Query for type-safe communication
- **Runtime**: Edge Runtime for AI operations, Node.js for data processing

### Apps Architecture Pattern

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
- **`llms/`** - Language model abstraction supporting 16 vendors

### Key Subsystems & Their Patterns

#### 1. AIX - Real-time AI Communication
**Location**: `/src/modules/aix/`
**Pattern**: Client-server streaming architecture with provider abstraction

- **Client** → tRPC → **Server** → **AI Providers**
- Handles streaming/non-streaming responses with batching and error recovery
- Particle-based streaming: `AixWire_Particles` → `ContentReassembler` → `DMessage`
- Provider-agnostic through adapter pattern (OpenAI, Anthropic, Gemini protocols)

#### 3. Beam - Multi-Model Reasoning
**Location**: `/src/modules/beam/`
**Pattern**: Scatter/Gather for parallel AI processing

- **Scatter**: Multiple models (rays) process input in parallel
- **Gather**: Fusion algorithms combine outputs
- Real-time UI updates via vanilla Zustand stores
- BeamStore per conversation via ConversationHandler

#### 4. Conversation Management
**Location**: `/src/common/stores/chat/` and `/src/common/chat-overlay/`
**Pattern**: Overlay architecture with handler per conversation

- `ConversationHandler` orchestrates chat, beam, ephemerals
- Per-chat stores: `PerChatOverlayStore` + `BeamStore`
- Message structure: `DMessage` → `DMessageFragment[]`
- Supports multi-pane with independent conversation states

### Storage System

Big-AGI uses a local-first architecture with Zustand + IndexedDB:
- **Zustand** stores for in-memory state management
- **localStorage** for persistent settings/all storage (via Zustand persist middleware)
- **IndexedDB** for persistent chat-only storage (via Zustand persist middleware) on a single key-val cell
- **Local-first** architecture with offline capability
- **Migration system** for upgrading data structures across versions

Key storage patterns:
- Stores use `createIDBPersistStorage()` for IndexedDB persistence
- Version-based migrations handle data structure changes
- Partialize/merge functions control what gets persisted
- Rehydration logic repairs and upgrades data on load

Located in `/src/common/stores/` with stores like:
- `chat/store-chats.ts`: Conversations and messages
- `llms/store-llms.ts`: Model configurations

### Layout System ("Optima")

The Optima layout system provides:
- **Responsive design** adapting desktop/mobile
- **Drawer/Panel/Toolbar** composition
- **Split-pane support** for multi-conversation views
- **Portal-based rendering** for flexible component placement

Located in `/src/common/layout/optima/`

### State Management Patterns

1. **Global Stores** (Zustand with IndexedDB persistence)
   - `store-chats`: Conversations and messages
   - `store-llms`: Model configurations
   - `store-ux-labs`: UI preferences and labs features

2. **Per-Instance Stores** (Vanilla Zustand)
   - `store-beam_vanilla`: Beam scatter/gather state
   - `store-perchat_vanilla`: Chat overlay state
   - High-performance, no React integration

3. **Module Stores**
   - Feature-specific configuration and state
   - Example: `store-module-beam`, `store-module-t2i`

### User Flows & Interdependencies

#### Chat Message Flow
1. User input → `Composer` → `DMessage` creation
2. `ConversationHandler.messageAppend()` → Store update
3. `_handleExecute()` / `ConversationHandler.executeChatMessages()` → AIX client request
4. AIX streaming → `ContentReassembler` → UI updates
5. Zustand auto-persistence → IndexedDB

#### Beam Multi-Model Flow
1. User triggers Beam → `BeamStore.open()` state update
2. Scatter: Parallel `aixChatGenerateContent()` to N models
3. Real-time ray updates → UI progress
4. Gather: User selects fusion → Combined output
5. Result → New message in conversation

### Development Patterns

#### Module Integration
- Each module exports its functionality through index files
- Modules register with central registries (e.g., `vendors.registry.ts`)
- Configuration objects define module behavior
- Type-safe integration through strict TypeScript interfaces

#### Component Patterns
- **Controlled components** with clear prop interfaces
- **Hook-based logic** extraction for reusability
- **Portal rendering** for overlays and modals
- **Suspense boundaries** for async operations

#### API Patterns
- **tRPC routers** for type-safe API endpoints
- **Zod schemas** for runtime validation
- **Middleware** for request/response processing
- **Edge functions** for performance-critical AI operations

## Security Considerations

- API keys stored client-side in localStorage (user-provided)
- Server-side API keys in environment variables only
- XSS protection through proper content escaping
- No credential transmission to third parties

## Knowledge Base

Architecture and system documentation is available in the `/kb/` knowledge base:

@kb/KB.md

## Common Development Tasks

### Testing & Quality
- Run `npm run lint` before committing
- Type-check with `npx tsc --noEmit`
- Test critical user flows manually

### Adding a New LLM Vendor
1. Create vendor in `/src/modules/llms/vendors/[vendor]/`
2. Implement `IModelVendor` interface
3. Register in `vendors.registry.ts`
4. Add environment variables to `env.ts` (if server-side keys needed)

### Debugging Storage Issues
- Check IndexedDB: DevTools → Application → IndexedDB → `app-chats`
- Monitor Zustand state: Use Zustand DevTools
- Check migration logs in console during rehydration

## Code Examples

### AIX Streaming Pattern
```typescript
// Efficient streaming with decimation
aixChatGenerateContent_DMessage(
  llmId,
  request,
  { abortSignal, throttleParallelThreads: 1 },
  async (update, isDone) => {
    // Real-time UI updates
  }
);
```

### Model Registry Pattern
```typescript
// Registry pattern for extensibility
const MODEL_VENDOR_REGISTRY: Record<ModelVendorId, IModelVendor> = {
  openai: ModelVendorOpenAI,
  anthropic: ModelVendorAnthropic,
  // ... 14 more vendors
};
```

## Server Architecture

The server uses a split architecture with two tRPC routers:

### Edge Network (`trpc.router-edge`)
Distributed edge runtime for low-latency AI operations:
- **AIX** - AI streaming and communication
- **LLM Routers** - Direct vendor integrations (OpenAI, Anthropic, Gemini, Ollama)
- **External Services** - ElevenLabs (TTS), Google Search, YouTube transcripts

Located at `/src/server/trpc/trpc.router-edge.ts`

### Cloud Network (`trpc.router-cloud`)
Centralized server for data processing operations:
- **Browse** - Web scraping and content extraction
- **Trade** - Import/export functionality (ChatGPT, markdown, JSON)

Located at `/src/server/trpc/trpc.router-cloud.ts`

**Key Pattern**: Edge runtime for AI (fast, distributed), Cloud runtime for data ops (centralized, Node.js)
