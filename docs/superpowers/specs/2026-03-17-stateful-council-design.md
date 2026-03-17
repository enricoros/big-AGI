# Stateful Council Mode Design

## Goal

Replace the current transcript-driven council loop with a stateful review workflow:
- one Leader proposes a response
- all other agents independently review that proposal
- each reviewer returns only `accept` or `reject(reason)`
- all rejection reasons are shared with every agent in the next round
- the accepted Leader proposal is emitted verbatim to the user

## Requirements

- Agents are incommunicado during review rounds.
- The Leader is the only agent allowed to author proposals.
- Reviewers never submit alternative drafts.
- Every agent receives:
  - the original user request
  - the latest Leader proposal, when one exists
  - all rejection reasons accumulated from prior rounds
- Council mode repeats until unanimous reviewer acceptance, interruption, or exhaustion.
- The final user-facing answer is exactly the accepted Leader proposal text.

## Recommended Approach

Use a stateful coordinator instead of transcript parsing.

The coordinator becomes the source of truth for:
- current round
- current phase
- latest proposal
- reviewer ballots
- rejection reasons
- interruption and resume state
- accepted or exhausted terminal outcomes

Visible transcript messages become projections of state, not control inputs.

## State Machine

Per user turn, Council mode runs as:

`idle -> drafting -> reviewing -> accepted | exhausted | interrupted`

### Drafting

- The coordinator creates a new round record.
- The Leader receives the user request, persona/system instructions, and all rejection reasons from previous rounds.
- The Leader returns exactly one proposal record with verbatim response text.

### Reviewing

- Each reviewer receives the user request, the current Leader proposal, and all shared rejection reasons.
- Reviewers do not see each other’s current-round ballots.
- Each reviewer returns exactly one ballot:
  - `accept`
  - `reject(reason)`

### Accepted

- If every reviewer accepts, the proposal is marked accepted.
- The accepted proposal text is appended as the final assistant response shown to the user.

### Exhausted

- If max rounds is reached without unanimous acceptance, the session stops.
- The transcript can show the last proposal and rejection reasons for debugging, but no final user-facing answer is emitted from Council mode.

### Interrupted

- Pause, stop, and unload recovery preserve the current round state and replay from structured records on resume.

## Data Model

### CouncilSessionState

- `status`: `idle | drafting | reviewing | accepted | exhausted | interrupted`
- `phaseId`
- `roundIndex`
- `maxRounds`
- `leaderParticipantId`
- `acceptedProposalId | null`
- `finalResponse | null`
- `interruptionReason | null`

### CouncilRoundRecord

- `roundIndex`
- `proposalId`
- `proposalText`
- `leaderParticipantId`
- `ballots`
- `sharedRejectionReasons`
- `startedAt`
- `completedAt | null`

### CouncilBallot

- `reviewerParticipantId`
- `decision`: `accept | reject`
- `reason`: string, required when rejected

### Shared Rejection Reasons

For each new round, the Leader and reviewers receive the aggregated ordered list of all rejection reasons collected so far in the session.

## Prompting Rules

### Leader Prompt

Inputs:
- original user request
- active persona/system instructions
- all prior rejection reasons

Output contract:
- exactly one proposal
- no reviewer ballots
- no direct final-user emission outside coordinator control

### Reviewer Prompt

Inputs:
- original user request
- current Leader proposal
- all shared rejection reasons from prior rounds

Output contract:
- exactly one ballot
- `accept`
- or `reject(reason)`
- no rewritten answer drafts

## Transcript Projection

The UI should still be able to show a readable Council trace, but projection is derived from state.

Projected messages can include:
- Leader proposal per round
- reviewer accepts/rejects
- aggregated rejection reasons between rounds
- final accepted proposal
- exhaustion or interruption notices

These messages are view/state projections only and must not be reparsed to recover orchestration state.

## Execution Outline

1. User sends a message in Council mode.
2. Coordinator starts a new session and round 1.
3. Leader drafts proposal 1.
4. Reviewers independently review proposal 1.
5. If all accept:
   - finalize with proposal 1 verbatim.
6. If any reject:
   - aggregate rejection reasons
   - start round 2
   - ask Leader for a revised proposal using those reasons
7. Repeat until accepted, exhausted, or interrupted.

## Error Handling

- Invalid or missing Leader proposal:
  - fail the round visibly or retry once, but do not advance to review without a structured proposal
- Invalid reviewer ballot:
  - record a synthetic rejection reason such as `review failed`
- Reviewer timeout/failure:
  - treat as rejection with a synthetic reason
- Resume after interruption:
  - restore from structured session and round records
- Exhaustion:
  - mark terminal exhausted state and surface diagnostic transcript only

## Testing Strategy

### Unit Tests

- state transitions across drafting, reviewing, accepted, exhausted, interrupted
- unanimous reviewer acceptance
- single rejection triggering a new round
- multi-round accumulation of rejection reasons
- reviewer isolation rules
- resume from partially completed review rounds

### Prompt Builder Tests

- Leader sees only allowed inputs
- reviewers see proposal plus shared reasons
- reviewers do not receive other reviewers’ current-round ballots

### Projection Tests

- projected transcript reflects state without controlling execution
- final user-facing message equals accepted proposal verbatim

### Integration Test

- round 1 proposal rejected by at least one reviewer
- rejection reasons aggregated and shared
- round 2 proposal accepted unanimously
- final assistant output equals round 2 proposal verbatim

## Migration Notes

- Existing transcript-inferred consensus parsing should be retired from the control path.
- Existing Council session persistence should migrate to structured round records.
- Resume logic should hydrate from structured council state, not message text.

## Non-Goals

- reviewer-authored alternative answer drafts
- reviewer-to-reviewer communication
- manual merge of multiple competing answer drafts
- partial-final outputs before unanimous reviewer acceptance
