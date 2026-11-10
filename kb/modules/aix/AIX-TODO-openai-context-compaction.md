# TODO: OpenAI hosted-tool loops that outgrow the context window

Status: not started. Measurements are in [LLM-openai-responses.md](../LLM-openai-responses.md), "Context window". Issue #1211.

## Problem

A long run with hosted tools (web search, code sandbox) fills the context inside one response. OpenAI applies the context limit at every step of the tool loop, so a request with a small input fails mid-run with `context_length_exceeded`, after tens of minutes, with no answer text: only the tool step lines survive. On GPT-6 Luna at max effort with comprehensive search, 5 of 12 parallel runs ended this way.

## What works

Server-side compaction (`context_management` on the request): the model summarizes its own context and continues, also in the middle of a tool loop. `truncation: 'auto'` is not an option: it cuts content silently, even from requests that fit.

## Costs of compaction

- Verbatim detail is lost; after a mid-loop compaction the model repeated some searches
- It also fires on requests near the limit that succeed today (a pasted document of about 830K tokens on Luna)
- Nothing tells the user it happened
- The compaction item is not stored or replayed, so a chat above the threshold compacts again on every turn

## Options

| | Change | Note |
|---|---|---|
| A | Keep the failure, say that the hosted tools filled the context | belongs with the typed errors work |
| B | Compaction on for every native OpenAI request | about 15 lines |
| C | Compaction only when hosted tools are on, or as a model parameter | B, gated; leaves large plain requests as they are |
| D | B or C, plus the compaction item stored and replayed | changes persisted data; belongs with the lossless ingestion work ([AIX-ingestion.md](../AIX-ingestion.md)) |

Proposed: C first, then D.

## To build (B or C)

- Request field and the `compaction` output item in the wiretypes; a case for the item in both parser paths (streaming and non-streaming), which reject unknown item types in development
- Gate to the native OpenAI dialect: Azure, OpenRouter, Bedrock Mantle, xAI, Meta AI and Sakana share the adapter and are untested
- A visible sign that a compaction happened (an operation line is enough)

## Open questions

- Whether a failed run, or the compaction pass itself, is billed
- The default threshold, and whether to set one
- Behavior in Pro mode and on GPT-6 Sol and Astra at full context size
- Whether the partial work of a failed run can be kept (the terminal event carries the finished tool items)
