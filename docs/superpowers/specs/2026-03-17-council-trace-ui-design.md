# Council Trace UI Design

## Goal

Expose the full stateful Council workflow in the chat transcript without duplicating the final adopted response:
- show the entire council run before the final assistant response
- keep the workflow collapsed by default
- let users inspect each round independently
- preserve verbatim reviewer rejection reasons
- make proposal and reviewer positions easy to compare inside each round

## Requirements

- Render one dedicated `Council trace` transcript item immediately before the final assistant response for a Council phase.
- The trace summarizes the entire workflow, not only the latest round.
- The top-level trace is collapsed by default.
- Each round is individually collapsible.
- The latest round is expanded by default on first render.
- Older rounds are collapsed by default on first render.
- The final adopted response is not duplicated inside the trace.
- Rejection reasons are shown verbatim.
- Shared rejection reasons are shown as the exact reasons carried into the next Leader draft.
- Within an expanded round, all agents are displayed side-by-side on desktop/tablet and stacked on mobile.

## Recommended Approach

Use a dedicated transcript artifact backed by structured Council workflow state.

The new trace should render from `councilSession.workflowState.rounds` instead of rebuilding the workflow from visible transcript messages on every render. The transcript remains responsible for normal chat messages, especially the final assistant answer, while the trace card acts as an audit view over the Council protocol.

This replaces the current generic deliberation toggle for Council runs with a richer inspection surface that is aligned with the stateful Leader-and-reviewers workflow.

## Information Architecture

### Transcript Placement

- Insert `Council trace` as a standalone transcript item immediately before the final assistant response of the accepted Council phase.
- Keep the final assistant response in the normal chat bubble flow.
- Do not render a duplicated `final adopted response` section inside the trace.

### Collapsed Trace Card

When collapsed, the trace shows:
- title: `Council trace`
- status chips:
  - total rounds
  - reviewer count
  - terminal status
- one short workflow summary line, such as:
  - `Round 3 accepted unanimously`
  - `Round 2 rejected by 2 reviewers`

The collapsed card should read as a compact audit artifact, not as another assistant message.

### Expanded Trace Card

When expanded, the trace shows a vertical stack of round panels:
- newest round first
- latest round expanded by default
- prior rounds collapsed by default

Each round panel contains:
- a round header with round number and outcome summary
- a side-by-side agent board for that round
- a shared rejection reasons block below the board when the round produced any rejections

## Round Layout

Each expanded round renders as a responsive grid.

### Grid Composition

- first column: `Leader proposal`
- remaining columns: one card per reviewer

### Leader Proposal Card

The Leader column contains:
- agent name
- `Leader proposal` label
- full proposal text for that round

This should read like the working draft under review.

### Reviewer Cards

Each reviewer card contains:
- reviewer name
- decision badge:
  - `Accept`
  - `Reject`
- for rejected ballots, the verbatim rejection reason displayed inline inside that reviewer card

Accepted ballots stay compact. Rejected ballots expand vertically to make the reason easy to read.

### Shared Rejection Reasons Block

If a round contains one or more rejections, render a full-width block below the grid:
- label: `Shared with next round`
- ordered list of the exact rejection reasons carried forward to the next Leader prompt

This block makes the stateful feedback loop explicit instead of leaving users to infer it from reviewer cards alone.

## Interaction Model

- Top-level `Council trace` card is collapsed by default.
- Expanding the trace reveals all rounds.
- The newest round starts expanded.
- Older rounds start collapsed.
- Users can expand or collapse any round independently.
- Initial auto-collapse applies only to default state; user toggles are then respected.

## Visual Direction

The trace should look distinct from ordinary chat bubbles:
- flatter panel treatment
- quiet background
- thin border
- compact status chips
- clear chevron-based disclosure controls

Round panels should emphasize comparison rather than chronology:
- proposal and reviewer cards aligned in one row when space allows
- explicit verdict badges
- rejection reasons styled as quoted or callout content inside the rejecting reviewer card
- shared rejection reasons rendered as a separate, labeled callout below the row

The existing pass-based column layout for raw deliberation messages should not be reused for the trace. It was designed for freeform deliberation, while the new protocol is a structured round review.

## Responsive Behavior

### Desktop And Tablet

- render side-by-side grid columns for the Leader plus reviewers
- size columns evenly within each round, with the Leader column allowed slightly more width if needed

### Mobile

- collapse each round grid to a single-column stack
- preserve visual order:
  - Leader proposal first
  - reviewer cards second
  - shared rejection reasons last

## Data Flow

Primary source:
- `conversationOverlayStore.councilSession.workflowState`

Primary fields:
- `status`
- `roundIndex`
- `reviewerParticipantIds`
- `rounds`
- `rounds[].proposalText`
- `rounds[].ballots`
- `rounds[].sharedRejectionReasons`

Supporting transcript data remains useful for:
- phase/result placement in the transcript
- fallback rendering if workflow state is absent or partial

The UI should prefer structured workflow state whenever available and only fall back to transcript inference when strictly necessary.

## Error Handling

- If workflow state is absent, keep the final assistant response unchanged and hide the trace rather than rendering misleading partial structure.
- If a round exists without a proposal yet, render the round header and any available reviewer state conservatively.
- If reviewer identity data is missing, fall back to participant ids.
- If workflow state is partial during interruption or resume, show only the rounds that can be rendered faithfully.

## Testing Strategy

### Rendering Tests

- trace item renders before the final assistant response
- collapsed trace summarizes the entire workflow
- expanded trace renders newest round first
- newest round is expanded by default
- older rounds are collapsed by default
- expanded rounds render Leader plus reviewer cards side-by-side in structure
- shared rejection reasons block appears only for rounds with rejections
- no duplicate final-response panel appears inside the trace

### Content Tests

- proposal text comes from the round proposal
- reviewer accept and reject states render correctly
- rejection reasons are shown verbatim
- shared rejection reasons render in order

### Fallback Tests

- trace is omitted when workflow state is unavailable
- final assistant response still renders normally without the trace

## Non-Goals

- repeating the final adopted response inside the trace
- preserving the old global `Show deliberation` button for Council runs
- rendering reviewer-to-reviewer discussion, since the protocol is incommunicado
