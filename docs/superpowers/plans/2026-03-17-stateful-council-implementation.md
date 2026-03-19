# Stateful Council Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace transcript-driven council with a stateful leader-reviewer council workflow that ends only on unanimous reviewer acceptance of a Leader proposal.

**Architecture:** Introduce explicit council session and round state as the orchestration source of truth, then project that state into transcript messages for UI display. The Leader drafts proposals, isolated reviewers cast accept/reject ballots, and aggregated rejection reasons drive subsequent rounds until acceptance, exhaustion, or interruption.

**Tech Stack:** TypeScript, existing chat orchestration pipeline, Zustand chat state, Node test runner

---

## Chunk 1: Council Domain Model

### Task 1: Add explicit Council state types

**Files:**
- Modify: `src/common/stores/chat/chat.message.ts`
- Modify: `src/common/chat-overlay/store-perchat-composer_slice.ts`
- Modify: `src/common/stores/chat/chat.conversation.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing tests for stateful council records and outcomes**
- [ ] **Step 2: Run test to verify it fails**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
- [ ] **Step 3: Add minimal types for session, round, proposal, and ballot records**
- [ ] **Step 4: Run test to verify it passes**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

## Chunk 2: State Machine

### Task 2: Implement council session coordinator

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing tests for drafting -> reviewing -> accepted transitions**
- [ ] **Step 2: Write failing tests for rejection causing a new drafting round**
- [ ] **Step 3: Implement the minimal state machine helpers**
- [ ] **Step 4: Run focused tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

### Task 3: Handle interruption, exhaustion, and resume

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/common/chat-overlay/ConversationHandler.ts`
- Modify: `src/common/stores/chat/chats.converters.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing tests for resume from drafting and reviewing rounds**
- [ ] **Step 2: Write failing tests for max-round exhaustion**
- [ ] **Step 3: Implement minimal persistence and rehydration logic**
- [ ] **Step 4: Run focused tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

## Chunk 3: Prompt Isolation

### Task 4: Split Leader and reviewer prompt builders

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Modify: `src/apps/chat/editors/chat-persona.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing prompt-builder tests for Leader inputs**
- [ ] **Step 2: Write failing prompt-builder tests for reviewer isolation**
- [ ] **Step 3: Implement minimal isolated prompt construction**
- [ ] **Step 4: Run focused tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

## Chunk 4: Transcript Projection

### Task 5: Project stateful rounds into visible council messages

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Modify: `src/apps/chat/components/ChatMessageList.tsx`
- Modify: `src/apps/chat/components/message/ChatMessage.tsx`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing tests for proposal, ballot, and final-result projection**
- [ ] **Step 2: Implement transcript projection from state records**
- [ ] **Step 3: Ensure final user-facing output equals accepted proposal verbatim**
- [ ] **Step 4: Run focused tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

## Chunk 5: End-To-End Verification

### Task 6: Add full multi-round council integration coverage

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/apps/chat/editors/_handleExecute.runtime.test.ts`
- Modify: `src/apps/chat/editors/chat-execution.runtime.ts`
- Modify: `src/apps/chat/editors/chat-execution.runtime.default.ts`

- [ ] **Step 1: Write a failing integration-style test for proposal rejected then accepted on revision**
- [ ] **Step 2: Implement minimal glue or helpers needed to satisfy the test**
- [ ] **Step 2a: Introduce a broad execution runtime boundary so orchestration can run without real model calls**
- [ ] **Step 2b: Add no-model `_handleExecute` and `runCouncilSequence` integration coverage with scripted agent outputs**
- [ ] **Step 3: Run focused council tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts src/apps/chat/editors/_handleExecute.runtime.test.ts`
- [ ] **Step 4: Run typecheck**
  Run: `npx tsc -p tsconfig.json --noEmit --pretty false`
- [ ] **Step 5: Review diff for unintended changes**
