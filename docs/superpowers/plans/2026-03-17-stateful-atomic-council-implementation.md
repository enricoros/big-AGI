# Stateful Atomic Council Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mixed mutable/transcript-driven Council runtime with an append-only atomic journal, a pure reducer-derived projection, and resume-safe scheduling.

**Architecture:** Introduce a durable Council operation log as the source of truth, rebuild a session projection with a pure reducer, and migrate execution, resume, and Council trace UI to read only from committed operations. Keep migration incremental: dual-write first, then switch recovery/scheduling, then remove the legacy control path.

**Tech Stack:** TypeScript, React, Zustand conversation persistence, existing chat editor runtime, Node test runner with `tsx`

---

## Chunk 1: Durable Council Journal Model

### Task 1: Define operation log types

**Files:**
- Create: `src/apps/chat/editors/_handleExecute.council.log.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.log.test.ts`
- Reference: `src/apps/chat/editors/_handleExecute.council.ts`
- Reference: `src/common/stores/chat/chat.conversation.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('createCouncilOp appends monotonic sequence and preserves payload', () => {
  const existing = [{ opId: 'a', sequence: 0 } as any];
  const op = createCouncilOp(existing, 'leader_turn_committed', { roundIndex: 0 });
  assert.equal(op.sequence, 1);
  assert.equal(op.type, 'leader_turn_committed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.log.test.ts`
Expected: FAIL because the log helpers do not exist yet

- [ ] **Step 3: Write minimal implementation**

Create focused helpers for:
- `CouncilOp`
- `CouncilOpType`
- `createCouncilOp(existingOps, type, payload, meta)`
- duplicate/idempotency guards

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.log.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.log.ts src/apps/chat/editors/_handleExecute.council.log.test.ts
git commit -m "feat: add council operation log model"
```

### Task 2: Extend persisted conversation shape for atomic council storage

**Files:**
- Modify: `src/common/stores/chat/chat.conversation.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.log.test.ts`

- [ ] **Step 1: Write the failing test**

Add an assertion that a conversation can carry `councilOpLog` and that type helpers accept it.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.log.test.ts`
Expected: FAIL with missing `councilOpLog` typing

- [ ] **Step 3: Write minimal implementation**

Add:
- `councilOpLog?: CouncilOp[]`
- optional derived projection cache field only if needed

Do not remove legacy `workflowState` yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.log.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/stores/chat/chat.conversation.ts src/apps/chat/editors/_handleExecute.council.log.test.ts
git commit -m "feat: persist council operation log on conversations"
```

## Chunk 2: Pure Reducer and Projection

### Task 3: Build reducer that replays the operation log

**Files:**
- Create: `src/apps/chat/editors/_handleExecute.council.reducer.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.reducer.test.ts`
- Reference: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('reduceCouncilOps rebuilds an accepted session from committed ops', () => {
  const projection = reduceCouncilOps([
    sessionStartedOp,
    roundStartedOp,
    leaderCommittedOp,
    reviewerPlanCommittedOpA,
    reviewerPlanCommittedOpB,
    reviewerVoteCommittedOpA,
    reviewerVoteCommittedOpB,
    roundCompletedAcceptedOp,
    sessionAcceptedOp,
  ]);
  assert.equal(projection.status, 'accepted');
  assert.equal(projection.finalResponse, 'Approved proposal');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.reducer.test.ts`
Expected: FAIL because reducer is missing

- [ ] **Step 3: Write minimal implementation**

Implement:
- reducer envelope replay
- idempotent duplicate `opId` handling
- projection fields for status, round, plans, votes, final response, resumability
- invariant checks for impossible ordering

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.reducer.ts src/apps/chat/editors/_handleExecute.council.reducer.test.ts
git commit -m "feat: add council log reducer"
```

### Task 4: Cover replay edge cases

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.reducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- paused replay
- stopped replay
- exhausted replay
- duplicate `opId`
- invalid op order

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.reducer.test.ts`
Expected: FAIL on missing cases

- [ ] **Step 3: Write minimal implementation**

Tighten reducer logic only enough to satisfy the added cases.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.reducer.test.ts src/apps/chat/editors/_handleExecute.council.reducer.ts
git commit -m "test: cover council reducer replay edge cases"
```

## Chunk 3: Atomic Runtime Boundaries

### Task 5: Move Leader/reviewer runtime writes to commit-once semantics

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Test: `src/apps/chat/editors/_handleExecute.runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- interrupted leader run before commit does not persist proposal
- interrupted reviewer vote before commit does not persist vote
- committed turn survives resume without rerun

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: FAIL on partial-state assumptions

- [ ] **Step 3: Write minimal implementation**

Refactor execution so that:
- partial streaming stays ephemeral
- validated structured output becomes a single `*_committed` op
- projection is recomputed only after commit

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.ts src/apps/chat/editors/_handleExecute.ts src/apps/chat/editors/_handleExecute.council.test.ts src/apps/chat/editors/_handleExecute.runtime.test.ts
git commit -m "feat: make council runtime commit atomically"
```

### Task 6: Add scheduler derived from projection only

**Files:**
- Create: `src/apps/chat/editors/_handleExecute.council.scheduler.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.scheduler.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('scheduler picks reviewer votes only after all reviewer plans are committed', () => {
  const nextStep = getNextCouncilStep(projectionWithPlansCompleteButVotesPending);
  assert.deepStrictEqual(nextStep, { kind: 'reviewer-vote', participantId: 'reviewer-b' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.scheduler.test.ts`
Expected: FAIL because scheduler does not exist

- [ ] **Step 3: Write minimal implementation**

Implement `getNextCouncilStep(projection)` with explicit rules for:
- leader proposal
- reviewer plans
- reviewer votes
- round completion
- terminal/no-op states

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.scheduler.ts src/apps/chat/editors/_handleExecute.council.scheduler.test.ts src/apps/chat/editors/_handleExecute.council.ts
git commit -m "feat: schedule council work from projection"
```

## Chunk 4: Resume, Pause, Stop, Unexpected Close

### Task 7: Migrate persisted council resume path to journal replay

**Files:**
- Modify: `src/common/chat-overlay/store-perchat-composer_slice.ts`
- Modify: `src/common/chat-overlay/ConversationHandler.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Test: `src/apps/chat/editors/_handleExecute.runtime.test.ts`
- Test: `src/common/stores/chat/store-chats.council.test.ts`

- [ ] **Step 1: Write the failing tests**

Add resume/reopen tests for:
- paused council resumes from last committed op
- stopped council does not resume
- unexpected reload discards uncommitted work

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Run: `node --import tsx --test src/common/stores/chat/store-chats.council.test.ts`
Expected: FAIL on legacy resume path

- [ ] **Step 3: Write minimal implementation**

Switch recovery to:
- rebuild projection from `councilOpLog`
- derive `canResume`
- resume only missing steps

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Run: `node --import tsx --test src/common/stores/chat/store-chats.council.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/common/chat-overlay/store-perchat-composer_slice.ts src/common/chat-overlay/ConversationHandler.ts src/apps/chat/editors/_handleExecute.ts src/apps/chat/editors/_handleExecute.runtime.test.ts src/common/stores/chat/store-chats.council.test.ts
git commit -m "feat: replay council journal on resume"
```

### Task 8: Make pause and stop durable control ops

**Files:**
- Modify: `src/apps/chat/components/composer/Composer.tsx`
- Modify: `src/common/chat-overlay/ConversationHandler.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Test: `src/apps/chat/components/composer/Composer.controls.test.ts`
- Test: `src/apps/chat/editors/_handleExecute.runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests proving:
- pause appends `session_paused` and scheduler halts
- stop appends `session_stopped` and session becomes terminal

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/components/composer/Composer.controls.test.ts`
Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Expected: FAIL due to non-durable control semantics

- [ ] **Step 3: Write minimal implementation**

Wire pause/stop through journal commits rather than mutable workflow flags.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/apps/chat/components/composer/Composer.controls.test.ts`
Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/composer/Composer.tsx src/common/chat-overlay/ConversationHandler.ts src/apps/chat/editors/_handleExecute.council.ts src/apps/chat/components/composer/Composer.controls.test.ts src/apps/chat/editors/_handleExecute.runtime.test.ts
git commit -m "feat: persist council pause and stop transitions"
```

## Chunk 5: Projection-Only Council Trace UI

### Task 9: Switch Council trace rendering to reducer projection data only

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.tsx`
- Test: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Test: `src/apps/chat/components/message/CouncilTraceMessage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests proving:
- trace renders proposals/plans/votes from projection
- uncommitted partial data never appears
- final accepted answer equals accepted proposal verbatim

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
Expected: FAIL on legacy mixed state assumptions

- [ ] **Step 3: Write minimal implementation**

Replace any remaining transcript/control coupling with projection-only rendering inputs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Run: `node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/ChatMessageList.councilTrace.ts src/apps/chat/components/message/CouncilTraceMessage.tsx src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.test.tsx
git commit -m "feat: render council trace from atomic projection"
```

## Chunk 6: Legacy Cleanup and Documentation

### Task 10: Remove transcript-driven control remnants and document the new guarantees

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/common/stores/chat/chat.conversation.ts`
- Modify: `docs/changelog.md`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write the failing test**

Add one final regression test proving the runtime does not need transcript parsing to resume a council turn.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: FAIL while old helper paths still exist

- [ ] **Step 3: Write minimal implementation**

Delete or isolate old control-path helpers so the journal/reducer path is the only orchestration path. Update changelog with the new atomic resume guarantees.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.ts src/common/stores/chat/chat.conversation.ts docs/changelog.md src/apps/chat/editors/_handleExecute.council.test.ts
git commit -m "refactor: retire legacy council control path"
```
