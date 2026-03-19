# Council Protocol Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace implicit leader-only council inference with an explicit proposal/accept/revise protocol so council mode can terminate deterministically.

**Architecture:** Parse protocol markers from visible assistant text into structured council metadata, then make the council pass evaluator operate on those structured actions instead of role heuristics. Keep transcript rendering text-first and preserve backward compatibility for the legacy deliberation prefix.

**Tech Stack:** TypeScript, Node test runner, existing chat council editor pipeline

---

## Chunk 1: Parser And Metadata

### Task 1: Add failing parser tests

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Test: `src/apps/chat/editors/_handleExecute.council.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
- [ ] **Step 3: Write minimal parser implementation**
- [ ] **Step 4: Run test to verify it passes**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`

### Task 2: Extend metadata for explicit protocol states

**Files:**
- Modify: `src/common/stores/chat/chat.message.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Add types for explicit council actions**
- [ ] **Step 2: Keep backward-compatible handling for legacy deliberation prefix**
- [ ] **Step 3: Re-run parser tests**

## Chunk 2: Council Completion

### Task 3: Add failing completion tests

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Write failing tests for proposal plus matching accepts**
- [ ] **Step 2: Write failing tests for revise and mismatched accepts**
- [ ] **Step 3: Run focused test file and confirm failures**

### Task 4: Implement pass evaluation and prompt updates

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Route parsed actions into deliberation metadata**
- [ ] **Step 2: Make pass completion require leader proposal plus matching accepts**
- [ ] **Step 3: Update council instructions so agents emit protocol markers**
- [ ] **Step 4: Run focused test file and confirm green**

## Chunk 3: Verification

### Task 5: Run targeted verification and review

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`
- Modify: `src/common/stores/chat/chat.message.ts`

- [ ] **Step 1: Run focused council tests**
  Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
- [ ] **Step 2: Run a lightweight TypeScript or lint check for touched files if needed**
- [ ] **Step 3: Review diff for unintended changes**
- [ ] **Step 4: Summarize residual risks**
