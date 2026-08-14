---
description: Increment the AIX monotonic version number
allowed-tools: Bash(git add:*),Bash(git status:*),Bash(git commit:*),Edit,Write
model: haiku
disable-model-invocation: true
---

Increment `Monotonics.Aix` in `src/common/app.release.ts` and commit it.

**NOTE**: rolling AIX refreshes every vendor on every client. Model-definition updates no longer
need it (per-vendor versions auto-roll, see `kb/modules/LLM-defs-refresh.md`); to force-roll a
single vendor bump its `epoch` in `src/modules/llms/server/llms.defs.manifest.ts` instead.
Reserve AIX rolls for protocol-level changes.

**Pre-flight checks (MUST pass or abort):**
1. Run `git branch --show-current` - MUST be on `main` branch
2. Run `git status src/common/app.release.ts` - file MUST be unmodified (no changes on this specific file)

**Execute:**
1. Read current `Monotonics.Aix` value from `src/common/app.release.ts`
2. Increment by 1
3. Update ONLY that line
4. Run: `git add src/common/app.release.ts && git commit -m "Roll AIX"`

Confirm new version number.