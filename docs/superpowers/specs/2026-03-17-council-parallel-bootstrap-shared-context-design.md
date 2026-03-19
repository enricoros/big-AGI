# Council Parallel Bootstrap And Shared Context Design

## Goal

Refine Council mode so reviewers start useful work immediately and later rounds become more context-aware:

- in round 1, the Leader and all reviewers process the user request concurrently
- each reviewer first produces an initial private draft about the user request
- once the Leader finishes the round proposal, each reviewer reads that proposal after finishing its own initial draft and then emits `[[accept]]` or `[[reject]] <reason>`
- from round 2 onward, every agent sees all prior agent messages from prior rounds as shared context
- the visible council trace continues to show the full workflow

## Round 1 Protocol

### Phase A: Parallel bootstrap

- Leader receives the original user request and prior rejection reasons, if any
- each reviewer receives the original user request and prior rejection reasons, if any
- Leader and reviewers run concurrently
- the Leader must terminate with `[[proposal]] <final proposal>`
- each reviewer produces an initial draft turn; this is not yet a vote

### Phase B: Reviewer vote

- after the Leader proposal is finalized, each reviewer receives:
  - the original user request
  - prior rejection reasons
  - its own initial draft
  - the finalized Leader proposal
- each reviewer may output freeform review text
- each reviewer must terminate with:
  - `[[accept]]`
  - or `[[reject]] <reason>`

## Round 2+ Context Rules

- all agents receive the complete visible transcript from prior completed rounds
- this includes:
  - Leader proposals
  - reviewer initial drafts
  - reviewer final votes
  - rejection reasons
- agents do not receive partial live output from other agents in the current active round

## State Model

Each round keeps:

- `leaderTurn`
- `reviewerTurns`
- `reviewerBootstrapTurns`

The reviewer bootstrap turn stores the initial reviewer draft. The final reviewer turn stores the review/vote pass. Both are replayable in the UI.

## UI Expectations

- reviewer cards show the complete reviewer workflow in order
- that includes the reviewer initial draft followed by the later review/vote transcript
- round 2+ traces continue to be derived from stored workflow state without reconstructing hidden reasoning

## Testing

- round 1 starts Leader and reviewer bootstrap turns concurrently
- reviewer vote does not start before the Leader proposal is finalized
- round 2 Leader sees prior reviewer and Leader messages in context
- round 2 reviewers see prior round messages from all agents in context
- trace view model preserves bootstrap plus vote transcript order
