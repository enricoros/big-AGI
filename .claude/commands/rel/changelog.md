---
description: Generate changelog bullets for big-agi.com/changes
argument-hint: date like "2026-01-10" or empty for auto-detect
---

Generate changelog bullets for a single entry in https://big-agi.com/changes

**Step 1: Find the starting date**

IMPORTANT: This repo rebases frequently, so commits are INTERLEAVED throughout history.
New commits can appear at line 10, 500, or 1800. Use AUTHOR DATE (`%ad`) to filter - it's preserved during rebases.

If `$ARGUMENTS` provided, use it as the cutoff date.

If NO argument:
1. Fetch https://big-agi.com/changes to get the most recent changelog date
2. Use that date as the cutoff

**Step 2: Get commits by author date**

Filter commits by author date to catch ALL new commits regardless of position in history:

```bash
# For commits after Jan 10, 2026 (adjust date pattern as needed)
git log --oneline --no-merges --format="%h %ad %s" --date=short | grep "2026-01-1[1-9]\|2026-01-2\|2026-02"

# Verify interleaving by checking line numbers
git log --oneline --no-merges --format="%h %ad %s" --date=short | grep -n "2026-01-1[1-9]"
```

The line numbers prove commits are scattered (e.g., lines 14, 638, 1156, 1803 = interleaved).

**Step 3: Write bullets**

Real examples from big-agi.com/changes:
- "Gemini 3 Flash support with 4-level thinking: high, medium, low, minimal"
- "Cloud Sync launched! - long awaited and top requested"
- "Deepseek V3.2 Speciale comes with almost Gemini 3 Pro performance but 20 times cheaper"
- "Anthropic Opus 4.5 with controls for effort (speed tradeoff), thinking budget, search"
- "Login with email, via magic link"
- "Mobile UX fixes for popups drag/interaction"

**Rules:**

1. **Order by importance** - most significant changes first, minor fixes last
2. **Feature-first, no verb prefixes** - "Gemini 3 support" not "Add Gemini 3 support"
3. **Model names lead** when it's about LLMs
4. **Specific details** - "4-level thinking: high, medium, low, minimal" not "multiple thinking levels"
5. **One-liners** - short, no fluff
6. **Consolidate commits** - 10 persona editor commits = 1 bullet
7. **No corporate speak** - no "enhanced", "streamlined", "robust", "leverage"

**Skip:** WIP, internal refactors, KB docs, automation, review cleanups, trivial fixes, deps bumps, CI changes.

**Output:** Just bullets, ready to paste. 2-5 bullets but adapt depending on scope, especially
in relation to the usual https://big-agi.com/changes entries.