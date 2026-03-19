# Council Parallel Bootstrap And Shared Context Implementation Plan

## Goal

Implement round-1 parallel reviewer bootstrap plus round-2 shared prior-round context in Council mode.

## Steps

- add failing runtime tests for:
  - round-1 Leader and reviewer bootstrap concurrency
  - delayed reviewer voting until Leader proposal is finalized
  - round-2 shared prior-round context for all agents
- extend workflow state to store reviewer bootstrap turns
- add reviewer bootstrap prompt/history preparation
- run reviewer bootstrap turns in parallel with the Leader
- after the Leader proposal finalizes, run reviewer vote turns using each reviewer bootstrap draft plus the Leader proposal
- include prior completed round messages from all agents in round-2+ histories
- update trace derivation/UI tests so reviewer transcripts include bootstrap plus vote
- verify focused tests and full type-check
