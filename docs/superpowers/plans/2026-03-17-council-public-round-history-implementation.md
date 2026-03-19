# Council Public Round History Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace private reviewer bootstrap plus plain-text ballots with phased council rounds that store shared reviewer plans and tool-only reviewer votes.

**Architecture:** Extend the council state machine with explicit round phases and separate records for leader proposals, reviewer plans, and reviewer votes. Update the council executor to run plan and vote barriers explicitly, then render those structured artifacts inside the Council trace card while keeping the main transcript clean.

**Tech Stack:** TypeScript, React, Node test runner, existing council state helpers, AIX function-call tools

---

## Chunk 1: Council State And Execution

### Task 1: Add failing round-phase and tool-ballot tests

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.runtime.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.runCouncilSequence.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write failing execution/state tests**

- Add tests for:
  - reviewer ballot turns expose `Accept` and `Reject` tools
  - reviewer ballot replies are parsed from tool invocations
  - round state accepts explicit ballot payloads

- [ ] **Step 2: Run tests to verify they fail**

Run:
`node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
`node --import tsx --test src/apps/chat/editors/_handleExecute.runCouncilSequence.test.ts`
`node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 3: Implement minimal state/execution changes**

- Modify council state helpers to accept explicit ballot payloads
- Add council reviewer tool definitions and tool parsing
- Pass tool-enforced reviewer ballots through the execution runner

- [ ] **Step 4: Run tests to verify they pass**

Run the same commands from Step 2.

## Chunk 2: Shared Reviewer Plans And Barriered History

### Task 2: Model reviewer plans and round phases

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`

- [ ] **Step 1: Write failing tests for reviewer plan storage and barriers**

- Add tests for:
  - reviewer plans are stored separately from votes
  - next-round history includes prior proposal, plans, and votes
  - same-round plans are not visible until all reviewer plans complete
  - same-round votes are not visible until all reviewer votes complete

- [ ] **Step 2: Run tests to verify they fail**

Run:
`node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
`node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`

- [ ] **Step 3: Implement minimal phaseful round state and barriered execution**

- Add explicit round phases
- Add reviewer plan records
- Build phase-specific shared-history helpers
- Refactor council execution into:
  - leader proposal
  - parallel reviewer plans
  - plan-sharing barrier
  - parallel reviewer votes
  - vote reveal

- [ ] **Step 4: Run tests to verify they pass**

Run the same commands from Step 2.

## Chunk 3: Council Trace Rendering

### Task 3: Render proposal, reviewer plans, and reviewer votes separately

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.tsx`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.test.tsx`

- [ ] **Step 1: Write failing trace/render tests**

- Add tests for:
  - proposal, plans, and votes render as separate round sections
  - collapsed trace summary reflects current round phase
  - reviewer plan/vote counts render correctly for partial rounds

- [ ] **Step 2: Run tests to verify they fail**

Run:
`node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
`node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.test.tsx`

- [ ] **Step 3: Implement minimal trace derivation and rendering updates**

- Derive separate view models for leader proposal, reviewer plans, and reviewer votes
- Render them inside the Council trace only
- Preserve the final accepted answer behavior outside the trace

- [ ] **Step 4: Run tests to verify they pass**

Run the same commands from Step 2.

## Chunk 4: Documentation And Final Verification

### Task 4: Update docs and verify the end-to-end behavior

**Files:**
- Modify: `docs/changelog.md`

- [ ] **Step 1: Update changelog**

- Add a concise note about phased council rounds, shared reviewer plans, and tool-only reviewer votes

- [ ] **Step 2: Run final verification**

Run:
`node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
`node --import tsx --test src/apps/chat/editors/_handleExecute.runCouncilSequence.test.ts`
`node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
`node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
`node --require ./tools/tests/mock-test-imports.cjs --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.test.tsx`

- [ ] **Step 3: Review touched files for consistency**

- Confirm council artifacts remain inside the Council trace and reviewer ballot tools are reviewer-only
