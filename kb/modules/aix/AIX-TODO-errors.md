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
- OpenAI (#1288): an `error` after answer text is kept when the stream ends before its terminal event, by a stopgap marked `STOPGAP #1288 - REVERT` at its three sites (Responses parser, transmitter, reassembler): the error is parked in the stop reason and the client guesses it back. To redo with the typed errors
- Gemini (#1287): an error sent inside the stream ends the message with its status, code and text; `details` is appended to the text as JSON and not carried as fields (reason, retry delay, quota), the code reads like an HTTP status though the transport was 200, the log level is always a warning, a bare-string error is surfaced as its message
- Stop errors stored twice (filter stops, refusals): the replacement code is commented under a `TODO` in `ContentReassembler` (`dialectStopExplained`)
- Gemini `TOO_MANY_TOOL_CALLS`: belongs to the truncated class with its own wording and Continue - see [AIX-outcome.md](../AIX-outcome.md), "Open: tool-budget stops"
- OpenAI `context_length_exceeded` in the middle of a hosted tool loop: the text should say the hosted tools filled the context; the terminal event carries the finished tool items and no message
- OpenRouter Chat Completions: `finish_reason: 'error'` sets `cg-issue` (RECITATION -> `filter-recitation`) with composed text in `tokenStopError` - `_fromOpenRouterErrorFinish`

### Retry

- Gemini: in-stream `503 UNAVAILABLE` is real (seen as `error` events after HTTP 200) and is shown, not retried; retry only while nothing has streamed
- [Gemini, 2026-11-10, hypothesis: deadline errors on two models] an error before the first event is the HTTP status (504), on the fetch path; inside the stream it always follows content, so "nothing has streamed" does not occur there
- Gemini: "Deadline expired before operation could complete" comes under two statuses: `504 DEADLINE_EXCEEDED` when the request's own deadline expires (the `X-Server-Timeout` header, which we do not send), `503 UNAVAILABLE` from Google's side (#1287). Classify by status, not by message
- A last attempt that goes through and then fails for another reason still reads "Gave up after N attempts": the reassembler cannot tell it from the same error returning
- Anthropic: a zero fast mode rate limit is matched by message text in the fetch retrier, not by a typed cause

### Retry after partial output (#1211, #1287)

Left for the rework by the author's ruling.

- Today the dialects disagree: OpenAI Responses retries a transient failure even after answer text has streamed, clearing it; Chat Completions stops retrying once any output has streamed
- Asked in #1287: "Fixing diagnosis should not automatically restart a long, partially completed request". In [#1211](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536775910): restart only on clear cases, like a busy flex tier or a dropped connection with an empty response; the author [agreed](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6536859013) and [reopened](https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6565761327) it for a configurable "Retry transient errors within [N] minutes"

### Replay

- Assistant error fragments are replayed as `[ERROR] ...` model text when the turn has other content (Q1 in [AIX-ingestion.md](../AIX-ingestion.md)). A turn of errors alone is not sent: an interim turn-shape rule in the request builder, for a per-error replay policy to replace
- Measured (a question, a stored 402 rejection turn, a new question; 9 models, 3 runs each): with the error replayed the first question went unanswered on 8 models (24 of 24) and was answered on Opus 5.5; left out, it was answered every time. "What happened?" was explained only when replayed. A neutral marker did no better than the error text
- Still sent as an errors-only model turn: reasoning followed by an error (most adapters drop the reasoning), and an error after a tool result in a tool loop (the adapter splits the message). Frequency not measured
- A change to the replay rule changes the prefix of every stored conversation it touches: once, Anthropic drops the thinking replayed after it (`prefix_binding_mismatch`, measured on Opus 5.5) and the prompt cache misses

### Stream mechanics (ideas)

Light pointers for whoever builds this, so these get looked at. Not a design. The `STOPGAP #1288 - REVERT` comments in the code point here.

- `setDialectTerminatingIssue` packs three things in one call: it reports the issue, fails the message, and stops the read. They are likely separate: at least queuing the issue (the `aix.issue` particle) apart from stop-and-close
- This likely changes the whole chain of functions that produce particles (what the parsers call, the transmitter, the read loop, the end), not that one call; some of today's calls become more than one
- Disposition (keep parsing or stop) and outcome (does the message fail) are two things; an issue alone is no reason to close
- What arrives after an error is worth reading: see the next section

### What the vendors send around an error (measured)

The wire a new design has to fit. Not a design: the direction is the author's, under "From the author".

- OpenAI Responses: `response.failed` followed the `error` event in 18 of 18 live runs. It repeats the message and adds the item list and `tool_usage`, never `usage`; its code can be the placeholder `unknown` where the `error` had a type and a param
- OpenAI Responses: an `error` after answer text is not a verdict. No `.done` event precedes it, and in 10 of 10 rate-limit cases the message inside `response.failed` was complete. Such an answer comes with no `usage`
- OpenAI: rate-limit `error` events carry `error.headers`, with `retry-after-ms`
- OpenRouter (2 captures, 5 production log lines): after the in-band error chunk come a chunk with a `finish_reason` (`tool_calls`, or `error`) and one with the billed usage
- Gemini (2 captures): after the in-stream error frame only an unframed copy of it follows, then the stream ends
- Gemini: the error object is Google's standard one ([AIP-193](https://google.aip.dev/193#http11json-representation)): `code`, `message`, `status`, and `details`, a list of typed entries. No in-stream error carried `details` (2 captures, 3 bodies logged in #1287). HTTP errors do, live: a bad key (`ErrorInfo` with reason `API_KEY_INVALID`, `LocalizedMessage`), an unknown field or a bad enum value (`BadRequest`); not a 404, a 504, or four other 400s. The fetch path shows the message only
- Anthropic: no in-stream error captured
- Bedrock: exception frames inside a stream name the failure in the `:exception-type` header. From the AWS event-stream format, not reproduced live
- [xAI, 2026-11-09, hypothesis: one capture] a reply that reaches the context window ends `response.completed`, cut mid-sentence, total tokens 6 under the window: nothing on the wire says it was cut

### Asked on #1288, not done

- The error keeps its type, code, message and param, and the response and event ids
- A final failure less specific than the earlier `error` does not replace it
- Multiple errors are preserved (the stopgap keeps the last)
