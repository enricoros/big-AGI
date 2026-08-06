---
description: Search git history for commits that introduce or remove an exact string, within a commit range
argument-hint: "[search-string] [ancestor-commit]"
allowed-tools: Bash(git *)
---

Search git history using `git log -S` (pickaxe) to find commits that add or remove an exact string.
This repo has 7000+ commits, so pickaxe searches can take 30-60+ seconds - this is expected.

## Parameters

- `$0` - The exact string to search for in file contents (not commit messages). Examples: `getLabsSUDO`, `EXPERIMENT_ON_SUDO`, `myFunctionName`
- `$1` - A commit hash or unique commit message substring to identify the start of the range. Examples: `5af80b96a8`, `"Sudo Mode": 10-click`

## Example

```
/code:grep-history EXPERIMENT_ON_SUDO "Sudo Mode": 10-click
```

This searches all commits between the `"Sudo Mode": 10-click` commit and HEAD for any that add or remove the string `EXPERIMENT_ON_SUDO` in file contents.

## Procedure

### Step 1: Resolve the ancestor commit

If `$1` looks like a commit hash (hex string), use it directly.
Otherwise, search for it by message, restricting to ancestors of HEAD:

```bash
git log --oneline --grep='$1' HEAD | head -5
```

This only walks commits reachable from HEAD, so every result is a guaranteed ancestor - no verification loop needed.

If multiple results, pick the oldest (last listed) since it represents the earliest matching commit.
If none, report the error and stop.

### Step 2: Run pickaxe search

```bash
git log -S "$0" --oneline <resolved_ancestor>..HEAD
```

This finds commits where the count of `$0` in the codebase changes (i.e., it was added or removed).
This can be slow on 7000+ commits - wait for it.

### Step 3: Check endpoints

Also check whether the string exists at HEAD and at the ancestor commit:

```bash
git grep -l "$0" HEAD 2>/dev/null || echo "(not found at HEAD)"
git grep -l "$0" <resolved_ancestor> 2>/dev/null || echo "(not found at ancestor)"
```

### Step 4: Report

Present results concisely:
- Number of commits found (or "none")
- List of matching commits (hash + subject line)
- Whether the string exists at HEAD and/or at the ancestor
- If found, suggest next steps (e.g., `git show <hash>` to inspect specific commits)