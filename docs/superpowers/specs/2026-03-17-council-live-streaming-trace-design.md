# Council Live Streaming Trace Design

## Goal

Revamp Council mode so the user can watch each agent work live, not just inspect the final round summary:
- show whatever each agent explicitly outputs during its turn
- stream the Leader live while it is forming the proposal
- start all reviewers concurrently only after the Leader proposal is finalized
- stream reviewer output live in parallel
- preserve a mandatory terminal verdict for each reviewer: `Accept` or `Reject` plus reason
- keep the final user-facing answer as the accepted Leader proposal only

## User-Approved Constraints

- The trace shows whatever the agent outputs.
- Reviewers may emit richer freeform output before their final verdict.
- Reviewers must eventually produce `Accept` or `Reject` plus reason.
- Reviewer turns run concurrently.
- Reviewers wait for the Leader proposal to complete before starting.
- The Leader card is centered in its own row above the reviewer row.
- Reviewer cards appear in a separate row below the Leader.
- Card widths should stay capped to a readable ChatGPT-like maximum width instead of stretching indefinitely.
- Each card must support an expanded detail view in addition to the live board view.

## Output Visibility Rules

The trace shows:
- streamed text emitted by the agent
- tool invocations
- tool results
- explicit reasoning-like text if the agent outputs it as normal content
- final proposal or verdict blocks

The trace does not invent or reconstruct hidden private reasoning.

If a provider/model does not expose a given internal reasoning artifact as normal output, the UI does not synthesize it.

## Revised Council Protocol

### Leader Turn

- The Leader receives the user request and any shared rejection reasons from prior rounds.
- The Leader may emit richer freeform output during the turn.
- The Leader turn must terminate with a finalized proposal.
- The finalized proposal becomes the proposal under review for that round.

### Reviewer Turns

- Reviewers do not start until the Leader proposal is complete.
- All reviewers then start concurrently.
- Reviewers may emit richer freeform output during their turns.
- Each reviewer turn must terminate with one verdict:
  - `Accept`
  - `Reject` plus reason

### Round Advancement

- If all reviewers accept, the accepted Leader proposal is emitted as the final user-facing response.
- If one or more reviewers reject, the ordered rejection reasons are shared with the next Leader turn.
- Reviewers remain incommunicado from each other aside from seeing the carried-forward rejection reasons from previous rounds.

## Recommended Wire Contract

Keep explicit terminal markers while allowing richer prior output.

### Leader Terminal Marker

- `[[proposal]] <final proposal text>`

Everything before that marker is streamed as visible agent output.

### Reviewer Terminal Markers

- `[[accept]]`
- `[[reject]] <reason>`

Everything before the marker is streamed as visible agent output.

This preserves deterministic orchestration while allowing the visible turn transcript to be richer.

## Trace Placement

- Render one `Council trace` transcript item for the active Council phase.
- For accepted phases, place it immediately before the final assistant response.
- For drafting, reviewing, interrupted, or exhausted phases without a final assistant response, place it after the latest Council artifact for that phase.
- Do not duplicate the final accepted response inside the trace.

## Trace Structure

### Collapsed Trace

The collapsed card shows:
- `Council trace`
- round count
- reviewer count
- current/terminal status
- short latest-round summary

### Expanded Trace

The expanded trace shows round panels in newest-first order:
- latest round expanded by default
- older rounds collapsed by default

Each round panel contains:
- a centered Leader row
- a reviewer row underneath
- a shared rejection reasons block beneath the board when applicable

## Round Layout

### Leader Row

- one centered Leader card
- readable max width similar to ChatGPT response width
- live streamed turn content in compact form
- proposal state visible once finalized
- expandable detail view for the full turn transcript

### Reviewer Row

- reviewer cards in a single row below the Leader
- all reviewer cards stream independently and concurrently
- each reviewer card uses a capped readable width
- if the row overflows, it scrolls horizontally rather than compressing cards too tightly
- each reviewer card supports expandable details

### Shared Rejection Reasons

Below the rows, render a block for ordered rejection reasons:
- `Shared with next round` when another round exists
- `Queued for next round` when interruption happens before the next Leader proposal
- `Final rejection reasons` when the council exhausts

## Agent Card Design

Every agent card has two layers.

### Live Board Layer

Visible by default:
- agent name
- live status
- streamed text excerpt
- compact tool activity blocks
- terminal proposal/verdict badge once complete

### Detail Layer

Opened on demand:
- full turn transcript for that agent in that round
- all streamed text chunks in order
- tool calls and tool outputs
- terminal proposal/verdict block

The detail view is per-agent, not a global debug dump.

## Status Model

Top-level trace statuses:
- `Accepted`
- `Reviewing`
- `Awaiting leader revision`
- `Interrupted`
- `Exhausted`

Per-agent statuses:
- `Streaming`
- `Waiting`
- `Running tools`
- `Accepted`
- `Rejected`
- `Proposal ready`
- `Interrupted`
- `Failed`

## State Model Additions

The current stateful council round records are not enough for live replay. The workflow state must grow to store per-agent turn transcripts.

### CouncilAgentTurnRecord

- `participantId`
- `roundIndex`
- `role`: `leader | reviewer`
- `status`
- `startedAt`
- `completedAt | null`
- `terminalAction`: `proposal | accept | reject | null`
- `terminalText`
- `terminalReason | null`
- `events`

### CouncilAgentTurnEvent

- `type`: `text-delta | text-snapshot | tool-call | tool-result | status | terminal`
- `createdAt`
- event payload

### CouncilRoundRecord Extensions

- `leaderTurn`
- `reviewerTurns`
- existing proposal / ballot / shared-rejection fields remain as orchestration summaries derived from terminal events

This keeps orchestration deterministic while giving the UI a structured live/replay log.

## Runtime Execution Model

### Leader Phase

- create or resume a round
- stream Leader events into that round’s Leader turn record
- finalize proposal from the Leader terminal marker

### Reviewer Phase

- after proposal finalization, launch all reviewers concurrently
- stream each reviewer’s events into its own reviewer turn record
- on completion, parse terminal verdict marker
- once all reviewers finish, compute accept/reject outcome

### Resume

- resume only within the matching active Council phase and user turn
- do not leak stale interrupted council state into a newer user turn
- replay saved turn events into the UI trace

## Error Handling

- If the Leader never produces a terminal proposal marker, mark the Leader turn failed and do not start reviewers.
- If a reviewer never produces a terminal verdict marker, treat it as rejection with a synthetic reason, but still preserve the visible streamed output.
- If a tool call fails, show the failure in the card/detail transcript and let the turn continue unless orchestration aborts it.
- If a round is interrupted, preserve all turn events recorded so far.
- If the session exhausts, preserve final rejection reasons and all visible turn transcripts.

## Testing Strategy

### Protocol Tests

- Leader may emit freeform output before terminal proposal
- reviewers may emit freeform output before terminal verdict
- reviewer terminal verdict is still mandatory
- reviewer turns do not start before Leader proposal completion
- reviewer turns run concurrently after proposal completion

### State Tests

- turn event records accumulate in order
- terminal summaries derive correctly from turn records
- interruption preserves partial turn transcripts
- stale resumable session does not continue after a newer user turn

### UI Derivation Tests

- trace placement still works for accepted and non-accepted phases
- round view models include Leader row plus reviewer row
- agent detail payloads preserve full visible turn transcript
- shared rejection reason labels remain correct

### UI Rendering Tests

- collapsed trace remains compact
- expanded round centers the Leader above the reviewer row
- reviewer row remains horizontally scrollable when crowded
- live card shows streamed content and terminal badge
- detail view shows full turn transcript including tool blocks

## Non-Goals

- exposing hidden/private chain-of-thought that the agent/provider did not output
- letting reviewers start before the Leader proposal is complete
- allowing reviewer turns to omit a final verdict
- duplicating the final accepted answer inside the trace
