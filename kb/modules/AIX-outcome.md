# AIX - Outcome

One classification of how a generation ended, derived once from the stored message and read everywhere else. Policy from #1217: successful = all minus errored minus out of tokens. Truncation is an error typed apart, not a success.

## Values

`DMessageTerminalOutcome` in `src/common/stores/chat/chat.message.outcome.ts`. `DMessageOutcome` adds `pending`.

| Value | Meaning | Joy color | Boolean success |
|---|---|---|---|
| `completed` | the model stopped cleanly | none | true |
| `truncated` | out of tokens; the partial output is kept, not usable as-is | `warning` | false |
| `failed` | stop reason `issue` or `filter`, or a trailing error fragment on a message without a stop reason | `danger` | false |
| `aborted` | stopped by the user | `neutral` | false |

`AixChatGenerateTerminal_LL` (the LL result) is an alias of the terminal type. `aixOutcomeIsSuccess()` is the Boolean projection.

## Derivation

`messageTerminalOutcome(message)`: stored stop reason first (`out-of-tokens`, `issue` and `filter`, `client-abort`), then, with no stop reason, the last content fragment decides (`error` part means failed). Void fragments do not weigh in. A stop reason this build does not know (a newer build or peer) is no evidence: the fragments decide, as with none. `messageOutcome()` returns `pending` while `pendingIncomplete`.

The stored fact is `DMessageGenerator.tokenStopReason`, four values, unchanged. The outcome is never stored.

Production builds minify with SWC, which can miscompile some switch shapes (`tools/eslint/swc-miscompile.mjs` bans the known ones); unminified checks (`next dev`, tsc, tests) cannot see that, so a behavior the source cannot produce is checked against the deployed chunk.

## Policy

`messageOutcomePolicy(outcome)`, one row per outcome, read by automation instead of re-decided per site:

| Outcome | rerun | cost | usable |
|---|---|---|---|
| `completed` | no | none | yes |
| `truncated` | no | repeat: a re-run hits the same cap, same cut, same bill | no |
| `failed` | yes | new | no |
| `aborted` | yes | new | no |

`rerun` drives Beam's "Start all" on dev (a truncated merge is skipped like a finished one, Retry per card stays). `usable` means the output stands as a complete answer. Merge inputs still follow the content rule (settled rays with non-error content), as stated in #1216.

## Access

The tables are private to `chat.message.outcome.ts`; `messageOutcomePolicy()`, `messageOutcomeColor()` and `messageOutcomeLabel()` are their only readers. Each checks its argument at runtime: outcomes are derived in memory and never stored, so a value outside the union comes from a miscompile or a bug. It reads as `pending` (no color, no label, no automation) with one console warning, never as `failed`.

## Homes

- Wire: `AixWire_Particles.gcStopReasonRow()` in `aix.wiretypes.ts` reads the private stop-reason table, one row per stop reason with three columns: `class` (edge analytics: `ok` | `truncated` | `error`), `stored` (the stop reason the client persists), `message` (error fragment text on a cut). A reason this build does not know returns undefined. The wire op `cg: 'end'` is unchanged.
- Reassembler: `_storedTermination()` decides what the message carries, then `finalizeReassembly()` reads the outcome back with `messageTerminalOutcome`. `completed` and `truncated` are both vendor-ended: upstream handle cleared, metrics finalized the same way.
- Presentation: `messageOutcomeColor()` and `messageOutcomeLabel()`. `messageBackground()` takes the palette key. Beam cards color all three non-success outcomes (`aborted` neutral, #1070). Chat bubbles tint truncation only: errors render inline, a stop in chat is usually deliberate.
- Beam: `BeamStatus` in `beam.status.ts` is `'idle' | 'running' | AixChatGenerateTerminal_LL`, shared by `BRay.status` and `BFusion.stage`. `beamStatusColor()` colors the cards. Not persisted.

## Stop reasons by dialect

| Dialect | Wire reason | Class |
|---|---|---|
| Anthropic | `max_tokens`, `model_context_window_exceeded` | truncated |
| Bedrock Converse | `max_tokens` | truncated |
| OpenAI Chat | `length` | truncated |
| OpenAI Responses | `incomplete`, reason `max_output_tokens` | truncated |
| Gemini | `MAX_TOKENS` | truncated (ends with `issue-dialect`, the others with `done-dialect`) |
| Gemini Interactions | `incomplete`, `budget_exceeded` | truncated, with an inline body note |
| all | `refusal`, `content_filter`, `SAFETY`, `RECITATION`, ... | error |

## Clean end without a finish reason

Completeness unknown, assumed complete: outcome `completed` plus a void notice (`pType: 'notice'`, `pNoticeKind: 'no-stop-reason'`, `pNoticeLevel: 'warn'`). Not an error fragment: error fragments are content and are replayed to the model as `[ERROR]` text. Gateways omitting `finish_reason` land here. An end reason or a particle this build does not know (a newer server) gets the same treatment: a warn notice, not an error fragment.

## Issue after the stop reason

Parsers set the stop reason after the content. After a clean or truncated stop reason, the transmitter sends a later issue (stream cut before the end marker, a trailing chunk that fails to parse, a late error event) as a warn notice (`pNoticeKind: 'late-issue'`), so the outcome keeps the stop reason. After an error stop reason, the issue is its explanation and stays an error fragment.

## Dev

- Remove dialog: Clear All, or Filter with two toggles (Errored: keep or remove, Out of tokens: keep or remove) and then the length rule (keep or remove N longest or shortest by dimension) over what remains. No "successful" wording (#1217). Items carry one `outcome`, the ray or fusion status.
- "Start all" merges: idle, failed and aborted start; running, completed and truncated are skipped (`messageOutcomePolicy().rerun`).
- Notifications: a truncated reply notifies as "Response truncated", with the error chime. Per-ray chimes fire on `completed` only.
- Analytics: `aix_stop_class`, the row's `class`.

## Not done

- `aixChatGenerateText_Simple` returns truncated text as if complete (options noted at the end of the function).
- A multi-step merge continues past a truncated intermediate step.
- Merge inputs are every settled ray with non-error content, truncated included.
- Assistant error parts are replayed to the model.
