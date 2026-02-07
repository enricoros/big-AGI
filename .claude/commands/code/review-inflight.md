---
description: Review in-flight changes for coherence, completeness, and quality
---

Review the current in-flight changes in the big-agi-private repository (dev branch, continuously rebased ~1800 commits on top of main).

**Step 1: Scope and read**

`git diff --stat` + `git status` for breadth. Then full `git diff` (if empty: `git diff --cached`, then `git diff HEAD~1`).
For every file in the diff, read surrounding context in the actual source file - the diff alone hides bugs in adjacent untouched code.

**Step 2: Reverse-engineer the intent**

From the diff, determine the **what**, **how**, and **why**. Present this concisely so the author can confirm or correct,
but don't stop here, continue to the full review in the same response.

**Step 3: Validate**

Run `tsc --noEmit --pretty` and `npm run lint` (in parallel). Report any errors with the review.
If the diff removes/renames identifiers, grep the codebase for stale references to the OLD names. This catches broken guards, stale imports, and incomplete migrations.

**Step 4: Deep review**

Evaluate every file in the diff.
Leave no rocks unturned - correctness, coherence, completeness, excess, maintenance burden,
codebase consistency, etc.

**Step 5: Prioritized next steps**

Think about what happens when the next developer touches this code.
Rank findings by severity (bug > correctness > cleanup > cosmetic). Be specific about what to change and where.

Remeber: design values for this codebase: orthogonal features, well modularized and reusable code,                                                                                                                                                
type-discriminated data, zero maintenance burden. Minimize future pain, etc.
