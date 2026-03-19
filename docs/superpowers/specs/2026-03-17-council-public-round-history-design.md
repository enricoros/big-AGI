# Council Public Round History Design

**Date:** 2026-03-17

## Goal

Change Council mode so every round is a structured shared workflow:
- the leader writes a proposal
- each reviewer writes exactly one plan
- reviewer plans become shared with all agents after the planning barrier
- reviewers then vote in parallel using explicit tools only
- if votes are not unanimous, the next round reads the entire prior council history

All council artifacts remain inside the collapsed Council trace UI rather than appearing as standalone transcript rows.

## Protocol

Each round executes in this order:

1. Shared history read
   - every agent receives the normal chat history plus all prior council artifacts

2. Leader proposal
   - the leader writes the proposal for the round

3. Reviewer planning
   - reviewers each write one plan in parallel
   - reviewers cannot see same-round reviewer plans while planning

4. Plan sharing barrier
   - once all reviewer plans complete, those plans become shared with all agents

5. Reviewer voting
   - reviewers vote in parallel on the leader proposal
   - same-round votes remain hidden until all votes are collected
   - reviewers must use tools only:
     - `Accept()`
     - `Reject(reason)`

6. Round close
   - votes become shared only after the voting barrier closes
   - unanimous reviewer acceptance finalizes the leader proposal verbatim
   - any rejection starts the next round

## Visibility

- Council artifacts are public to all council agents between rounds.
- Council artifacts are visible to the user only inside the Council trace card, which remains collapsed by default.
- The normal transcript outside the Council trace shows only the final accepted assistant answer.
- Reviewer plans, reviewer votes, and intermediate leader proposals do not appear as standalone chat rows.

## Data Model

Council round state must explicitly track phases and per-artifact records.

### Round phases

- `leader-proposal`
- `reviewer-plans`
- `reviewer-votes`
- `completed`

### Round records

Each round stores:
- `leaderProposal`
- `reviewerPlans[]`
- `reviewerVotes[]`
- `phase`
- `completedAt`

### Reviewer plan record

- `reviewerParticipantId`
- `planText`
- `messageFragments`
- `messagePendingIncomplete`
- `createdAt`

### Reviewer vote record

- `reviewerParticipantId`
- `decision`
- `reason`
- `messageFragments`
- `messagePendingIncomplete`
- `createdAt`

## History construction

The next round history must include:
- the normal chat history before council started
- all prior leader proposals
- all prior reviewer plans
- all prior reviewer votes and rejection reasons

Current-round sharing rules:
- reviewer plans are not visible until all reviewer plans for the round are present
- reviewer votes are not visible until all reviewer votes for the round are present

## UI

The Council trace renders each round in this order:
- leader proposal
- reviewer plans
- reviewer votes
- shared rejection reasons / round outcome

Collapsed summary should include:
- current round number
- current phase
- reviewer plan progress
- reviewer vote progress
- accepted/rejected state when complete

## Testing

Required coverage:
- state transitions across the new round phases
- barrier semantics for reviewer plans and votes
- reviewer ballot tool enforcement
- next-round history includes prior proposal/plan/vote artifacts
- council trace renders proposal, plans, and votes as separate sections
