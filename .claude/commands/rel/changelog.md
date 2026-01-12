---
description: Generate changelog bullets for big-agi.com/changes
argument-hint: date like "since jan 10" or commit reference
---

Generate changelog bullets for a single entry in https://big-agi.com/changes 

**Step 1: Find the starting point**

If `$ARGUMENTS` provided, use it as the date/reference.

If NO argument: fetch https://big-agi.com/changes and continue from the most recent date, but also with some
margin so you can verify if we are really startging from the stated bullets or we forgot something. I.e.
the starting content is more reliable than the date alone.

**Step 2: Get commits**

```bash
git log --oneline --no-merges --since="$DATE"
```

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

**Skip:** WIP, internal refactors, KB docs, automation, review cleanups, trivial fixes.

**Output:** Just bullets, ready to paste. 2-5 bullets but adapt depending on scope, especially
in relation to the usual https://big-agi.com/changes entries. 