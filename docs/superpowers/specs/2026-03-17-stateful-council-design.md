# Stateful Atomic Council Mode Design

## Goal

Replace the current mixed transcript-driven / mutable workflow council loop with a stateful and atomic coordinator that can safely handle:

- pause
- stop
- resume
- unexpected tab close / app reload / process interruption

without reparsing visible transcript messages and without persisting partial agent work.

## Core Requirements

- One Leader proposes exactly one response per round.
- All non-leader agents review the current Leader proposal.
- Reviewers publish:
  - a public review plan
  - then exactly one vote: `accept` or `reject(reason)`
- Every committed proposal, plan, vote, and round transition is durable and atomic.
- No partial leader/reviewer turn survives as durable state.
- All visible Council UI is a projection of structured state, not the control path.
- Resume must rebuild the council exclusively from structured durable records.
- Already committed agent turns must never rerun after resume.
- Uncommitted agent turns must be treated as if they never happened.

## Atomicity Model

Council execution is atomic at the following boundaries:

- leader turn commit
- reviewer plan commit
- reviewer vote commit
- round completion
- terminal session transition
- control transitions: pause, resume, stop

The system never persists:

- partial streamed text as durable council state
- half-written proposal records
- half-written reviewer plans or votes
- inferred status from transcript text

The system may stream locally for UX, but durability only starts at commit time.

## Recommended Architecture

Use two layers:

### 1. Append-Only Durable Journal

Per conversation, persist an ordered Council operation log.

This is the source of truth.

### 2. Derived Projection

Materialize a `CouncilSessionProjection` by replaying the ordered operation log through a pure reducer.

This projection drives:

- scheduling
- resume decisions
- Council trace UI
- status chips
- final answer emission

If projection cache is stored, it is disposable and never authoritative.

## Durable Operation Log

### Envelope

```ts
type CouncilOp = {
  opId: string;
  phaseId: string;
  conversationId: string;
  sequence: number;
  createdAt: number;
  type: CouncilOpType;
  payload: unknown;
};
```

### Operation Types

```ts
type CouncilOpType =
  | 'session_started'
  | 'round_started'
  | 'leader_turn_committed'
  | 'reviewer_plan_committed'
  | 'reviewer_vote_committed'
  | 'round_completed'
  | 'session_paused'
  | 'session_resumed'
  | 'session_stopped'
  | 'session_accepted'
  | 'session_exhausted';
```

### Key Payloads

```ts
type RoundStartedPayload = {
  roundIndex: number;
  leaderParticipantId: string;
  reviewerParticipantIds: string[];
  sharedRejectionReasons: string[];
};

type LeaderTurnCommittedPayload = {
  roundIndex: number;
  participantId: string;
  proposalId: string;
  proposalText: string;
  deliberationText: string;
  messageFragments: DMessageFragment[];
};

type ReviewerPlanCommittedPayload = {
  roundIndex: number;
  participantId: string;
  planText: string;
  messageFragments: DMessageFragment[];
};

type ReviewerVoteCommittedPayload = {
  roundIndex: number;
  participantId: string;
  decision: 'accept' | 'reject';
  reason: string | null;
  messageFragments: DMessageFragment[];
};

type RoundCompletedPayload = {
  roundIndex: number;
  outcome: 'accepted' | 'revise';
  rejectionReasons: string[];
};

type SessionAcceptedPayload = {
  roundIndex: number;
  proposalId: string;
  finalResponse: string;
};
```

## State Machine

Per user turn:

`idle -> drafting -> reviewer-plans -> reviewer-votes -> accepted | exhausted | paused | stopped`

The reducer may derive a more compact status surface, but the execution scheduler must treat these boundaries as explicit phases, not transcript heuristics.

## Execution Model

Each agent step is two-phase:

### 1. Run

- execute Leader / reviewer work in memory
- buffer partial streamed output locally
- validate structured result

### 2. Commit

- append exactly one durable committed operation
- recompute projection
- then advance scheduling

Rule:

- committed = real
- not committed = never happened

## Scheduler Rules

The scheduler chooses the next runnable step from projection only.

### If current round lacks `leader_turn_committed`

- run Leader

### If Leader committed but reviewer plans are incomplete

- run remaining reviewer plans

### If reviewer plans are complete but votes are incomplete

- run remaining reviewer votes

### If votes are complete

- emit `round_completed`
- if all accept:
  - emit `session_accepted`
- else if max rounds reached:
  - emit `session_exhausted`
- else:
  - emit next `round_started`

### Never schedule work when session is

- `paused`
- `stopped`
- `accepted`
- `exhausted`

## Prompting Rules

### Leader

Inputs:

- original user request
- relevant conversation context
- all prior committed round history needed by the protocol
- shared rejection reasons from prior rounds
- prior public plans/votes/reasons as required by the updated Council workflow

Output contract:

- exactly one proposal for the current round

### Reviewer Plan

Inputs:

- original user request
- current Leader proposal
- prior committed public Council history

Output contract:

- exactly one public review plan

### Reviewer Vote

Inputs:

- original user request
- current Leader proposal
- current round public plans
- prior committed public Council history

Output contract:

- exactly one vote
- `accept`
- or `reject(reason)`

## Reducer Invariants

- operations are replayed in `sequence` order
- duplicate `opId` is ignored idempotently
- only one active round exists at a time
- one committed Leader turn per round
- at most one committed reviewer plan per reviewer per round
- at most one committed reviewer vote per reviewer per round
- `round_completed` only exists after required commits exist
- `session_accepted`, `session_exhausted`, and `session_stopped` are terminal
- final user-visible answer equals the accepted Leader proposal verbatim

If an invalid op order appears, the reducer should surface inconsistency instead of inventing missing state.

## Resume / Pause / Stop / Unexpected Close

### Pause

- abort active in-memory work
- append `session_paused`
- keep all committed work
- on resume, continue from last valid commit boundary

### Stop

- abort active in-memory work
- append `session_stopped`
- session becomes terminal for that turn

### Unexpected Close

- no special recovery write is required
- on reopen, rebuild projection from committed log
- uncommitted work is discarded and may rerun safely

### Resume

- allowed only from paused/interrupted resumable states
- append `session_resumed`
- recompute projection
- schedule only missing work
- never rerun already committed turns

## Transcript Projection

Council trace messages are purely projections from projection state.

The transcript may show:

- Leader proposal
- reviewer plans
- reviewer votes
- shared rejection reasons
- round status
- terminal session status

But these messages are never reparsed to recover orchestration state.

## Persisted Conversation Model

`DConversation.councilSession` remains the lightweight UI/runtime entry point, but durable orchestration state moves to an append-only journal.

Recommended additions:

- `councilOpLog?: CouncilOp[]`
- optional cached projection for convenience/debugging

`workflowState` may remain temporarily during migration, but must stop being the control source of truth.

## Migration Strategy

### Step 1

- introduce `councilOpLog`
- keep current `workflowState` as compatibility shadow
- write durable journal for new council sessions

### Step 2

- switch resume/recovery/scheduling to journal + reducer only
- keep transcript projection reading structured state

### Step 3

- remove transcript-driven and mutable legacy control logic
- retain projection-only Council UI

No attempt should be made to backfill perfect atomic history for old legacy sessions.

## Error Handling

- invalid leader proposal:
  - fail turn or synthesize a rejected round reason, but do not commit malformed proposal state
- invalid reviewer vote:
  - normalize to `reject('review failed')`
- timeout/failure before commit:
  - no durable turn written
- timeout/failure after commit:
  - durable record stands, no rerun
- reducer inconsistency:
  - surface diagnostic status, do not guess hidden state

## Testing Strategy

### Reducer Tests

- accepted session replay
- exhausted session replay
- paused session replay
- stopped session replay
- duplicate op replay
- invalid op ordering

### Atomic Commit Tests

- interrupt leader before commit
- interrupt leader after commit
- interrupt reviewer plan before commit
- interrupt reviewer vote after commit

### Scheduler Tests

- chooses Leader first
- waits for all plans before votes
- waits for all votes before round completion
- starts next round only after completion op
- does not run when paused/stopped/accepted/exhausted

### Integration Tests

- rejection causes a new round
- shared rejection reasons carry forward
- resume after pause continues from last committed boundary
- unexpected reload discards uncommitted work
- final answer equals accepted proposal verbatim

### UI Projection Tests

- Council trace derives from projection only
- no partial turn appears as durable visible state
- resumed sessions show correct phase/round/status

## Acceptance Criteria

- no control path depends on parsing visible transcript
- every durable Council transition is atomic
- already committed turns never rerun after resume
- uncommitted turns never appear as durable state
- pause/stop/reload recovery rebuilds from journal only
- final assistant output equals accepted Leader proposal verbatim

## Non-Goals

- transcript parsing as orchestration recovery
- partial durable streaming state for council turns
- reviewer-authored competing final answers
- heuristic reconstruction of legacy sessions into perfect atomic history
