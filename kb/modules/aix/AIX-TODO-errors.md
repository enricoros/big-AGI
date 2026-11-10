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

On stream mechanics: where an issue is typed, and queuing it apart from stopping (2026-11-10, dictated, lightly cleaned):
> At the source point we're going to know if something is dialect terminating or not, or we can hint it. And if not, at least we can say where it was born, for instance in the vendor, and maybe hint it or not, because if we don't do it where it's born, then downstream is even more diluted. So it should be something that we do by default, to pick whether the disposition is to terminate or not. However, there's disposition and there's outcome. It's very important that we don't just say "set dialect terminating issue": we have two commands. One is to queue up the issue, which is going to be the aix.issue particle. The other one is to stop the parsing, stop and close. Depending on the implementation, some of them we may not want to stop and close, because we may want to have the issue, and then if there's data after the issue, let's keep it coming. We don't necessarily have to decide to close just because we got an issue: maybe the disposition is not to close, the disposition is to continue the parsing. Normally we enqueue one more particle and so be it. Deciding to close on our end is maybe too abrupt just because we have an issue. At the end of one agentic step, one low-level AIX call, we'll apply policies to these fragments and to the issue fragments. Keep in mind, some of the policies need to be known to the retriers, so we can say whether to retry something or not, and those are in the dispatch as well. So we would need to pass the policies to the dispatch if the policies are not on the client; some of them are on the dispatch. And those are sending particles as well, sending and clearing particles.

On the blocked image (2026-11-06), the TODO left at the site:
> send this as a dialect issue, of subkind image-gen-error, subCause: string, aiRender: true, uiColor: 'neutral', ... as we'll have a large refactor of errors coming soon, with all aix errors being typed out neatly, and then travelling in particles, etc.

### Sites waiting for typed errors

- OpenAI: a failed or blocked image generation leaves a non-terminating dialect issue with composed text - `_forwardFailedImageGenerationCallItem` (subkind `image-gen-error`, aiRender true, uiColor neutral)
- OpenAI (#1288): an `error` after answer text is kept when the stream ends before its terminal event, by a stopgap marked `STOPGAP #1288 - REVERT` at its three sites (Responses parser, transmitter, reassembler): the error is parked in the stop reason and the client guesses it back. To redo as a non-terminal issue (subkind `upstream-error`), see "Stream mechanics"
- Gemini (#1287): an error sent inside the stream ends the message with its status, code and text; `details` is not carried, the log level is always a warning, a bare-string error is surfaced as its message
- Stop errors stored twice (filter stops, refusals): the replacement code is commented under a `TODO` in `ContentReassembler` (`dialectStopExplained`)
- Gemini `TOO_MANY_TOOL_CALLS`: belongs to the truncated class with its own wording and Continue - see [AIX-outcome.md](../AIX-outcome.md), "Open: tool-budget stops"
- OpenAI `context_length_exceeded` in the middle of a hosted tool loop: the text should say the hosted tools filled the context; the terminal event carries the finished tool items and no message

### Retry

- Gemini: in-stream `503 UNAVAILABLE` is real (seen as `error` events after HTTP 200) and is shown, not retried; retry only while nothing has streamed
- A last attempt that goes through and then fails for another reason still reads "Gave up after N attempts": the reassembler cannot tell it from the same error returning
- Anthropic: a zero fast mode rate limit is matched by message text in the fetch retrier, not by a typed cause

### Retry after partial output (#1211, #1287)

Left for the rework by Enrico's ruling; nothing changes before it.

- Today, OpenAI Responses: a transient failure (rate limit, server error, overloaded) reported by `response.failed` is retried even after answer text has streamed. The retry clears the text already shown and the run starts again. An `error` before any text retries the same way
- Today, Chat Completions: no retry once any output has streamed; the error is shown and the partial answer kept. The two dialects disagree
- Asked in #1287: "Fixing diagnosis should not automatically restart a long, partially completed request"
- Asked in [#1211](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536775910): torn on an automatic restart "if it took half an hour to receive an error"; restart only on clear cases, like the flex tier being unavailable or a dropped connection with a completely empty response. Enrico [agreed](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536859013) and [reopened](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6565761327) #1211 for a configurable "Retry transient errors within [N] minutes"
- Shape for later: retry is a named policy read from the typed issue (transient or not, HTTP-equivalent status, the vendor's retry-after), not a decision inside a parser. Inputs the policy needs: whether anything streamed, how long the attempt ran, how much it produced
- Open: one rule for every dialect (nothing streamed yet), the time-bounded option from #1211, or both

### Replay

- Assistant error fragments are replayed as `[ERROR] ...` model text, so the model reads them as its own output (Q1 in [AIX-ingestion.md](../AIX-ingestion.md))

### Stream mechanics: issue, end, outcome (PROPOSED)

From the #1288 work. The first two lines are measured, the direction is the author's (see "From the author"), the rest is a proposal to validate against the inventory of error sites.

- Measured: `setDialectTerminatingIssue` bundles three things: it reports the fact, fails the message, and stops the read. A dialect end stops the read too. The executor parses nothing after either, and logs a dropped event only when it shares the network chunk. Every loss under "Dropped after the verdict" comes from the stopped read
- Measured: OpenAI's `error` after answer text is not final. The `.done` events never stream before it; only `response.failed` says whether the message completed (16 of 16 live rate-limit cases were complete answers, the #1149 salvage)
- Direction: an issue is typed where it is born, because every step downstream knows less. The source always gives the origin (the vendor, a dispatch stage, the client) and the facts, and by default sets the two hints below. Zero to many issues per generation; the end travels apart; the error state is derived
- Two commands replace `setDialectTerminatingIssue`: queue the issue (the `aix.issue` particle), and stop-and-close. Queuing never stops the read: data after an issue keeps coming and is parsed as usual
- Two hints, two words. The outcome hint: does the issue fail the message (yes; yes unless the vendor's final status clears it; no, it is a note: a blocked image, an issue after a clean stop). The read disposition: continue, the default, or stop and close. "Terminating" carried both until now
- Stop-and-close is the exception. In every vendor error captured the stream ended by itself after the issue: OpenAI sends `response.failed`, OpenRouter a finish chunk and the usage, Gemini and Anthropic close. Who stops: a parser on the vendor's true last event, or when it cannot go on; the executor on a read failure, an abort, or the grace timer below; the retrier when its policy says to retry now
- One end particle: how the read ended (the vendor's last event, `[DONE]`, closed, read failure, abort, grace timeout) and the vendor's stop reason
- Policies run at the end of one step (one low-level AIX call) over the fragments and the issue fragments. The first is the outcome, by one static function, never sent. In order: user stop -> aborted; an issue that fails the message -> failed; a stop reason -> its class, and the issues it clears remain as notes; no stop reason -> failed if the read did not end on the vendor's last event or an uncleared error exists, else completed with the "no finish reason" notice
- Retry is the policy that cannot wait for the end of the step, and it runs where the retry loop is: in the dispatch (the server on tRPC, the browser on CSF). Today a parser decides it, by asking `hasRetriesForHttpStatus` and throwing. Proposed: the parser only queues the issue, the retrier reads it and decides, and a retry is its own stop-and-close. The static part is a table in shared code keyed by the issue (`upstreamRetryProfile` is its seed), so both sides read the same one; what the user sets ("within N minutes", #1211) travels in the request
- Stop reasons carry the vendor's own final status only: `cg-issue` narrows to "the vendor says failed". "An issue happened" is no longer a stop reason, and `tokenStopError` goes: a stop's explanation is an issue
- Grace timer: started by an issue that fails the message, cleared by the end, so a host that errors and never closes cannot hang (agreed in principle; in the executor read loop)
- One failure, one issue: OpenAI's `error` event has the fuller fields (type, code, param, headers). The `response.failed` after it contributes the final status, the item list and the counts, and adds an issue only when no `error` came first
- #1288 in this shape: the `error` after text is queued on arrival with the hint "fails unless the final status clears it" and the read continues, so it also survives our own function or the browser link being cut. Final status ok -> completed, the error stays as a note (P21); failed -> failed; no final status -> failed, the error and the end shown apart
- Open: an old client stores any issue as an error fragment, so it reads a salvaged answer that carries a cleared issue as failed. Sending issues that do not fail the message needs a client that knows them
- Open: where the end is stored. Today an early close is an error fragment (the end-of-stream sentence), replayed to the model
- Not for this: a parser end-of-stream hook. The transmitter already carries the stop reason and metrics to the end particle on every exit; a hook serves only parser-private buffers (Chat Completions audio) or a retry at the close, neither observed
- Shipped meanwhile: the #1288 stopgap above. It holds the error on the server until the end, so the error is still lost when our own function or the browser link is cut. Revert it when the shape above lands

### Dropped after the verdict

- OpenRouter Chat Completions: ends at the in-band `{error}` chunk; the finish chunk and the billed usage chunk that follow are dropped (5 in 7 days of production logs, one carrying usage)
- OpenAI Responses: an `error` before any text ends the message there; `response.failed` follows (10 of 10 live) with `tool_usage` and the item list, never `usage`
- OpenAI Responses: the search count sits behind the usage gate in `_fromResponseMetrics`, so a failed or wrapped-failed response (`usage` null, `tool_usage` present) reports none. Moving it shows a search-only cost on a message with no tokens
- Bedrock: exception frames inside a stream name the failure in `:exception-type`, which the event-stream transform drops. Converse skips the event and ends on the generic end-of-stream text, Invoke fails on the payload shape as a parsing issue; neither retries. Read from the code, not reproduced live

### Text and labels

- Responses: the label is the `type`, else the `code`, so the code is lost when a type exists (`tokens: Rate limit reached` loses `rate_limit_exceeded`); `response.failed` labels the same failure by its code, which can be OpenAI's placeholder `unknown`. #1288 asks to keep type, code, message and param
- Responses (#1288): the ticket also asks for the response and event ids with the error, and that a final failure less specific than the earlier `error` (placeholder code `unknown` against type `invalid_request_error`, same message) does not replace it
- Responses: a salvaged `failed` response drops its error text (P21 in [AIX-ingestion.md](../AIX-ingestion.md)); as a non-terminal error it can stay as a note
- OpenAI: rate-limit `error` events carry `error.headers` (`retry-after-ms`); the in-band retry does not read them
- Responses (#1288): of several `error` events before the end, the stopgap keeps the last only. Promised on the ticket: each one is kept, as its own issue

### Not signalled by the vendor

- [xAI, 2026-11-09, hypothesis: one capture] a reply that reaches the context window ends `response.completed`, cut mid-sentence, total tokens 6 under the window. Stored as completed; detectable only by comparing total tokens with the window
- OpenAI: a wrapped-failed response (rate limit after a complete answer) carries no `usage`, so it is stored completed with no tokens and no cost
- Chat Completions: finish reasons we do not map read as "not provided"; Gemini Interactions `cancelled` shows an error with no text. Read from the code, not reproduced live
