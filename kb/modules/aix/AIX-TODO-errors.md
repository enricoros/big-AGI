# AIX TODO: errors

This document contains inputs, requirements, roadmap items `[ ] -> [x]` for the AIX upgrade to typed errors.
As with `AIX-TODO-next.md` this is partially defined by the author, and largely added to by AI, so please let's validate the architecture and choices before we implement them, we do not want accumulation of hallucinations.

## Why
Errors in AIX come from many sources (flow from vendor > dispatch (in stages and with retriers) > relay > connection > client, and more) and should end in one place: error fragments in the reassembled `DMessageFragment[]`. Today they also end as exceptions thrown to the `_orThrow` callers, in the stop reason and the outcome, and in rewritten placeholders.

AIX grew by catching exceptions at each of those depths with custom code, tricks (e.g. throwing to pop the stack to a parent which will loop us again on retry, etc) and passing them on as text-like:
on the wire an issue is a phase id and a composed string (the end and retry particles carry error text and causes of their own), in the stored message an error is a string and an optional hint - a very bad presentation.

Furthermore the CSF (client-side fetch) vs relayed (tRPC) pipeline complicates things, the usage of shared utilities (`trpc.router.fetchers.ts`, `trpc.fetchers.retrier.ts`) complicates things, with different exceptions and causes, or even wrapping and unwrapping of exceptions and composition of text too - lots of custom code.

What the error is gets lost at the catch site, so every later decision is derived again from the text, by classification and heuristics, several times and not always the same way:
- what to do about it: fail the message, keep the partial answer, keep reading the stream, or even retry and more
- what it invalidates: the attempt, the message, the turn, an agentic loop, and whether another attempt could correct it (nothing says this today)
- how to retry it: whether, by which layer (connect, server operation, client), on which schedule, when to give up (decided from the HTTP status, the vendor code, at times the message wording)
- how to present it: wording, color, log level, where it shows (the UI tells a client drop from a server cut by finding `**network error**` in the stored text)
- how to replay it: whether, and in which form (as `[ERROR] ...` text today, which the model reads as its own output)
- what its side effects are: the outcome of the message, Beam status, usage and cost still owed, the counts of a cut run
- what the user can do next: continue, retry, switch model, fix a key or a setting (implied by the wording today)
- whether a layer can fix it by itself (today only hot fixes before the request, nothing after an error)

Typed errors: the site that catches an error says what it is, once. The type travels in the particle and is stored in the fragment, and each decision above reads it.

## AIX Diagram
```TODO...
...
```

== what precedes was written by the author, what follows is added by AI ==

## Inbox

Inputs for the requirements: from the author, from reading the code, from captures and production logs, from other sessions. Diverse, not prioritized, not of equal weight, nothing decided; a `PROPOSED` section is one session's proposal. Validate before use.
To come: the author's inventory of error sites and what to do about each, and the diagrams.

### From the author

On what is stored, facts or decisions (2026-11-10):
> Facts, but also some decisions, for instance what would be policy nbame that governs the retry or reconnect, etc. bascially facts such as what is invalidated by an error, is it somehting that has cailed the generation and won't be able to be corected ,and would also fail. the loop if agentic.. and this is for instnace becauise there are so manu errors, that having all of them mapped everywhere could be a lot, so let's do facts, but also if important some hints. because otherweise I believe there will be too many places to check and for each 40 error kinds.. hoserver we can later patch/rederive things. figure out a suystem that allows this

On the stored shape (2026-11-10):
> We may have a new part type or extend with aixIssue however I'd prefer to legacy abandon in the future the curent part (i.e. no more generaiton for it), and maybe adopt pt: 'aix.issue' and extended attributes there. and there definintely need ot be wiretypes/fragments/particles alighment to make those fly. Note that after this definition I'll come in with a big table I already have of all the places of errors and what to do aobut them, etc.

On what else an error must answer (2026-11-10):
> Whether to replay to the AI and with which policy for the replay. also if there' a way to auto-fix it, maybe things that relate to the various layers. I do expect the presentation tobe all in ChatMessage and few other places, and there need to be functions that for instance derive the message outcome from the fragments[] and the end decision, or stuff like that (static policy-like derviations and data modification as well, sometimes (immutable in, immutable out))

On the blocked image (2026-11-06), the TODO left at the site:
> send this as a dialect issue, of subkind image-gen-error, subCause: string, aiRender: true, uiColor: 'neutral', ... as we'll have a large refactor of errors coming soon, with all aix errors being typed out neatly, and then travelling in particles, etc.

### Sites waiting for typed errors

- OpenAI: a failed or blocked image generation leaves a non-terminating dialect issue with composed text - `_forwardFailedImageGenerationCallItem` (subkind `image-gen-error`, aiRender true, uiColor neutral)
- OpenAI (#1288): an `error` after answer text is dropped when the stream ends before its terminal event (only the end-of-stream sentence shows). Not fixed on `main`: it waits for the shape under "Stream mechanics" (subkind `upstream-error`, non-terminal); the replay test carries the case as `notYet`
- Gemini (#1287): an error sent inside the stream ends the message with its status, code and text; `details` is not carried, the log level is always a warning, a bare-string error is surfaced as its message
- Stop errors stored twice (filter stops, refusals): the replacement code is commented under a `TODO` in `ContentReassembler` (`dialectStopExplained`)
- Gemini `TOO_MANY_TOOL_CALLS`: belongs to the truncated class with its own wording and Continue - see [AIX-outcome.md](../AIX-outcome.md), "Open: tool-budget stops"
- OpenAI `context_length_exceeded` in the middle of a hosted tool loop: the text should say the hosted tools filled the context; the terminal event carries the finished tool items and no message

### Retry

- Gemini: in-stream `503 UNAVAILABLE` is real (seen as `error` events after HTTP 200) and is shown, not retried; retry only while nothing has streamed
- A last attempt that goes through and then fails for another reason still reads "Gave up after N attempts": the reassembler cannot tell it from the same error returning
- Anthropic: a zero fast mode rate limit is matched by message text in the fetch retrier, not by a typed cause
- OpenAI Responses retries a transient `response.failed` even after answer text has streamed: the shown text is cleared and the run restarts. Chat Completions stops retrying once output has streamed. #1211 and #1287 ask that long partial work is not restarted; #1211 was reopened for a "Retry transient errors within [N] minutes" option, which is on neither TODO list

### Replay

- Assistant error fragments are replayed as `[ERROR] ...` model text, so the model reads them as its own output (Q1 in [AIX-ingestion.md](../AIX-ingestion.md))

### Stream mechanics: issue, end, outcome (PROPOSED)

From the #1288 work. The first two lines are measured, the direction is Enrico's, the rest is a proposal to validate against the inventory of error sites.

- Measured: `setDialectTerminatingIssue` bundles three things: it reports the fact, fails the message, and stops the read. A dialect end stops the read too. The executor parses nothing after either, and logs a dropped event only when it shares the network chunk. Every loss under "Dropped after the verdict" comes from the stopped read
- Measured: OpenAI's `error` after answer text is not final. The `.done` events never stream before it; only `response.failed` says whether the message completed (16 of 16 live rate-limit cases were complete answers, the #1149 salvage)
- Direction (Enrico): an error and how the stream ended are two facts. An error says whether it is terminal (receiving it fails the message), the end travels apart, zero to many issues per generation, the error state is derived from them. A terminal error is sent right away; termination follows
- Three separate things: (1) issue particles, sent when they happen, never stopping the read; (2) one end particle: how the read ended (the vendor's last event, `[DONE]`, closed, read failure, abort, grace timeout) and the vendor's stop reason; (3) the outcome, derived by one static function from the stored issues and the end, never sent
- An issue states its bearing on the outcome: terminal (fails the message whatever follows), or not. A non-terminal error stands unless the vendor's final status clears it; a non-terminal note never fails (blocked image, an issue after a clean stop)
- Outcome, in order: user stop -> aborted; a terminal issue -> failed; a stop reason -> its class, and non-terminal issues remain as notes; no stop reason -> failed if the read did not end on the vendor's last event or an error-level issue exists, else completed with the "no finish reason" notice
- Stop reasons carry the vendor's own final status only: `cg-issue` narrows to "the vendor says failed". "An issue happened" is no longer a stop reason, and `tokenStopError` goes: a stop's explanation is an issue
- Reading: the read ends on the vendor's last event, `[DONE]`, the close, a read failure, an abort, or a grace timer started by a terminal issue and cleared by the end (a host that errors and never closes cannot hang; agreed in principle). A parser ends the dialect only on the vendor's true last event
- One failure, one issue: OpenAI's `error` event has the fuller fields (type, code, param, headers). The `response.failed` after it contributes the final status, the item list and the counts, and adds an issue only when no `error` came first
- #1288 in this shape: the `error` after text is sent on arrival as a non-terminal error, so it also survives our own function or the browser link being cut. Final status ok -> completed, the error stays as a note (P21); failed -> failed; no final status -> failed, the error and the end shown apart
- Open: an old client stores any issue as an error fragment, so it reads a salvaged answer with a non-terminal issue as failed. Sending them needs a client that knows them
- Open: where the end is stored. Today an early close is an error fragment (the end-of-stream sentence), replayed to the model
- Not for this: a parser end-of-stream hook. The transmitter already carries the stop reason and metrics to the end particle on every exit; a hook serves only parser-private buffers (Chat Completions audio) or a retry at the close, neither observed
- Interim, unmerged: two #1288 versions that hold the error on the server until the end (one as a provisional stop reason, one as a held issue reported if no stop reason arrives). Both are replaced by the above; nothing structural ships before it

### Dropped after the verdict

- OpenRouter Chat Completions: ends at the in-band `{error}` chunk; the finish chunk and the billed usage chunk that follow are dropped (5 in 7 days of production logs, one carrying usage)
- OpenAI Responses: an `error` before any text ends the message there; `response.failed` follows (10 of 10 live) with `tool_usage` and the item list, never `usage`
- OpenAI Responses: the search count sits behind the usage gate in `_fromResponseMetrics`, so a failed or wrapped-failed response (`usage` null, `tool_usage` present) reports none. Moving it shows a search-only cost on a message with no tokens
- Gemini 2.x: an intermediate `STOP` ends the turn and the answer after it is dropped; pinned by an `open:` case in `chatGenerate.replay.test.ts`
- Bedrock: exception frames inside a stream name the failure in `:exception-type`, which the event-stream transform drops. Converse skips the event and ends on the generic end-of-stream text, Invoke fails on the payload shape as a parsing issue; neither retries. Read from the code, not reproduced live

### Text and labels

- Responses: the label is the `type`, else the `code`, so the code is lost when a type exists (`tokens: Rate limit reached` loses `rate_limit_exceeded`); `response.failed` labels the same failure by its code, which can be OpenAI's placeholder `unknown`. #1288 asks to keep type, code, message and param
- Responses (#1288): the ticket also asks for the response and event ids with the error, and that a final failure less specific than the earlier `error` (placeholder code `unknown` against type `invalid_request_error`, same message) does not replace it
- Responses: a salvaged `failed` response drops its error text (P21 in [AIX-ingestion.md](../AIX-ingestion.md)); as a non-terminal error it can stay as a note
- OpenAI: rate-limit `error` events carry `error.headers` (`retry-after-ms`); the in-band retry does not read them

### Not signalled by the vendor

- [xAI, 2026-11-09, hypothesis: one capture] a reply that reaches the context window ends `response.completed`, cut mid-sentence, total tokens 6 under the window. Stored as completed; detectable only by comparing total tokens with the window
- OpenAI: a wrapped-failed response (rate limit after a complete answer) carries no `usage`, so it is stored completed with no tokens and no cost
- Chat Completions: finish reasons we do not map read as "not provided"; Gemini Interactions `cancelled` shows an error with no text. Read from the code, not reproduced live
