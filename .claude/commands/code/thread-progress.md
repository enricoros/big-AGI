---
description: Show a hierarchical progress tree of the current conversation thread
---

Analyze this conversation thread and produce a **hierarchical progress tree** - a vertical breadcrumb of the chat and actions from the very start to now.

**Format:**

A tree, where every rabbithole that was taken adds a level.

```
[ ] Brief initial phase/ask/goal description
  [x] Specific thing done or decided - "user quote if relevant"
  [x] Another step
  [ ] Sub-phase/rabbithole/etc
    [x] Done step (if important)
    [ ] Sub-sub-phase
      [ ] Current step doing <-- HERE
      [ ] Next step since this sub-sub-phase was broken out

    [ ] Remaining step
    [ ] ...

  [ ] Missing, back to the main goal
  [ ] ...
  
### What do we rewind the rabbithole to (once the current level is complete)?
...

### What's up (towards user value) and down (towards deeper code levels) the rabbithole?
...

### What's a good hyphenated title for this chat?
...

```

**Rules:**
- `[x]` done, `[ ]` not done. Parent is done only when ALL children on the next level are `[x]`
- Each node: a few words, specific. Quote the user briefly when it captures the intent
- Group by logical phases or rabbitholes (when descending to a deeper level of implementation or going off for a temporary tangent or sub-quest), not by messages
- Earlier levels that are fully completed don't need to be expanded in subtasks
- Root nodes/completed nodes need to show what was "wanted" from them, not being checked because they are shown as earlier phases (i.e. upper hierarchy contains more)
- Some earlier sub-phases or even levels of rabbitholes can be marked as done as indented [x] below each other (do not add non-major bullets on already completed nodes)
- Insert newlines in between large groups of items
- Decisions: state what was chosen, not the alternatives
- If a former phase produced no code change or decision, omit
- Very important to insert incomplete `[ ]` items for things that wre mentioned and are likely useful but mentioned at higher levels of the rabbithole so they must come after, when unwinding the stack
- Keep it short, tight (min 0 max half the user messages as far as count). This is a navigation aid, not a transcript

It's important for this to represent a high-level sequence of important actions and turns and pivots and rabbiholes, all focuses on trying to solve something.

First think through it looking at all the chat from the back to the front, then front to back, user requests, and understand the main storybeats. This is useful especially to remove already done leaves that don't add much if shown.
So think about the full list, so you have it all in front of you when you do the last pass to show it to me.
It's important to see the progress of what we were doing (e.g. see that we set out to do something at the beginning, but a few items of those are still incomplete, also because we took 2 detours to fix more things in the meantime...).

At the end anser the questions in the Format, with brief bullet points.
