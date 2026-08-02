---
description: Stack-unwind review of this conversation - a tree of main tasks done (struck through) and every open left behind at the depth it was abandoned, sized by the thread's measured shape, never by feel. Optional argument - a .jsonl path or session id to review a different session.
argument-hint: [session.jsonl | session-id]
disable-model-invocation: true
context: fork
agent: general-purpose
background: false
allowed-tools: Read, Bash(bash ${CLAUDE_SKILL_DIR}/census.sh:*)
---

# /opens - stack-unwind review

You are a fresh instance with NO access to the conversation you are about to review. That is by design: you must not assume anything about the user, the project, or what a "normal" conversation looks like.

The concept: long working sessions are depth-first. The user starts with an objective, drills into one aspect (leaving opens behind), drills deeper inside that, and so on - a stack, not a list. Your job is to reconstruct the whole thread as a stack-unwind tree: the main tasks that actually got done, checked and struck through, and everything raised-but-never-resolved as unchecked opens, nested at the stack depth where each was abandoned.

## Step 1 - census (deterministic, run exactly this)

```
bash ${CLAUDE_SKILL_DIR}/census.sh ${CLAUDE_SESSION_ID} $ARGUMENTS
```

It prints `SESSION`, `USER_PROMPTS`, `SPAN`, `BUDGET`, `SPINE` (a file path), `SPINE_BYTES`. If it prints ERROR, stop and report that error text as your final message.

`BUDGET` is the sizing law and it is not yours to adjust, in either direction. Why it exists: opens are created by *descents*, and descents happen at user prompts - not at tokens, which are dominated by tool noise. So the tree size is computed from the measured prompt count (`round(1.5 * sqrt(USER_PROMPTS))`, clamped 5..30) by the script, before any model is involved. A zero-knowledge instance like you would otherwise default to "about a page" no matter the thread; the computed budget is what makes a 15-prompt evening yield 6 nodes and a 5-day monster yield 25, consistently, on every run.

## Step 2 - read the spine

Read the `SPINE` file completely (use offset/limit chunks if it is large). It is the conversation reduced to plain chronological text:

- `[USER <timestamp>]` - a user prompt (truncated to 800 chars)
- `[AI]` - an assistant text reply (truncated to 400 chars)
- `[INTERRUPTED]` - the user cut the assistant off mid-turn; a frame likely got popped without unwinding - strong open signal nearby
- `[TASK-RESULT]` - a background subagent returned; its findings may contain deferred items
- `[COMPACTED SUMMARY <date>]` - condensed earlier history; treat its contents as thread events
- `[USER dead-branch <timestamp>]` / `[AI dead-branch]` - content from an abandoned or rewound timeline: the user backtracked and the thread continued differently. Real work and real opens can live there, but the live thread wins on any conflict, and nothing from a dead branch counts as done unless the live thread confirms it

## Step 3 - build the tree

1. First enumerate ALL candidate opens internally, end to end. Their count is `K`.
   - An open is anything raised but never resolved later in the thread: a deferred fix or rename, a "later/TODO", a question asked and never answered, an unverified claim ("should work"), a rabbithole abandoned mid-descent, a "we should also X" nobody did, next-steps proposed at the close and never picked up.
   - NOT an open: anything resolved later in the thread (render it done or omit it), transient debugging, plans that were superseded.
2. Rank candidates by "would the user still care today". Recency, explicit user words ("later", "don't do X now"), and blocked-on-user gates rank high; stale trivia dies.
3. Build the tree under these hard constraints:
   - max `BUDGET` nodes TOTAL (done + open combined), max depth 3, one line per node
   - top level = the thread's main tasks in chronological order
   - done: `- [x] ~~task~~ - 3-6 word outcome`
   - open: `- [ ] item (MM-DD)` with the date hint when useful
   - nesting mirrors the drill-down stack: an open left while inside sub-task B of task A nests under A > B
   - telegraphic but readable - no invented codenames, no abbreviations the tree itself doesn't explain

## Step 4 - output

Your final message must be EXACTLY this raw markdown and nothing else - no preamble, no closing remarks, no code fence around it:

```
## <invented 4-8 word thread title> - <USER_PROMPTS> prompts, <SPAN>
<the tree>
_pruned: kept <nodes-shown-as-open> of <K> candidate opens_
```
