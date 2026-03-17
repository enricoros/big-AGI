# Council Trace UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated transcript-level Council trace card that exposes the full stateful round workflow before the final assistant response, with per-round disclosure and side-by-side agent cards.

**Architecture:** Keep the final assistant response in the normal transcript flow and render a separate `Council trace` artifact from structured Council workflow state. Extract trace derivation and layout helpers into small pure modules with `node:test` coverage, then compose them in a focused `CouncilTraceMessage` component that `ChatMessageList` can insert before the final result.

**Tech Stack:** React, TypeScript, Joy UI, Zustand overlay state, `node:test`, `tsx`

---

## File Structure

- Create: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
  Responsibility: derive Council trace placement and round view models from transcript messages, participants, and `councilSession.workflowState`.
- Create: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
  Responsibility: unit tests for trace insertion, round ordering, default expansion state, omission/fallback behavior, and shared-reasons labeling.
- Create: `src/apps/chat/components/message/CouncilTraceMessage.tsx`
  Responsibility: render the transcript-level Council trace card, top-level disclosure, round disclosure, and responsive agent board.
- Create: `src/apps/chat/components/message/CouncilTraceMessage.layout.ts`
  Responsibility: small pure helpers for round-board grid/overflow behavior and status chip styling decisions.
- Create: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
  Responsibility: unit tests for side-by-side board layout decisions and status treatment helpers.
- Modify: `src/apps/chat/components/ChatMessageList.tsx`
  Responsibility: replace the current Council-only deliberation toggle path with trace insertion logic and render the new trace item before the Council final response.
- Modify: `docs/changelog.md`
  Responsibility: record the Council trace UI change.

## Chunk 1: Trace Derivation

### Task 1: Add failing tests for Council trace view-model derivation

**Files:**
- Create: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Reference: `src/apps/chat/editors/_handleExecute.consensus.ts`
- Reference: `src/common/chat-overlay/store-perchat-composer_slice.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCouncilTraceRenderPlan } from './ChatMessageList.councilTrace';

test('accepted council workflow inserts a trace item immediately before the final result', () => {
  const plan = buildCouncilTraceRenderPlan({
    messages: [proposal1, proposal2, finalResult],
    participants,
    councilSession,
  });

  assert.equal(plan.traceItem?.placement.anchorMessageId, finalResult.id);
  assert.equal(plan.traceItem?.rounds[0]?.roundIndex, 1);
  assert.equal(plan.traceItem?.rounds[0]?.defaultExpanded, true);
  assert.equal(plan.traceItem?.rounds[1]?.defaultExpanded, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: FAIL because `./ChatMessageList.councilTrace` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildCouncilTraceRenderPlan() {
  return { traceItem: null };
}
```

- [ ] **Step 4: Expand the failing suite before real implementation**

Add tests for:
- interrupted workflow renders a trace item without a final-result anchor
- workflow state absence omits the trace entirely
- rejection rounds label shared reasons as `Shared with next round`, `Queued for next round`, or `Final rejection reasons`
- reviewer cards follow `reviewerParticipantIds` ordering

- [ ] **Step 5: Run test to verify the suite still fails for the right reasons**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: FAIL with assertion mismatches around missing placement, rounds, and labels.

### Task 2: Implement the trace derivation helper

**Files:**
- Create: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
- Test: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`

- [ ] **Step 1: Write the minimal implementation to satisfy the derivation tests**

```ts
export function buildCouncilTraceRenderPlan({ messages, participants, councilSession }) {
  const workflowState = councilSession.workflowState;
  if (!workflowState)
    return { traceItem: null };

  const rounds = [...workflowState.rounds]
    .slice()
    .sort((a, b) => b.roundIndex - a.roundIndex)
    .map((round, index) => ({
      roundIndex: round.roundIndex,
      defaultExpanded: index === 0,
      sharedReasonsLabel: deriveSharedReasonsLabel(round, workflowState),
      agentCards: buildAgentCards(round, workflowState, participants),
    }));

  return {
    traceItem: {
      rounds,
      placement: findCouncilTracePlacement(messages, councilSession, workflowState),
    },
  };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: PASS

- [ ] **Step 3: Refactor for explicit types and narrow helpers**

Extract focused helpers such as:
- `findCouncilTracePlacement`
- `deriveSharedReasonsLabel`
- `buildReviewerTraceCard`

- [ ] **Step 4: Re-run the derivation tests**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/ChatMessageList.councilTrace.ts src/apps/chat/components/ChatMessageList.councilTrace.test.ts
git commit -m "test: add council trace derivation helpers"
```

## Chunk 2: Trace Component And Layout

### Task 3: Add failing tests for layout helpers

**Files:**
- Create: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
- Reference: `src/apps/chat/components/layout-bar/ChatBarChat.layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCouncilTraceBoardSx,
  getCouncilTraceStatusTone,
} from './CouncilTraceMessage.layout';

test('reviewer-heavy rounds keep side-by-side cards inside a horizontal overflow container', () => {
  assert.deepStrictEqual(getCouncilTraceBoardSx(5), {
    display: 'grid',
    gap: 1,
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(16rem, 1fr)',
    overflowX: 'auto',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
Expected: FAIL because `CouncilTraceMessage.layout` does not exist yet.

- [ ] **Step 3: Add more failing assertions**

Cover:
- accepted status maps to success styling
- interrupted status maps to warning/danger styling
- mobile board layout remains single-column

- [ ] **Step 4: Re-run to keep the suite red**

Run: `node --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
Expected: FAIL with missing exports or assertion failures.

### Task 4: Implement layout helpers and the Council trace component

**Files:**
- Create: `src/apps/chat/components/message/CouncilTraceMessage.layout.ts`
- Create: `src/apps/chat/components/message/CouncilTraceMessage.tsx`
- Test: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`

- [ ] **Step 1: Write minimal layout helpers**

```ts
export function getCouncilTraceBoardSx(cardCount: number) {
  return {
    display: 'grid',
    gap: 1,
    gridAutoFlow: 'column',
    gridAutoColumns: `minmax(${cardCount > 3 ? '16rem' : '18rem'}, 1fr)`,
    overflowX: 'auto',
  } as const;
}
```

- [ ] **Step 2: Run the layout tests**

Run: `node --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `CouncilTraceMessage.tsx` with focused props**

```tsx
export function CouncilTraceMessage(props: {
  trace: CouncilTraceRenderItem;
  participants: DConversationParticipant[];
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [expandedRounds, setExpandedRounds] = React.useState(() => new Set(
    props.trace.rounds.filter(round => round.defaultExpanded).map(round => round.roundKey),
  ));

  return (
    <ListItem sx={{ display: 'block', px: 0, py: 0 }}>
      {/* header, disclosure, round cards, shared reasons */}
    </ListItem>
  );
}
```

- [ ] **Step 4: Keep `CouncilTraceMessage.tsx` presentation-only**

Do not re-derive protocol state inside the component. It should consume the render plan from `ChatMessageList.councilTrace.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/message/CouncilTraceMessage.layout.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts src/apps/chat/components/message/CouncilTraceMessage.tsx
git commit -m "feat: add council trace transcript component"
```

## Chunk 3: Transcript Integration

### Task 5: Add failing integration-style tests for transcript insertion

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Modify: `src/apps/chat/components/ChatMessageList.tsx`

- [ ] **Step 1: Extend the derivation tests to cover transcript integration expectations**

```ts
test('council trace suppresses the legacy deliberation toggle for council runs', () => {
  const plan = buildCouncilTraceRenderPlan({
    messages,
    participants,
    councilSession,
  });

  assert.equal(plan.traceItem?.showLegacyDeliberationToggle, false);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: FAIL until the integration contract is implemented.

### Task 6: Integrate the trace into `ChatMessageList`

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.tsx`
- Create or reuse: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
- Create or reuse: `src/apps/chat/components/message/CouncilTraceMessage.tsx`

- [ ] **Step 1: Insert the trace render plan into `ChatMessageList`**

```tsx
const councilTracePlan = React.useMemo(() => buildCouncilTraceRenderPlan({
  messages: filteredMessages,
  participants,
  councilSession,
}), [filteredMessages, participants, councilSession]);
```

- [ ] **Step 2: Render the trace before the anchored final result**

Use the derived placement metadata instead of hard-coding “last message” assumptions.

- [ ] **Step 3: Hide the legacy `Show deliberation` button for Council runs that can render a trace**

Keep non-Council or non-structured deliberation flows unchanged.

- [ ] **Step 4: Run the focused tests**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
Expected: PASS

- [ ] **Step 5: Smoke-test TypeScript compilation**

Run: `npx tsc -p tsconfig.json --noEmit --pretty false`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/apps/chat/components/ChatMessageList.tsx src/apps/chat/components/ChatMessageList.councilTrace.ts src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.tsx src/apps/chat/components/message/CouncilTraceMessage.layout.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts
git commit -m "feat: render council trace in chat transcript"
```

## Chunk 4: Documentation And Verification

### Task 7: Update docs and changelog

**Files:**
- Modify: `docs/changelog.md`
- Reference: `docs/superpowers/specs/2026-03-17-council-trace-ui-design.md`

- [ ] **Step 1: Add the user-facing changelog entry**

```md
- Chat: Council mode now shows a collapsible Council trace before the final answer, with round-by-round proposals, reviewer verdicts, and verbatim rejection reasons.
```

- [ ] **Step 2: Commit the doc update**

```bash
git add docs/changelog.md
git commit -m "docs: note council trace ui"
```

### Task 8: Run final verification

**Files:**
- Verify: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Verify: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
- Verify: `src/apps/chat/components/ChatMessageList.tsx`
- Verify: `src/apps/chat/components/message/CouncilTraceMessage.tsx`

- [ ] **Step 1: Run the focused trace tests**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
Expected: PASS

- [ ] **Step 2: Run the existing Council orchestration tests to guard behavior drift**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.consensus.test.ts src/apps/chat/editors/_handleExecute.runtime.test.ts`
Expected: PASS

- [ ] **Step 3: Run full type-check**

Run: `npx tsc -p tsconfig.json --noEmit --pretty false`
Expected: PASS

- [ ] **Step 4: Manual UI smoke test**

Run the app and verify:
- accepted Council run shows `Council trace` before the final response
- top-level trace starts collapsed
- newest round starts expanded
- prior rounds start collapsed
- reviewer cards stay side-by-side on desktop and scroll horizontally when crowded
- mobile stacks the round board vertically

- [ ] **Step 5: Final commit**

```bash
git add src/apps/chat/components/ChatMessageList.tsx src/apps/chat/components/ChatMessageList.councilTrace.ts src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.tsx src/apps/chat/components/message/CouncilTraceMessage.layout.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts docs/changelog.md
git commit -m "feat: add council trace workflow UI"
```
