# Extensible Cost Metrics Design

## Overview

Redesign the cost tracking system to support:
- Multiple charge types (tokens, searches, images, traffic, etc.)
- Operation-level breakdown (chat, beam, auto-title, etc.)
- Per-model breakdown within operations
- Forward compatibility for distributed systems with older data at rest

## Requirements

1. **Extensibility**: Support future charge types without breaking changes
2. **Forward Compatibility**: Old clients can ignore new fields
3. **Type Safety**: Use type discrimination for different charge types
4. **Compact Storage**: Minimize JSON size with short keys
5. **Monotonic**: Metrics only accumulate, never reset
6. **Hierarchical**: conversation → operations → models → charge types

## Data Structure Design

### Top-Level: Conversation Metrics

```typescript
interface DConversationMetrics {
  // Root totals (for quick display without traversing tree)
  $c?: number;              // total cost in cents
  tIn?: number;             // total input tokens
  tOut?: number;            // total output tokens

  // Operation breakdown (optional, for detailed analysis)
  ops?: {
    [opType: string]: DOperationMetrics;  // 'chat', 'beam', 'auto-title', etc.
  };

  // Version for future migration
  v?: number;               // default: 1
}
```

### Level 1: Operation Metrics

```typescript
interface DOperationMetrics {
  // Operation totals
  $c?: number;              // operation cost in cents
  tIn?: number;             // operation input tokens
  tOut?: number;            // operation output tokens
  n?: number;               // usage count

  // Model breakdown (optional)
  m?: {
    [llmId: string]: DModelMetrics;
  };
}
```

### Level 2: Model Metrics

```typescript
interface DModelMetrics {
  // Model totals
  $c?: number;              // model cost in cents
  tIn?: number;             // model input tokens
  tOut?: number;            // model output tokens
  n?: number;               // usage count

  // Charge breakdown (optional, for detailed analysis)
  ch?: DChargeMetrics[];    // array of charge entries
}
```

### Level 3: Charge Metrics (Type Discriminated)

```typescript
type DChargeMetrics =
  | DChargeMetrics_Tokens
  | DChargeMetrics_Search
  | DChargeMetrics_ImageGen
  | DChargeMetrics_Traffic
  | DChargeMetrics_Generic;

// Token-based charges (most common)
interface DChargeMetrics_Tokens {
  ct: 'tok';                // charge type: tokens
  $c: number;               // cost in cents
  tIn?: number;             // input tokens
  tOut?: number;            // output tokens
  tCR?: number;             // cache read tokens
  tCW?: number;             // cache write tokens
  tOutR?: number;           // reasoning tokens
}

// Search-based charges (Perplexity)
interface DChargeMetrics_Search {
  ct: 'search';             // charge type: search
  $c: number;               // cost in cents
  n: number;                // number of searches
}

// Image generation charges (DALL-E, Prodia)
interface DChargeMetrics_ImageGen {
  ct: 'img';                // charge type: image
  $c: number;               // cost in cents
  n: number;                // number of images
  res?: string;             // resolution (e.g., '1024x1024')
}

// Traffic-based charges (per GB)
interface DChargeMetrics_Traffic {
  ct: 'traffic';            // charge type: traffic
  $c: number;               // cost in cents
  gb: number;               // gigabytes
}

// Generic extensible charges
interface DChargeMetrics_Generic {
  ct: string;               // charge type: vendor-specific
  $c: number;               // cost in cents
  meta?: Record<string, number | string>;  // extensible metadata
}
```

## Key Design Decisions

### 1. Type Discrimination
Use `ct` (charge type) field for type discrimination:
- `'tok'`: Token-based (most common, optimized)
- `'search'`: Search results
- `'img'`: Image generation
- `'traffic'`: Bandwidth/traffic
- `string`: Future vendor-specific types

### 2. Hierarchical Structure
```
DConversation
  └─ metrics?: DConversationMetrics
       ├─ $c, tIn, tOut (root totals)
       └─ ops?
            ├─ 'chat': DOperationMetrics
            │    ├─ $c, tIn, tOut, n
            │    └─ m?
            │         └─ 'llm-123': DModelMetrics
            │              ├─ $c, tIn, tOut, n
            │              └─ ch?
            │                   ├─ { ct: 'tok', $c, tIn, tOut }
            │                   └─ { ct: 'search', $c, n }
            ├─ 'beam': ...
            └─ 'auto-title': ...
```

### 3. Compact Encoding
- Short keys: `$c`, `tIn`, `tOut`, `ct`, `ch`, `ops`, `m`, `n`, `v`
- Costs in cents (avoid floating point)
- Optional fields (only include if present)
- Root-level totals (avoid tree traversal for display)

### 4. Forward Compatibility
- All fields optional (except discriminators)
- Unknown `ct` types can be ignored by old clients
- `v` field for future major version changes
- Unknown `ops` types can be ignored

### 5. Backward Compatibility
- Old data without `metrics` field continues to work
- Migration not required (opt-in enhancement)
- Can coexist with existing per-message metrics

## Accumulation Logic

```typescript
function accumulateMetrics(
  existing: DConversationMetrics | undefined,
  opType: string,           // 'chat', 'beam', 'auto-title'
  llmId: string,
  charge: DChargeMetrics,
): DConversationMetrics {
  const metrics = existing || {};

  // Accumulate root totals
  metrics.$c = (metrics.$c || 0) + charge.$c;
  if ('tIn' in charge) metrics.tIn = (metrics.tIn || 0) + (charge.tIn || 0);
  if ('tOut' in charge) metrics.tOut = (metrics.tOut || 0) + (charge.tOut || 0);

  // Accumulate operation level
  const ops = metrics.ops = metrics.ops || {};
  const op = ops[opType] = ops[opType] || {};
  op.$c = (op.$c || 0) + charge.$c;
  if ('tIn' in charge) op.tIn = (op.tIn || 0) + (charge.tIn || 0);
  if ('tOut' in charge) op.tOut = (op.tOut || 0) + (charge.tOut || 0);
  op.n = (op.n || 0) + 1;

  // Accumulate model level
  const models = op.m = op.m || {};
  const model = models[llmId] = models[llmId] || {};
  model.$c = (model.$c || 0) + charge.$c;
  if ('tIn' in charge) model.tIn = (model.tIn || 0) + (charge.tIn || 0);
  if ('tOut' in charge) model.tOut = (model.tOut || 0) + (charge.tOut || 0);
  model.n = (model.n || 0) + 1;

  // Accumulate charge details (optional, for analysis)
  // model.ch = model.ch || [];
  // model.ch.push(charge);

  return metrics;
}
```

## UI Rendering

### ChatPane - Costs Section

```tsx
<OptimaPanelGroupedList title='Costs'>
  {/* Conversation total */}
  <ListItem>
    <div>Total:</div>
    <div><b>{formatModelsCost(metrics.$c / 100)}</b></div>
  </ListItem>

  {/* Breakdown by operation (collapsible) */}
  {metrics.ops && (
    <ListItem>
      <div>Chat:</div>
      <div><b>{formatModelsCost(metrics.ops.chat.$c / 100)}</b></div>
    </ListItem>
  )}

  {/* Token summary */}
  {(metrics.tIn || metrics.tOut) && (
    <ListItem>
      <div>Tokens:</div>
      <div>{metrics.tIn?.toLocaleString()} in, {metrics.tOut?.toLocaleString()} out</div>
    </ListItem>
  )}
</OptimaPanelGroupedList>
```

## Migration Strategy

### Phase 1: Add structures (no breaking changes)
- Add `DConversationMetrics` to `DConversation` interface
- Add accumulation functions
- No automatic migration required

### Phase 2: Start accumulating (opt-in)
- Update AIX client to accumulate metrics
- Only new messages/operations contribute
- Old conversations remain empty (or show "N/A")

### Phase 3: Backfill (optional, future)
- Could traverse message history to compute metrics
- Would be expensive, opt-in only

## Future Extensions

### Time-based accumulation
Add temporal breakdown to operations:
```typescript
interface DOperationMetrics {
  // ... existing fields
  t?: {
    [timestamp: string]: DTimeMetrics;  // '2025-11-01', '2025-11-02'
  };
}
```

### Multi-device sync
Could extend with sync metadata:
```typescript
interface DConversationMetrics {
  // ... existing fields
  sync?: {
    lastSync: number;     // timestamp
    deviceId: string;     // device identifier
  };
}
```

### Detailed charge history
Enable by storing charge array:
```typescript
interface DModelMetrics {
  // ... existing fields
  ch?: DChargeMetrics[];    // detailed charge history
}
```

## Examples

### Example 1: Simple chat with tokens only
```json
{
  "$c": 15,
  "tIn": 1000,
  "tOut": 500,
  "ops": {
    "chat": {
      "$c": 15,
      "tIn": 1000,
      "tOut": 500,
      "n": 1,
      "m": {
        "llm-gpt4": {
          "$c": 15,
          "tIn": 1000,
          "tOut": 500,
          "n": 1
        }
      }
    }
  }
}
```

### Example 2: Perplexity with search
```json
{
  "$c": 25,
  "tIn": 500,
  "tOut": 200,
  "ops": {
    "chat": {
      "$c": 25,
      "tIn": 500,
      "tOut": 200,
      "n": 1,
      "m": {
        "llm-sonar-pro": {
          "$c": 25,
          "tIn": 500,
          "tOut": 200,
          "n": 1,
          "ch": [
            { "ct": "tok", "$c": 20, "tIn": 500, "tOut": 200 },
            { "ct": "search", "$c": 5, "n": 3 }
          ]
        }
      }
    }
  }
}
```

### Example 3: Multi-operation (chat + beam + auto-title)
```json
{
  "$c": 150,
  "tIn": 5000,
  "tOut": 2000,
  "ops": {
    "chat": {
      "$c": 50,
      "tIn": 2000,
      "tOut": 800,
      "n": 3,
      "m": {
        "llm-gpt4": { "$c": 50, "tIn": 2000, "tOut": 800, "n": 3 }
      }
    },
    "beam": {
      "$c": 95,
      "tIn": 3000,
      "tOut": 1100,
      "n": 1,
      "m": {
        "llm-gpt4": { "$c": 40, "tIn": 1000, "tOut": 400, "n": 1 },
        "llm-claude": { "$c": 35, "tIn": 1000, "tOut": 350, "n": 1 },
        "llm-gemini": { "$c": 20, "tIn": 1000, "tOut": 350, "n": 1 }
      }
    },
    "auto-title": {
      "$c": 5,
      "tIn": 0,
      "tOut": 100,
      "n": 1,
      "m": {
        "llm-gpt4-mini": { "$c": 5, "tOut": 100, "n": 1 }
      }
    }
  }
}
```

## Implementation Files

1. `src/common/stores/chat/chat.conversation.ts` - Add `metrics?: DConversationMetrics`
2. `src/common/stores/chat/chat.metrics.ts` - New file for metrics types and functions
3. `src/modules/aix/client/aix.client.ts` - Accumulate metrics after message completion
4. `src/apps/chat/components/layout-pane/ChatPane.tsx` - Add costs UI section
5. `src/common/stores/chat/store-chats.ts` - Ensure metrics persist

## JSON Size Comparison

### Current (per-message only, stored in each DMessage):
```json
{
  "generator": {
    "metrics": {
      "TIn": 1000,
      "TOut": 500,
      "$c": 15,
      "dtAll": 1500,
      "vTOutInner": 45.3
    }
  }
}
```
Size: ~120 bytes per message × 50 messages = 6KB

### Proposed (conversation-level accumulation):
```json
{
  "metrics": {
    "$c": 750,
    "tIn": 50000,
    "tOut": 25000,
    "ops": {
      "chat": {
        "$c": 750,
        "tIn": 50000,
        "tOut": 25000,
        "n": 50
      }
    }
  }
}
```
Size: ~150 bytes total for entire conversation

**Savings**: 6KB → 0.15KB = **97.5% reduction** for conversation-level metrics

**Note**: Per-message metrics remain for detailed analysis. Conversation metrics provide quick totals.
