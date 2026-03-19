# Council Live Streaming Trace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Council mode from static round summaries to a live streaming trace with a centered Leader row, concurrent reviewer row, expandable per-agent detail transcripts, and deterministic terminal proposal/verdict parsing.

**Architecture:** Expand the stateful council workflow to record per-agent turn events while preserving explicit terminal proposal/verdict markers for orchestration. Then derive a richer trace view model from those turn records and render it as a live two-row board in the transcript, with reviewer concurrency handled in the runtime after the Leader proposal finalizes.

**Tech Stack:** React, TypeScript, Joy UI, Zustand overlay state, `node:test`, `tsx`

---

## File Structure

- Modify: `src/apps/chat/editors/_handleExecute.council.ts`
  Responsibility: extend council workflow types to support agent turn records and streamed event storage.
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
  Responsibility: protocol/state tests for richer freeform output plus terminal markers.
- Modify: `src/apps/chat/editors/_handleExecute.ts`
  Responsibility: stream Leader and reviewer turn events, run reviewers concurrently after proposal finalization, and retain completed workflow state for trace replay.
- Modify: `src/apps/chat/editors/_handleExecute.runtime.test.ts`
  Responsibility: no-model integration coverage for concurrent reviewers, stale-resume protection, and retained completed workflow state.
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.ts`
  Responsibility: derive the richer board/detail view model from structured council turn records.
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
  Responsibility: view-model tests for Leader row, reviewer row, detail payloads, and status/placement rules.
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.tsx`
  Responsibility: render the live two-tier board and expandable per-agent details.
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.layout.ts`
  Responsibility: Leader centering, reviewer-row overflow, and readable width caps.
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
  Responsibility: layout tests for centered Leader row and reviewer-row overflow behavior.
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
  Responsibility: rendering tests for live board and expanded detail content.
- Modify: `src/apps/chat/components/ChatMessageList.tsx`
  Responsibility: feed the richer trace model into the transcript while keeping final answer placement unchanged.
- Modify: `docs/changelog.md`
  Responsibility: record the live streaming council trace behavior.

## Chunk 1: Protocol And State Model

### Task 1: Add failing protocol/state tests for richer freeform council output

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.council.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.council.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- Leader freeform text plus terminal `[[proposal]]`
- reviewer freeform text plus terminal `[[accept]]`
- reviewer freeform text plus terminal `[[reject]] reason`
- missing terminal reviewer verdict becomes synthetic rejection
- turn event records preserve output order

- [ ] **Step 2: Run the focused test file to verify it fails**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: FAIL with missing types/helpers and failing assertions.

- [ ] **Step 3: Implement minimal workflow-state additions**

Add:
- `CouncilAgentTurnRecord`
- `CouncilAgentTurnEvent`
- terminal parsing helpers that preserve pre-terminal freeform output
- round record extensions for Leader/reviewer turn records

- [ ] **Step 4: Re-run the focused protocol/state tests**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.council.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.council.ts src/apps/chat/editors/_handleExecute.council.test.ts
git commit -m "feat: extend council workflow state for live turn traces"
```

## Chunk 2: Runtime Streaming And Reviewer Concurrency

### Task 2: Add failing no-model integration tests for concurrent reviewers and completed-state retention

**Files:**
- Modify: `src/apps/chat/editors/_handleExecute.runtime.test.ts`
- Modify: `src/apps/chat/editors/_handleExecute.ts`

- [ ] **Step 1: Write failing integration tests**

Cover:
- reviewers do not start until the Leader proposal finishes
- reviewers execute concurrently after proposal finalization
- completed council overlay state retains workflow data for trace replay
- stale interrupted council state does not resume across a newer user turn

- [ ] **Step 2: Run the runtime integration tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Expected: FAIL on ordering/concurrency/state assertions.

- [ ] **Step 3: Implement runtime changes**

In `_handleExecute.ts`:
- stream agent events into per-turn records
- keep explicit terminal proposal/verdict parsing
- launch reviewers with `Promise.all` or equivalent concurrency once the Leader finishes
- preserve completed workflow state in overlay session for accepted traces
- validate resumable council state against the active user turn/phase

- [ ] **Step 4: Re-run runtime integration tests**

Run: `node --import tsx --test src/apps/chat/editors/_handleExecute.runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/editors/_handleExecute.ts src/apps/chat/editors/_handleExecute.runtime.test.ts
git commit -m "feat: stream council turns and run reviewers concurrently"
```

## Chunk 3: Trace Derivation

### Task 3: Add failing derivation tests for live board/detail view models

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
- Modify: `src/apps/chat/components/ChatMessageList.councilTrace.ts`

- [ ] **Step 1: Write failing derivation tests**

Cover:
- round view model splits into centered Leader row and reviewer row
- agent cards expose compact live transcript content
- detail payload contains full ordered turn transcript events
- reviewer ordering still follows `reviewerParticipantIds`
- legacy deliberation toggle stays hidden when structured trace exists

- [ ] **Step 2: Run the derivation tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: FAIL on missing richer view-model fields.

- [ ] **Step 3: Implement minimal derivation changes**

Add:
- Leader-row card model
- reviewer-row card models
- detail transcript payloads
- compact latest-output summaries for collapsed board cards

- [ ] **Step 4: Re-run derivation tests**

Run: `node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/ChatMessageList.councilTrace.ts src/apps/chat/components/ChatMessageList.councilTrace.test.ts
git commit -m "feat: derive live council trace board models"
```

## Chunk 4: Live Trace UI

### Task 4: Add failing layout/render tests for the two-row live board

**Files:**
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.layout.ts`
- Modify: `src/apps/chat/components/message/CouncilTraceMessage.tsx`

- [ ] **Step 1: Write failing layout/render tests**

Cover:
- Leader card centers in its own row
- reviewer row scrolls horizontally when crowded
- live card shows streamed content excerpts and terminal badges
- expanded details show full transcript with tool calls/results and final proposal/verdict
- readable max-width cap is applied to Leader and reviewer cards

- [ ] **Step 2: Run the focused layout/render tests to verify they fail**

Run: `node --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
Expected: FAIL on missing layout helpers and missing detail rendering.

- [ ] **Step 3: Implement the live board UI**

In `CouncilTraceMessage.tsx`:
- render Leader row first
- render reviewer row second
- show compact live transcripts in cards
- add per-agent detail disclosure
- render tool activity blocks from structured events

In `CouncilTraceMessage.layout.ts`:
- add Leader centering helpers
- add reviewer row overflow helpers
- add readable max-width helpers

- [ ] **Step 4: Re-run focused layout/render tests**

Run: `node --import tsx --test src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts src/apps/chat/components/message/CouncilTraceMessage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/chat/components/message/CouncilTraceMessage.tsx src/apps/chat/components/message/CouncilTraceMessage.test.tsx src/apps/chat/components/message/CouncilTraceMessage.layout.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts
git commit -m "feat: render live council trace board"
```

## Chunk 5: Transcript Integration And Docs

### Task 5: Integrate the live trace into the transcript and update docs

**Files:**
- Modify: `src/apps/chat/components/ChatMessageList.tsx`
- Modify: `docs/changelog.md`

- [ ] **Step 1: Add any failing transcript integration assertions needed**

Cover:
- live trace still renders before accepted final response
- non-accepted phases still render the trace after the active phase
- normal final answer bubble remains unchanged

- [ ] **Step 2: Implement transcript wiring**

Use the richer trace view model in `ChatMessageList.tsx` without duplicating the final accepted answer.

- [ ] **Step 3: Update changelog**

Add a high-level entry describing live streaming council traces, concurrent reviewer execution, and per-agent details.

- [ ] **Step 4: Commit**

```bash
git add src/apps/chat/components/ChatMessageList.tsx docs/changelog.md
git commit -m "feat: integrate live council trace into transcript"
```

## Chunk 6: Final Verification

### Task 6: Run final verification

**Files:**
- Verify: council workflow, runtime, derivation, and UI files above

- [ ] **Step 1: Run focused council/UI tests**

Run:
`node --import tsx --test src/apps/chat/components/ChatMessageList.councilTrace.test.ts src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts src/apps/chat/components/message/CouncilTraceMessage.test.tsx src/apps/chat/editors/_handleExecute.council.test.ts src/apps/chat/editors/_handleExecute.runtime.test.ts`

Expected: PASS

- [ ] **Step 2: Run full type-check**

Run: `npx tsc -p tsconfig.json --noEmit --pretty false`
Expected: PASS

- [ ] **Step 3: Manual UI smoke test**

Verify:
- Leader streams alone in a centered top row
- reviewers begin only after proposal finalization
- reviewer cards stream concurrently
- agent details show full output and tool activity
- final accepted response still appears only as the normal assistant answer

- [ ] **Step 4: Final commit if verification fixes were needed**

```bash
git add <changed files>
git commit -m "fix: finish live council trace verification"
```
