# PRD: MCP (Model Context Protocol) Support for Big-AGI

**Status**: Draft
**Author**: Research synthesis from issue #892
**Date**: 2026-02-19
**Spec Version**: MCP 2025-11-25
**Stakeholders**: @enricoros, community contributors (@jayrepo, @ligix, @dogmatic69, @darinkishore)

---

## 1. Overview

### 1.1 Problem Statement

Big-AGI users need to connect AI conversations to external tools, data sources, and services in a standardized way. Currently, Big-AGI supports native tool/function calling through individual LLM providers (Anthropic, OpenAI, Gemini, etc.), but there is no unified protocol for discovering, configuring, and invoking external tools independent of the LLM vendor.

MCP (Model Context Protocol) has become the industry standard for connecting AI applications to external capabilities, with adoption by Anthropic, OpenAI, Google DeepMind, and thousands of community-built servers. Big-AGI must support MCP to remain competitive and to unlock a rich ecosystem of external integrations.

### 1.2 Goals

1. **Enable web clients to connect to MCP servers via Streamable HTTP** (local and remote)
2. **Bridge MCP tools to any LLM provider** through Big-AGI's existing AIX framework
3. **Support MCP sessions** correctly paired with Big-AGI conversation state
4. **Expose internal Big-AGI capabilities** via an MCP-compatible loopback interface
5. **Provide a clean UX** for server management without requiring users to understand transport details
6. **Maintain Big-AGI's local-first architecture** without requiring server-side infrastructure for MCP

### 1.3 Non-Goals (for MVP)

- stdio transport support (deferred to future desktop application)
- Hosting MCP servers on Big-AGI's infrastructure
- MCP server implementation (Big-AGI as an MCP server)
- Full OAuth 2.1 authorization server
- Tasks (experimental spec feature, deferred)
- Sampling (server-initiated LLM requests through Big-AGI)

---

## 2. Community Requirements Summary

Based on input from issue #892 participants:

| Contributor | Key Requirements |
|-------------|-----------------|
| **@jayrepo** | Streamable HTTP for web. Bridge MCP to tool calling. Works with different models. History management for tool calls/results is the hard part. |
| **@ligix** | Custom HTTP MCP servers for personal use. OpenAI, Gemini, Anthropic models. Export/transform data to external formats. |
| **@dogmatic69** | HTTP for interoperability. Not specific tools—general MCP support. Tool-use capable models required. |
| **@darinkishore** | HTTP only, skip stdio. MCP UI is P2. HTTP MCP support is the most impactful thing. Sequential thinking server as reference. |
| **@enricoros** | Direct browser-to-MCP connection. Sessions paired with chats. Internal loopback for Big-AGI capabilities. Search as potential MCP tool. |

### Consensus

- **Transport**: Streamable HTTP only for web (unanimous)
- **Approach**: MCP client in browser, bridge to existing tool calling (unanimous)
- **Models**: Must work with any tool-calling LLM, not just one vendor (unanimous)
- **Priority**: HTTP MCP connectivity first, UI polish second

---

## 3. MCP Specification Alignment

### 3.1 Spec Version Target

Target: **MCP 2025-06-18** (stable) with forward-compatible design for **2025-11-25** features.

The 2025-06-18 spec is the current stable release. The 2025-11-25 spec adds experimental features (Tasks, Extensions) that we design for but don't implement in MVP.

### 3.2 Protocol Primitives

MCP defines three server-side primitives. Big-AGI must handle all three:

| Primitive | Description | Big-AGI Integration | MVP Priority |
|-----------|-------------|---------------------|-------------|
| **Tools** | Functions the AI model can invoke | Bridge to AIX tool definitions → pass to any LLM | **P0** |
| **Resources** | Contextual data (files, DB schemas) | Inject into conversation as context/attachments | **P1** |
| **Prompts** | Templated message sequences | Surface as user-selectable actions (slash commands) | **P2** |

### 3.3 Client Capabilities to Implement

| Capability | Description | MVP | Future |
|-----------|-------------|-----|--------|
| **Tool Discovery** | `tools/list` to enumerate available tools | Yes | - |
| **Tool Invocation** | `tools/call` to execute tools | Yes | - |
| **Tool Annotations** | `readOnlyHint`, `destructiveHint`, etc. | Yes (display) | Enforcement |
| **Resource Discovery** | `resources/list` to enumerate resources | Yes | - |
| **Resource Reading** | `resources/read` to fetch resource content | Yes | - |
| **Resource Templates** | URI templates (RFC 6570) | No | Yes |
| **Resource Subscriptions** | `resources/subscribe` for change notifications | No | Yes |
| **Prompt Discovery** | `prompts/list` to enumerate prompts | Yes | - |
| **Prompt Retrieval** | `prompts/get` to fetch prompt templates | Yes | - |
| **listChanged Notifications** | React to server-side changes in tools/resources/prompts | Yes | - |
| **Elicitation** | Server-initiated user input requests | No | Yes |
| **Sampling** | Server-initiated LLM requests | No | Yes |
| **Roots** | Filesystem boundaries | No | Desktop app |
| **Tasks** | Long-running operation tracking | No | Yes |
| **Completions** | Argument autocompletion | No | Yes |
| **Logging** | Structured log ingestion | No | Yes (debug) |

### 3.4 Transport: Streamable HTTP

Big-AGI implements MCP client over Streamable HTTP:

```
Browser (Big-AGI)  ──HTTP POST/GET──>  MCP Server (local or remote)
                   <──JSON/SSE────
```

**Client Requirements:**
- Send JSON-RPC 2.0 messages as HTTP POST to single MCP endpoint
- Include `Accept: application/json, text/event-stream` header
- Include `MCP-Protocol-Version: 2025-06-18` header on all requests post-initialization
- Handle responses as `application/json` (single) or `text/event-stream` (streaming SSE)
- Track `Mcp-Session-Id` header from initialization response
- Include session ID on all subsequent requests
- Support GET for server-initiated SSE stream (notifications)
- Send DELETE to terminate sessions on cleanup

**CORS Consideration:** MCP servers accessed from the browser must return appropriate CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`). If a server does not support CORS, Big-AGI may optionally proxy the connection through its server-side (Cloud Runtime), but the default path is direct browser-to-server connection.

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Big-AGI Browser Client                │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │  MCP Manager  │   │   AIX Client  │   │  Chat/Beam  │ │
│  │  (new module) │   │  (existing)   │   │  (existing) │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬──────┘ │
│         │                   │                   │        │
│  ┌──────▼───────────────────▼───────────────────▼──────┐ │
│  │              MCP-to-AIX Tool Bridge                  │ │
│  │  (converts MCP tool schemas ↔ AIX tool definitions)  │ │
│  └──────┬───────────────────────────────────────┬──────┘ │
│         │                                        │        │
│  ┌──────▼────────┐                       ┌──────▼──────┐ │
│  │  MCP Client   │                       │  Loopback   │ │
│  │  (HTTP)       │                       │  Provider   │ │
│  └──────┬────────┘                       └──────┬──────┘ │
│         │                                        │        │
└─────────┼────────────────────────────────────────┼────────┘
          │ Streamable HTTP                        │ Direct fn calls
          ▼                                        ▼
    ┌───────────┐                          ┌──────────────┐
    │ MCP Server │                          │ Big-AGI      │
    │ (external) │                          │ Internal     │
    │            │                          │ Services     │
    └───────────┘                          └──────────────┘
```

### 4.2 Module Structure

New module: `/src/modules/mcp/`

```
src/modules/mcp/
├── client/
│   ├── mcp.client.ts              # MCP protocol client (Streamable HTTP)
│   ├── mcp.client.transport.ts    # HTTP transport layer (POST/GET/SSE/DELETE)
│   ├── mcp.client.session.ts      # Session management (Mcp-Session-Id)
│   └── mcp.client.auth.ts         # OAuth 2.1 + PKCE flows (future)
│
├── bridge/
│   ├── mcp-to-aix.tools.ts       # Convert MCP tool schemas → AixWire_Tooling
│   ├── mcp-to-aix.resources.ts   # Convert MCP resources → DMessage context
│   ├── mcp-to-aix.prompts.ts     # Convert MCP prompts → UI actions
│   └── aix-to-mcp.invocation.ts  # Convert AIX tool invocation → MCP tools/call
│
├── loopback/
│   ├── loopback.provider.ts      # Internal MCP-like tool provider
│   ├── loopback.search.ts        # Google Search as loopback tool
│   ├── loopback.browse.ts        # Browse as loopback tool
│   └── loopback.registry.ts      # Registry of internal tools
│
├── state/
│   ├── store-mcp-servers.ts      # Persisted: configured MCP server list
│   ├── store-mcp-sessions.ts     # Ephemeral: active sessions per conversation
│   └── mcp.types.ts              # MCP-specific type definitions
│
├── ui/
│   ├── MCPSettingsPanel.tsx       # Settings UI for server management
│   ├── MCPServerCard.tsx          # Individual server configuration card
│   ├── MCPToolApproval.tsx        # Human-in-the-loop tool approval dialog
│   └── MCPStatusIndicator.tsx     # Connection status badge
│
└── index.ts                       # Public API
```

### 4.3 Integration with Existing Architecture

#### AIX Integration

MCP tools are bridged to AIX's existing tool infrastructure:

```typescript
// MCP Tool Definition (from tools/list)
{
  name: "github_create_issue",
  description: "Create a new GitHub issue",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "Repository name" },
      title: { type: "string", description: "Issue title" },
      body: { type: "string", description: "Issue body" }
    },
    required: ["repo", "title"]
  }
}

// → Converted to AixWire_Tooling.Tool_schema
{
  type: 'function_call',
  function_call: {
    name: 'github_create_issue',    // MCP tool names use DNS-like format (e.g., server.tool)
    description: 'Create a new GitHub issue',
    input_schema: {
      properties: {
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body' }
      },
      required: ['repo', 'title']
    }
  }
}
```

This conversion is straightforward because AIX already uses OpenAPI-compatible JSON Schema for tool definitions, which is what MCP uses.

#### Tool Execution Loop

When an LLM invokes an MCP tool:

```
1. LLM generates tool_invocation (via AIX streaming)
2. ContentReassembler creates DMessageToolInvocationPart
3. MCP Bridge identifies tool as MCP-sourced (by name prefix or registry lookup)
4. MCP Bridge sends tools/call to appropriate MCP server
5. MCP server executes and returns result
6. MCP Bridge creates DMessageToolResponsePart
7. Result appended to conversation as tool message
8. Conversation re-sent to LLM with tool response for continuation
```

This loop integrates with the existing `ConversationHandler` orchestration pattern. The key addition is step 3-6: intercepting tool invocations that target MCP servers.

#### Conversation Store Integration

MCP server connections and sessions are tracked per conversation:

```typescript
// Per-conversation MCP state (ephemeral, in ConversationHandler overlay)
interface MCPConversationState {
  /** Active MCP sessions for this conversation */
  activeSessions: Map<MCPServerId, {
    sessionId: string;         // Mcp-Session-Id from server
    connected: boolean;
    lastActivity: number;
    availableTools: MCPTool[];
    availableResources: MCPResource[];
  }>;

  /** Tools enabled for this conversation (subset of all available) */
  enabledTools: Set<string>;   // tool fully-qualified names
}
```

### 4.4 Data Flow: Tool Discovery and Invocation

```
┌─ Discovery (on server connect or listChanged) ─────────────────────┐
│                                                                      │
│  MCP Server  ─── tools/list ──>  MCP Client  ──>  Tool Registry     │
│              <── tool[]     ───               ──>  (merged with AIX  │
│                                                     tools for LLM)   │
└──────────────────────────────────────────────────────────────────────┘

┌─ Invocation (during chat generation) ──────────────────────────────┐
│                                                                      │
│  LLM ─── tool_use(name, args) ──> AIX ContentReassembler             │
│      │                                │                              │
│      │                      ┌─────────▼─────────┐                   │
│      │                      │ Is MCP tool?       │                   │
│      │                      │ (registry lookup)  │                   │
│      │                      └──┬──────────┬──────┘                   │
│      │                    Yes  │          │ No (native tool)         │
│      │              ┌─────────▼──┐   ┌───▼──────────┐               │
│      │              │ MCP Client │   │ Existing      │               │
│      │              │ tools/call │   │ tool handler  │               │
│      │              └─────────┬──┘   └───┬──────────┘               │
│      │                        │          │                           │
│      │              ┌─────────▼──────────▼──────┐                   │
│      │              │ DMessageToolResponsePart   │                   │
│      │              └─────────┬──────────────────┘                   │
│      │                        │                                      │
│      │              ┌─────────▼──────────────────┐                   │
│      │              │ Re-send to LLM with result │                   │
│  LLM <─────────────│ (continuation)              │                   │
│                     └────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Session Management

### 5.1 MCP Protocol Sessions

Each MCP server connection has its own protocol session:

- **Session ID**: Assigned by server in `Mcp-Session-Id` response header during `initialize`
- **Lifecycle**: Created on connect, destroyed on explicit close (DELETE) or server disconnect
- **Resumability**: On SSE reconnect, client sends `Last-Event-ID` for missed message replay

### 5.2 Big-AGI Session Pairing

MCP sessions are paired with Big-AGI conversation state:

| Pairing Strategy | Description | When Used |
|-----------------|-------------|-----------|
| **Per-Conversation** | Each conversation gets its own MCP sessions | Default for interactive tools |
| **Global** | Single shared session across conversations | For resource-only servers (reference data) |
| **On-Demand** | Session created when tool first invoked | For infrequently used servers |

The pairing is managed by the `MCPConversationState` stored in the per-conversation overlay (`PerChatOverlayStore`).

### 5.3 Session Lifecycle

```
Conversation Created/Opened
  │
  ├─ If MCP servers configured for this conversation:
  │   ├─ initialize() each server (negotiate capabilities)
  │   ├─ tools/list to discover tools
  │   ├─ resources/list to discover resources (if supported)
  │   └─ Store session IDs in MCPConversationState
  │
  ├─ During conversation:
  │   ├─ Tool invocations route through MCP client
  │   ├─ Handle listChanged notifications (re-fetch tools/resources)
  │   └─ Maintain SSE connection for server notifications
  │
  └─ Conversation Closed/Switched:
      ├─ Send DELETE to each active session (graceful cleanup)
      └─ Clear MCPConversationState
```

### 5.4 Reconnection Strategy

If an SSE stream disconnects:
1. Attempt reconnection with `Last-Event-ID` header
2. If 404 (session expired): re-initialize with full handshake
3. If server unreachable: mark server as disconnected, queue tool calls
4. Surface connection status in UI via `MCPStatusIndicator`

---

## 6. Internal MCP Loopback

### 6.1 Concept

Big-AGI's internal capabilities can be exposed as MCP-compatible tools through a "loopback" provider. This allows:

1. **Unified tool interface**: Internal and external tools use the same registration, invocation, and rendering patterns
2. **Scalable architecture**: New internal capabilities automatically become available as tools
3. **Future extensibility**: Internal tools could be exposed externally when Big-AGI ships as an MCP server
4. **Consistent UX**: Users manage all tools (internal and external) in one place

### 6.2 Loopback Tool Registry

The loopback provider registers internal capabilities as tool definitions:

| Internal Capability | Loopback Tool Name | Description | Source Module |
|--------------------|--------------------|-------------|--------------|
| Google Search | `bigagi.search_google` | Web search via Google CSE | `/src/modules/google/` |
| Web Browse | `bigagi.browse_url` | Fetch and extract web page content | `/src/modules/browse/` |
| YouTube Transcript | `bigagi.youtube_transcript` | Extract video transcript | `/src/modules/youtube/` |
| Image Generation | `bigagi.generate_image` | Text-to-image generation | `/src/modules/t2i/` |
| Image Caption | `bigagi.caption_image` | Describe image content | `/src/modules/aifn/image-caption/` |

### 6.3 Loopback vs Native Search

Big-AGI currently supports native search for several providers:
- `vndGeminiGoogleSearch` (Gemini grounding)
- `vndOaiWebSearchContext` (OpenAI web search)
- `vndAntWebSearch` (Anthropic web search)
- `vndXaiWebSearch` / `vndXaiXSearch` (xAI search)
- `vndMoonshotWebSearch` (Moonshot)
- `vndPerplexitySearchMode` (Perplexity)
- `vndOrtWebSearch` (OpenRouter)

**Strategy**: Native search is preferred when available (lower latency, provider-optimized). The loopback `bigagi.search_google` tool serves as:

1. **Fallback**: For models/providers without native search
2. **Override**: User can explicitly enable Google Search tool even when native search is available, for consistent results across models
3. **Programmable**: External MCP tools or the model itself can invoke search as part of multi-step workflows

The decision on native vs loopback search is made at the tool assembly stage:
- If model has native search AND user hasn't enabled loopback search → use native
- If model lacks native search OR user explicitly enables loopback search → include as tool

### 6.4 Loopback Implementation Pattern

Loopback tools bypass HTTP transport and call internal functions directly:

```typescript
// Loopback provider implements the same interface as MCP client
class LoopbackProvider {
  async listTools(): Promise<MCPTool[]> {
    return loopbackToolRegistry.getAll();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    switch (name) {
      case 'bigagi.search_google':
        const results = await callApiSearchGoogle(args.query as string, args.items as number);
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };

      case 'bigagi.browse_url':
        const page = await callBrowseFetchPageOrThrow(args.url as string, ['markdown']);
        return { content: [{ type: 'text', text: page.content.markdown }] };

      // ... other tools
    }
  }
}
```

---

## 7. User Experience

### 7.1 Settings UI

New "MCP Servers" section in Settings > Tools tab:

```
┌─ Settings ──────────────────────────────────────────┐
│ [Chat] [Voice] [Draw] [Tools] [Extras]              │
│                                                      │
│ ┌─ MCP Servers ────────────────────────────────────┐ │
│ │                                                    │ │
│ │  [+ Add Server]                                    │ │
│ │                                                    │ │
│ │  ┌─────────────────────────────────────────────┐   │ │
│ │  │ 🟢 Sequential Thinking          [Toggle]    │   │ │
│ │  │ smithery.ai/server-sequential-thinking       │   │ │
│ │  │ Tools: 1  Resources: 0  Status: Connected    │   │ │
│ │  │ [Configure] [Remove]                         │   │ │
│ │  └─────────────────────────────────────────────┘   │ │
│ │                                                    │ │
│ │  ┌─────────────────────────────────────────────┐   │ │
│ │  │ ⚪ My Custom Server              [Toggle]    │   │ │
│ │  │ http://localhost:8080/mcp                     │   │ │
│ │  │ Tools: 3  Resources: 2  Status: Disconnected │   │ │
│ │  │ [Configure] [Remove]                         │   │ │
│ │  └─────────────────────────────────────────────┘   │ │
│ │                                                    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Built-in Tools ─────────────────────────────────┐ │
│ │  [x] Google Search (fallback for models w/o      │ │
│ │      native search)                               │ │
│ │  [ ] Web Browse                                   │ │
│ │  [ ] YouTube Transcript                           │ │
│ └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 7.2 Add Server Flow

```
[+ Add Server]
  │
  ├─ Enter MCP Server URL: [https://example.com/mcp    ]
  │
  ├─ [Test Connection]
  │   ├─ Success: Show server name, version, capabilities
  │   └─ Failure: Show error (CORS, network, auth required)
  │
  ├─ If auth required:
  │   └─ [Authorize] → OAuth 2.1 popup flow
  │
  └─ [Add Server]
      └─ Server added to persistent store, tools discovered
```

### 7.3 Tool Approval (Human-in-the-Loop)

When an LLM invokes an MCP tool, the user sees an approval prompt:

```
┌─ Tool Invocation ──────────────────────────────┐
│                                                  │
│  github_create_issue wants to:                   │
│  Create a new issue on repo "enricoros/big-AGI"  │
│                                                  │
│  Arguments:                                      │
│  ┌──────────────────────────────────────────┐    │
│  │ repo: "enricoros/big-AGI"                │    │
│  │ title: "Fix login bug"                   │    │
│  │ body: "The login form..."                │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [ ] Always allow this tool (this conversation)  │
│                                                  │
│  [Approve]  [Edit & Approve]  [Deny]             │
│                                                  │
│  ℹ️ destructive: false, readOnly: false          │
└──────────────────────────────────────────────────┘
```

Behavior based on tool annotations:
- `readOnlyHint: true` → Auto-approve (configurable)
- `destructiveHint: true` → Always require approval
- No annotations → Require approval (safe default)

### 7.4 Chat UI Integration

MCP tool invocations and responses are rendered using the existing `BlockPartToolInvocation` component, which already supports function call display. MCP tools appear identically to native tool calls with additional metadata:

- Server name badge on tool invocation blocks
- Connection status indicator in chat toolbar
- Tool approval inline in conversation flow

### 7.5 Composer Integration

The composer shows available MCP tools alongside native capabilities:

- MCP resources can be attached to messages (like attachments)
- MCP prompts appear as slash-command suggestions
- Active MCP servers shown as badges in composer toolbar

---

## 8. Storage Design

### 8.1 Persisted State: MCP Server Configuration

New Zustand store with localStorage persistence:

```typescript
// store-mcp-servers.ts
interface MCPServerConfig {
  id: string;                        // UUID
  label: string;                     // User-friendly name (from server or user)
  url: string;                       // MCP endpoint URL
  enabled: boolean;                  // Global toggle

  // Authentication
  auth?: {
    type: 'oauth2' | 'bearer' | 'api-key';
    // OAuth: stored tokens
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    // API Key
    apiKey?: string;
    headerName?: string;             // e.g., 'Authorization', 'X-API-Key'
  };

  // Cached server info (from last initialize)
  serverInfo?: {
    name: string;
    version: string;
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
  };

  // User preferences
  autoApproveReadOnly: boolean;      // Auto-approve readOnlyHint tools
  enabledToolNames?: string[];       // Subset of tools to expose (null = all)

  // Metadata
  addedAt: number;
  lastConnectedAt?: number;
}

interface MCPServersStore {
  servers: MCPServerConfig[];

  // Actions
  addServer(config: Omit<MCPServerConfig, 'id'>): string;
  updateServer(id: string, updates: Partial<MCPServerConfig>): void;
  removeServer(id: string): void;
  toggleServer(id: string): void;
}
```

### 8.2 Ephemeral State: Active Sessions

Per-conversation vanilla Zustand store (not persisted):

```typescript
// Managed within PerChatOverlayStore or as separate slice
interface MCPSessionState {
  /** Active connections keyed by server config ID */
  connections: Map<string, {
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    sessionId: string | null;        // Mcp-Session-Id from server
    error?: string;

    // Discovered capabilities (cached from last tools/list, resources/list)
    tools: MCPToolDefinition[];
    resources: MCPResourceDefinition[];
    prompts: MCPPromptDefinition[];
  }>;

  /** Tool approval state for this conversation */
  toolApprovals: Map<string, 'always' | 'never' | 'ask'>;

  /** Pending tool invocations awaiting user approval */
  pendingApprovals: MCPPendingApproval[];
}
```

### 8.3 Message Fragment Storage

MCP tool invocations and responses use existing fragment types:

```typescript
// No new fragment types needed - MCP tools map to existing:
DMessageToolInvocationPart  // { pt: 'tool_invocation', id, invocation: { type: 'function_call', name, args } }
DMessageToolResponsePart    // { pt: 'tool_response', id, response: { type: 'function_call', name, result }, environment: 'client' }
```

The `environment` field on tool responses distinguishes execution context:
- `'upstream'`: LLM provider executed (e.g., Gemini code execution)
- `'server'`: Big-AGI server executed
- `'client'`: Browser executed (MCP tools fall here since the browser is the MCP client)

---

## 9. Tool Execution Orchestration

### 9.1 Integration Point: ConversationHandler

The tool execution loop integrates with `ConversationHandler`'s existing chat execution flow. When AIX streaming completes with `tokenStopReason: 'ok-tool_invocations'`:

```
1. AIX streaming completes with tool invocations
2. ConversationHandler detects tool_invocation fragments
3. For each invocation:
   a. Check if tool is MCP-sourced (registry lookup by name)
   b. If MCP: route to MCP client for execution
   c. If native/loopback: route to internal handler
   d. If approval required: show approval UI, await user decision
4. Collect all tool responses
5. Append tool response message to conversation
6. Re-invoke AIX with updated conversation (continuation)
7. Repeat until LLM stops invoking tools
```

### 9.2 Parallel Tool Calls

When the LLM generates multiple tool invocations in a single response (parallel tool calling, supported by Anthropic, OpenAI, Gemini, Groq):

- All MCP tool calls to the same server are sent sequentially (MCP spec allows but doesn't require parallel)
- Tool calls to different servers are sent in parallel
- Loopback tools execute in parallel
- All results collected before sending continuation to LLM

### 9.3 Error Handling

| Error Type | Handling |
|-----------|---------|
| MCP server unreachable | Mark tool response as error, include in conversation so LLM can adapt |
| Tool execution error (`isError: true`) | Display error in tool response block, include in conversation |
| User denies tool call | Return error response "User denied tool invocation", LLM receives this |
| Session expired | Re-initialize session transparently, retry tool call |
| CORS error | Surface in UI as server configuration issue |
| Timeout | Configurable timeout (default 30s), return timeout error to LLM |

---

## 10. Security Considerations

### 10.1 Authentication

For MVP, support these auth methods:

1. **No auth**: For local servers (localhost)
2. **Bearer token**: User provides API key/token in settings
3. **OAuth 2.1 + PKCE**: For remote servers requiring authorization (future phase)

### 10.2 Tool Invocation Safety

- **Human-in-the-loop by default**: All tool invocations require user approval unless:
  - Tool has `readOnlyHint: true` AND user enabled auto-approve for read-only tools
  - User selected "always allow" for that specific tool in that conversation
- **Destructive tool warning**: Tools with `destructiveHint: true` always show a warning
- **No credential passthrough**: Big-AGI never forwards LLM API keys to MCP servers

### 10.3 Data Privacy

- MCP server configurations (including auth tokens) stored in localStorage (same security model as LLM API keys)
- Tool invocation arguments and responses visible to the user in conversation
- No tool data transmitted to Big-AGI servers (client-side only)

### 10.4 CORS and Origin Security

- Browser enforces CORS on all MCP server requests
- MCP servers must return appropriate CORS headers
- Local servers should bind to `127.0.0.1` only
- Big-AGI does NOT set custom Origin headers (browser controls this)

---

## 11. Phasing

### Phase 1: MVP - HTTP MCP Client (P0)

**Scope**: Connect to MCP servers, discover tools, bridge to LLM tool calling.

**Deliverables**:
1. MCP Streamable HTTP client implementation
2. MCP-to-AIX tool bridge (schema conversion)
3. Tool execution loop in ConversationHandler
4. Settings UI for server management (add/remove/toggle)
5. Tool approval dialog
6. Connection status indicator
7. MCP session management (per-conversation)
8. Bearer token authentication

**Success Criteria**:
- User can add an MCP server URL, discover its tools, and use them in chat
- Works with any tool-calling LLM (not vendor-specific)
- Tool invocations render correctly in conversation
- Multi-turn tool use loops work (LLM calls tool → gets result → continues)

### Phase 2: Resources, Prompts & Loopback (P1)

**Scope**: MCP resources as context, prompts as actions, internal tools via loopback.

**Deliverables**:
1. Resource discovery and reading
2. Resource content injection into conversations (as attachments/context)
3. Prompt discovery and retrieval
4. Prompt integration with composer (slash commands)
5. Loopback provider with Google Search, Browse, YouTube tools
6. Built-in tools settings panel
7. Search override logic (loopback vs native)

### Phase 3: OAuth, Elicitation & Polish (P2)

**Scope**: Full OAuth flows, server-initiated UI, production polish.

**Deliverables**:
1. OAuth 2.1 + PKCE authorization flow
2. Elicitation support (server-requested user input forms)
3. Resource subscriptions (change notifications)
4. Resource templates (parameterized URIs)
5. Tool completions (argument autocompletion)
6. Logging ingestion (debug panel)
7. Server-initiated notifications via GET SSE stream

### Phase 4: Advanced Features (P3)

**Scope**: Tasks, sampling, desktop app stdio.

**Deliverables**:
1. Tasks support (long-running operations with polling)
2. Sampling support (server-initiated LLM requests)
3. stdio transport (desktop app only, requires Tauri/Electron)
4. Roots capability (filesystem boundaries for desktop)
5. MCP server marketplace/directory integration

---

## 12. Technical Constraints and Risks

### 12.1 Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **Browser-only** (no subprocess spawning) | No stdio transport | Streamable HTTP only; stdio deferred to desktop app |
| **Edge Runtime** (Big-AGI server is stateless) | Cannot proxy MCP connections server-side persistently | Direct browser-to-MCP connection; optional stateless proxy for CORS |
| **CORS** | MCP servers must support CORS for browser access | Document requirement; offer server-side proxy as fallback |
| **No SSE POST support in EventSource API** | Browser EventSource only supports GET | Use `fetch()` + `ReadableStream` for POST SSE responses |
| **localStorage token storage** | Same security as LLM API keys (acceptable for Big-AGI's threat model) | Document; suggest browser-native credential storage in future |

### 12.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MCP servers lacking CORS headers | High | Blocks direct connection | Server-side CORS proxy option; document server requirements |
| Tool execution loops (infinite) | Medium | Resource exhaustion | Max loop depth (configurable, default 10); user abort |
| MCP server version incompatibility | Low | Handshake failure | Version negotiation per spec; clear error messages |
| Tool name collisions (multiple servers) | Medium | Ambiguous invocation | Namespace tools by server: `servername.toolname` |
| Large tool lists overwhelming LLM context | Medium | Token waste, poor accuracy | Tool filtering per conversation; future: Anthropic Tool Search Tool |

---

## 13. Dependencies

### 13.1 External Dependencies

| Dependency | Purpose | Status |
|-----------|---------|--------|
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK | Available; evaluate browser compatibility |
| JSON-RPC 2.0 | Protocol encoding | Implement directly (simple) or use `jsonrpc-lite` |
| `EventSource` / `ReadableStream` | SSE handling | Browser native |

**Note**: The official `@modelcontextprotocol/sdk` is designed for Node.js. For browser use, we may need to:
- Use the SDK's type definitions only
- Implement transport layer ourselves (fetch-based HTTP + SSE)
- Or find/create a browser-compatible fork

### 13.2 Internal Dependencies

| Component | Dependency Type | Changes Needed |
|-----------|----------------|----------------|
| AIX wire types | Extension | Add MCP tool source metadata to tool definitions |
| ContentReassembler | No change | Already handles tool invocation/response particles |
| ConversationHandler | Extension | Add MCP tool execution loop after AIX streaming |
| PerChatOverlayStore | Extension | Add MCPSessionState slice |
| Settings Modal | Extension | Add MCP Servers section to Tools tab |
| Composer | Extension | Show MCP tool/resource availability |

---

## 14. Success Metrics

| Metric | Phase 1 Target | Phase 2 Target |
|--------|---------------|---------------|
| MCP servers configurable | Yes | Yes |
| Tools discoverable and usable | Yes | Yes |
| Works with Anthropic, OpenAI, Gemini | Yes | Yes |
| Tool approval flow | Yes | Yes |
| Resources as context | No | Yes |
| Loopback tools | No | Yes |
| OAuth support | No | Phase 3 |
| Connection reliability (reconnect) | Basic | Full |
| User-reported setup friction | < 2 min to add server | < 30s to add server |

---

## 15. Open Questions

1. **Tool name namespacing**: Should MCP tools be prefixed with server identifier to avoid collisions? (e.g., `myserver.create_issue` vs `create_issue`). The MCP spec recommends DNS-like naming but doesn't enforce it.

2. **Proxy vs direct**: Should Big-AGI offer a server-side CORS proxy for MCP servers that don't support browser CORS? This adds server-side complexity but improves compatibility.

3. **Tool search/filtering**: With many MCP servers, how should tools be filtered for each conversation? Options: per-conversation toggle, global enable/disable, automatic relevance filtering.

4. **Conversation-scoped vs global sessions**: Should MCP sessions be per-conversation or shared? Per-conversation is cleaner but creates more connections; shared is more efficient but complicates state.

5. **Loopback exposure**: Should internal loopback tools be visible to users in the MCP tools list, or hidden as an implementation detail? Making them visible lets users toggle them; hiding them reduces complexity.

6. **Browser SDK**: The official `@modelcontextprotocol/sdk` targets Node.js. Should we maintain a browser-compatible fork, implement from scratch, or contribute browser support upstream?

---

## Appendices

### A. MCP Protocol Quick Reference

```
Client → Server:
  initialize              Handshake with capabilities
  tools/list              Discover available tools
  tools/call              Invoke a tool
  resources/list          Discover available resources
  resources/read          Read a resource
  resources/subscribe     Subscribe to resource changes
  prompts/list            Discover available prompts
  prompts/get             Retrieve a prompt template
  completion/complete     Request argument completion
  logging/setLevel        Set minimum log level
  ping                    Keepalive

Server → Client:
  sampling/createMessage  Request LLM completion (requires sampling capability)
  elicitation/create      Request user input (requires elicitation capability)
  roots/list              Request filesystem roots (requires roots capability)

Notifications (either direction):
  notifications/initialized
  notifications/cancelled
  notifications/progress
  notifications/message              (server → client, logging)
  notifications/tools/list_changed   (server → client)
  notifications/resources/list_changed
  notifications/resources/updated
  notifications/prompts/list_changed
  notifications/roots/list_changed   (client → server)
```

### B. Integration with Existing Native Tool Features

| Feature | Current Implementation | MCP Equivalent | Coexistence Strategy |
|---------|----------------------|----------------|---------------------|
| Gemini Google Search | `vndGeminiGoogleSearch` in model params | `bigagi.search_google` loopback | Native preferred; loopback as fallback |
| OpenAI Web Search | `vndOaiWebSearchContext` in model params | External search MCP server | Native preferred; MCP as alternative |
| Anthropic Web Search | `vndAntWebSearch` in model params | External search MCP server | Native preferred; MCP as alternative |
| Gemini Code Execution | `vndGeminiCodeExecution` via AIX | Code execution MCP server | Native preferred |
| OpenAI Code Interpreter | `vndOaiCodeInterpreter` via AIX | Code execution MCP server | Native preferred |
| Anthropic Tool Search | `vndAntToolSearch` in model params | Could discover MCP tools | Complementary—Tool Search can discover MCP tools |
| Google Custom Search | `search.router.ts` tRPC | `bigagi.search_google` loopback | Loopback wraps existing implementation |
| Browse | `browse.router.ts` tRPC | `bigagi.browse_url` loopback | Loopback wraps existing implementation |

### C. Reference MCP Servers for Testing

| Server | URL | Transport | Auth | Purpose |
|--------|-----|-----------|------|---------|
| Sequential Thinking | smithery.ai | HTTP | None | Reasoning enhancement |
| Fetch | Community | HTTP | None | URL content fetching |
| GitHub | Community | HTTP | OAuth/Token | Repository management |
| Brave Search | Community | HTTP | API Key | Web search |
| Memory | Community | HTTP | None | Knowledge graph persistence |

### D. Key File References

| File | Purpose |
|------|---------|
| `src/modules/aix/server/api/aix.wiretypes.ts` | AIX tool schemas (lines 312-410) |
| `src/modules/aix/client/ContentReassembler.ts` | Tool particle handling (lines 393-430) |
| `src/modules/aix/client/aix.client.fromSimpleFunction.ts` | Tool definition helpers |
| `src/common/stores/chat/chat.fragments.ts` | DMessageToolInvocationPart/ResponsePart (lines 196-231) |
| `src/apps/chat/components/message/fragments-content/BlockPartToolInvocation.tsx` | Tool UI rendering |
| `src/common/chat-overlay/ConversationHandler.ts` | Chat orchestration |
| `src/common/chat-overlay/store-perchat_vanilla.ts` | Per-conversation state |
| `src/modules/google/search.router.ts` | Google Search (loopback candidate) |
| `src/modules/browse/browse.router.ts` | Browse (loopback candidate) |
| `src/modules/youtube/youtube.router.ts` | YouTube (loopback candidate) |
| `src/apps/settings-modal/SettingsModal.tsx` | Settings modal structure |
| `kb/systems/client-side-fetch.md` | CSF pattern (relevant for direct browser connections) |
