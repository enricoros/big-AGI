---
description: Delete a Claude Code session (tape) and all its artifacts by session ID
disable-model-invocation: true
argument-hint: <session-id>
allowed-tools: Bash
---

Delete the Claude Code session with ID `$ARGUMENTS` - the transcript wherever it lives under any project dir, its subagent transcripts, and its per-session state.

First check the argument: if `$ARGUMENTS` is not exactly one UUID (8-4-4-4-12 hex), stop and say so - do not guess or delete anything.

Then run these deletions (each target may or may not exist):

```bash
find ~/.claude/projects -maxdepth 2 -name "$ARGUMENTS.jsonl" -print -delete
rm -rfv ~/.claude/projects/*/"$ARGUMENTS"
rm -rfv ~/.claude/session-env/"$ARGUMENTS" ~/.claude/file-history/"$ARGUMENTS"
```

After running, confirm what was found and removed.
