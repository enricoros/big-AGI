# AIX - Outcome

One classification of how a generation ended, derived once from the stored message and read everywhere else. Policy from #1217: successful = all minus errored minus out of tokens. Truncation is an error typed apart, not a success.

## Values

`DMessageTerminalOutcome` in `src/common/stores/chat/chat.message.outcome.ts`. `DMessageOutcome` adds `pending`.

| Value | Meaning | Joy color | Boolean success |
|---|---|---|---|
| `completed` | the model stopped cleanly | none | true |
| `truncated` | out of tokens; the partial output is kept, not usable as-is | `warning` | false |
| `failed` | stop reason `issue` or `filter`; without a known stop reason, a trailing `aix.issue` that failed the generation, or a trailing error part | `danger` | false |
| `aborted` | stopped by the user | `neutral` | false |

`AixChatGenerateTerminal_LL` (the LL result) is an alias of the terminal type. `aixOutcomeIsSuccess()` is the Boolean projection.

## Derivation

`messageTerminalOutcome(message)`: stored stop reason first (`out-of-tokens`, `issue` and `filter`, `client-abort`). Fallback, with no stop reason or one this build does not know (a newer build or peer): the last content fragment decides, skipping `aix.issue` parts that did not fail the generation (`aixIssueFails`: effect `failed`): an issue that failed or an `error` part means failed, anything else completed. Content after a failed issue reads completed: a message joined from several generations (Beam "Use all", a call transcript) has no stop reason, while one generation an issue failed stores `issue`. Void fragments do not weigh in. No `switch` (SWC); `tools/develop/swc-minify-check` holds the cases. `messageOutcome()` returns `pending` while `pendingIncomplete`.

The reassembler keeps the stored stop reason and the records in agreement: when the message holds an issue that failed, it stores `issue` (`filter` stays). The executor's stop reason does not see a failure the client recorded, and a Stop after a failure therefore reads `failed`.

The stored fact is `DMessageGenerator.tokenStopReason`, four values. The outcome is never stored.

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

The tables are private to `chat.message.outcome.ts`; `messageOutcomePolicy()`, `messageOutcomeColor()` and `messageOutcomeLabel()` are their only readers. Each checks its argument at runtime: outcomes are derived in memory and never stored, so a value outside the union comes from a miscompile or a bug. It reads as `pending` (no color, no label, no automation) with one console warning, never as `failed`. A cast to an outcome type is a lint error (`tools/eslint/outcome-types.mjs`).

## Homes

- Wire: `AixWire_Particles.gcStopReasonRow()` in `aix.wiretypes.ts` reads the private stop-reason table, one row per stop reason with three columns: `class` (edge analytics: `ok` | `truncated` | `error`), `stored` (the stop reason the client persists), `message` (the sentence of a filter stop's `model-filter` record when the parser has no words for it). A reason this build does not know returns undefined. The wire op `cg: 'end'` carries facts only (`terminationReason`, `tokenStopReason`); every explanation precedes it as an `aix-issue`.
- Reassembler: `_storedStopReason()` decides the stored stop reason, then `finalizeReassembly()` reads the outcome back with `messageTerminalOutcome`. `completed` and `truncated` are both vendor-ended: upstream handle cleared, metrics finalized the same way.
- Presentation: `messageOutcomeColor()` and `messageOutcomeLabel()`. `messageBackground()` takes the palette key. Beam cards color all three non-success outcomes (`aborted` neutral, #1070). Chat bubbles tint truncation only: errors render inline, a stop in chat is usually deliberate.
- Beam: `BeamStatus` in `beam.status.ts` is `'idle' | 'running' | AixChatGenerateTerminal_LL`, shared by `BRay.status` and `BFusion.stage`. `beamStatusColor()` colors the cards. A message imported into Beam keeps its outcome. Not persisted.

## Stop reasons by dialect

| Dialect | Wire reason | Class |
|---|---|---|
| Anthropic | `max_tokens`, `model_context_window_exceeded` | truncated |
| Bedrock Converse | `max_tokens` | truncated |
| OpenAI Chat | `length` | truncated |
| OpenAI Responses | `incomplete`, reason `max_output_tokens` | truncated |
| Gemini | `MAX_TOKENS`, `CONTINUATION` | truncated (ends with `issue-dialect`, the others with `done-dialect`) |
| Gemini | `TOO_MANY_TOOL_CALLS` | error today; see Open: tool-budget stops |
| Gemini Interactions | `incomplete`, `budget_exceeded` | truncated; `budget_exceeded` adds a `service-error` notice (`causeCode` `budget_exceeded`) |
| all | `refusal`, `content_filter`, `SAFETY`, `RECITATION`, ... | error |

## Open: tool-budget stops (PROPOSED)

Gemini ends a hosted-tools run that exhausts the per-request step budget (Google Search and URL context share it) with `TOO_MANY_TOOL_CALLS` and a `finishMessage` that gives the counts and tells the user to split the task (#1286). The parser maps it to `cg-issue`: the message is `failed`, the explanation is a `service-error` record that fails (`causeCode` `TOO_MANY_TOOL_CALLS`, the finishMessage as text), replayed to the model as `[ERROR]` when the turn has other content, chat offers no Continue, Beam paints the ray red. Nothing retries it, which is right: a retry repeats the same cut at the same cost.

Proposed treatment, on the issue record (the policy has no vendor rows yet):

- class `truncated`, with its own stop reason: `out-of-tokens` would show the wrong words, so the wording at the three "Out of tokens" sites (outcome label, the message's own line in `ChatMessage`, Continue block) becomes stop-reason aware
- retryable: no; the recovery is Continue, since a new request gets a fresh budget
- user text: the vendor `finishMessage`, as a display-only notice, not content
- AI text: none
- check the other dialects for the same stop: OpenAI Responses maps only `max_output_tokens` and `content_filter`, other `incomplete_details.reason` values fall to a generic incomplete text

Deferred because the truncated class has one wire reason and one hardcoded wording.

## Clean end without a finish reason

Completeness unknown, assumed complete: outcome `completed` plus a `model-unfinished` record (effect `notice`), stated by the transmitter at the end and stored as an `aix.issue` part. It does not fail, is not replayed and is not in the message text. Gateways omitting `finish_reason` land here, and so does a non-streaming body parsed in full with no stop reason. `no-stop-reason` void notices stored before the records keep rendering. An end reason or a particle this build does not know (a newer server) is a warn void notice, not a record.

## Issue after the stop reason

Parsers set the stop reason after the content. An issue that would fail, arriving after a clean or truncated stop reason (a read error, a trailing chunk that fails to parse, a late error event) or after an issue that already failed, is stamped effect `notice` by the transmitter ([aix/AIX-TODO-errors.md](aix/AIX-TODO-errors.md)): stored as an `aix.issue` part, shown as a chip, not replayed; the outcome keeps the stop reason. A clean close after the stop reason is how the dialect ends: no record. Under `cg-issue` the issue is its explanation and fails. The client applies the same rule to its own relay failures: after the verdict (the wire end applied, or an issue that failed), `ContentReassembler.setClientExcepted` only logs (e.g. the stream dropping before tRPC's closing chunk) and the client does not retry.

## Dev

- Remove dialog: Clear All, or Filter with two toggles (Errored: keep or remove, Out of tokens: keep or remove) and then the length rule (keep or remove N longest or shortest by dimension) over what remains. No "successful" wording (#1217). Items carry one `outcome`, the ray or fusion status.
- "Start all" merges: idle, failed and aborted start; running, completed and truncated are skipped (`messageOutcomePolicy().rerun`).
- Notifications: a truncated reply notifies as "Response truncated", with the error chime. Per-ray chimes fire on `completed` only.
- Analytics: `aix_stop_class`, the row's `class`.

## Not done

- `aixChatGenerateText_Simple` returns truncated text as if complete (options noted at the end of the function).
- A multi-step merge continues past a truncated intermediate step.
- Merge inputs are every settled ray with non-error content, truncated included.
- Issues with effect `failed` or `lost` are replayed to the model as `[ERROR]` text when the turn has other content (`aixIssueReplayText`); a turn of errors alone is not sent.
