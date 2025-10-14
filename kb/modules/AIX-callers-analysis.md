# AIX Chat Generation Calls Analysis

This document analyzes all AIX function callers and their patterns for message removal, placeholder handling, and error management.

## AIX Function Architecture

### Three-Tier Call Hierarchy

**Core AIX Functions** (Direct tRPC API callers):
- `aixChatGenerateContent_DMessage_FromConversation` - 8 callers (conversation streaming)
- `aixChatGenerateContent_DMessage` - 6 callers (direct request/response)
- `aixChatGenerateText_Simple` - 12 callers (text-only utilities)

**Utility Layer** (Hooks & Functions):
- Conversation management, persona processing, content generation utilities

**UI Layer** (React Components):
- User-facing interfaces with rich error states and fallback mechanisms

## Core Function Callers Analysis

### Conversation-Based Callers (`_FromConversation`)

| **Caller** | **Context** | **Message Removal** | **Placeholder** | **Error Handling** |
|------------|-------------|-------------------|----------------|-------------------|
| **Chat Persona** | `'conversation'` | `messageWasInterruptedAtStart()` → `removeMessage()` | None | Error fragments |
| **Beam Scatter** | `'beam-scatter'` | `messageWasInterruptedAtStart()` → empty message | `SCATTER_PLACEHOLDER` | Ray status update |
| **Beam Gather** | `'beam-gather'` | `messageWasInterruptedAtStart()` → clear fragments | `GATHER_PLACEHOLDER` | Re-throw errors |
| **Beam Follow-up** | `'beam-followup'` | `messageWasInterruptedAtStart()` → remove message | `FOLLOWUP_PLACEHOLDER` | Status updates |
| **ScratchChat** | `'scratch-chat'` | `aborted && !fragments` → array removal | `SCRATCH_CHAT_PLACEHOLDER` | Error fragments |
| **Telephone** | `'call'` | None | None | Basic handling |
| **ReAct Agent** | `'chat-react-turn'` | None | None | Append errors |
| **Variform** | `'_DEV_'` | None | None | Throw errors |

### Direct Request Callers (`aixChatGenerateContent_DMessage`)

| **Caller** | **Context** | **Message Removal** | **Error Handling** |
|------------|-------------|-------------------|-------------------|
| **Auto Follow-ups** | `'chat-followup-*'` | `fragmentDelete()` on failure | `fragmentReplace()` with error |
| **Gen CR Diffs** | `'aifn-gen-cr-diffs'` | None | State-based handling |
| **Code Fixup** | `'fixup-code'` | None | Throw errors |
| **Attachment Prompts** | `'chat-attachment-prompts'` | None | Throw errors |

### Text-Only Utilities (`aixChatGenerateText_Simple`)

| **Utility** | **Purpose** | **Error Strategy** | **Called By** |
|-------------|-------------|-------------------|---------------|
| **conversationTitle** | Auto-generate chat titles | Try/catch with fallback | UI components |
| **conversationSummary** | Generate summaries | Try/catch with fallback | Chat drawer |
| **useStreamChatText** | Generic text streaming | Error state management | FlattenerModal |
| **useLLMChain** | Multi-step processing | Step-by-step handling | Persona creation |
| **imaginePromptFromText** | Text → image prompts | Simple propagation | Image generation |
| **aifnBeamGenerateBriefing** | Beam summaries | Null return on error | Beam completion |
| **useAifnPersonaGenIdentity** | Extract persona identity | Query error handling | Persona flows |
| **DiagramsModal** | Generate diagrams | Component error state | Manual generation |

## Message Removal Patterns

### 1. Complete Message Removal
- **Chat Persona**: `messageWasInterruptedAtStart()` → `messageEditor.removeMessage()`
- **ScratchChat**: `outcome === 'aborted' && !fragments?.length` → array removal
- **Trigger**: Message aborted before any content generated

### 2. Fragment-Level Management
- **Beam Gather**: Clear fragments array but keep message structure
- **Auto Follow-ups**: Delete specific placeholder fragments on failure
- **Purpose**: Maintain message structure while removing failed content

### 3. Empty Message Replacement
- **Beam Scatter**: Replace with `createDMessageEmpty()` but preserve ray structure
- **Purpose**: Keep UI structure intact while indicating failure

### 4. No Removal Strategy
- **Text-only functions**: Use fallback values, error states, or null returns
- **Simple callers**: Propagate errors upstream for handling

## Error Handling by Layer

### UI Layer (Components)
- **Pattern**: Rich error states with user-facing messages
- **Examples**: DiagramsModal, FlattenerModal
- **Features**: Retry mechanisms, fallback UI, loading states

### Utility Layer (Hooks/Functions)
- **Pattern**: Graceful degradation with fallbacks
- **Examples**: conversationTitle, conversationSummary
- **Features**: Silent failures, default values, try/catch blocks

### Core Layer (Direct API)
- **Pattern**: Minimal handling, error propagation
- **Examples**: Code Fixup, Attachment Prompts
- **Features**: Assumes upstream error handling

## Key Implementation Details

### Message Removal Detection
```typescript
// Core detection logic
function messageWasInterruptedAtStart(message: Pick<DMessage, 'generator' | 'fragments'>): boolean {
  return message.generator?.tokenStopReason === 'client-abort' && message.fragments.length === 0;
}
```

### Placeholder Management
- **Initialization**: `createPlaceholderVoidFragment(placeholderText)`
- **Replacement**: During streaming updates or on completion
- **Cleanup**: Delete on error to avoid stale content

### Context Patterns
- **Production**: `'conversation'`, `'beam-scatter'`, `'scratch-chat'`
- **Features**: `'chat-followup-*'`, `'fixup-code'`, `'ai-diagram'`
- **Development**: `'_DEV_'`

## Best Practices

### Message Removal
- Use `messageWasInterruptedAtStart()` for consistent detection
- Only remove messages with no content that were client-aborted
- Consider UI context when choosing removal vs. clearing strategy

### Error Handling
- **Fragment-level**: Use `messageEditor.fragmentReplace()` with error fragments
- **Message-level**: Use `messageEditor.removeMessage()` or array removal
- **Status-level**: Update component state for UI feedback

### Placeholder Management
- Initialize with descriptive placeholders using `createPlaceholderVoidFragment()`
- Replace during streaming updates
- Clean up on error to prevent stale content

## Architectural Insights

1. **Layered Error Handling**: Sophistication increases closer to UI
2. **Context Specialization**: Different contexts for different use cases
3. **Streaming vs Non-Streaming**: Conversation functions stream, utilities typically don't
4. **Message vs Fragment Management**: Different strategies for different UI needs

The most sophisticated handling is in **Beam modules** and **Chat Persona** with comprehensive removal logic, while simpler callers rely on upstream error handling.

## Code References

- **Core function**: `src/modules/aix/client/aix.client.ts:aixChatGenerateContent_DMessage_FromConversation`
- **Removal check**: `src/common/stores/chat/chat.message.ts:388:messageWasInterruptedAtStart()`
- **Placeholder creation**: `src/common/stores/chat/chat.fragments.ts:createPlaceholderVoidFragment()`