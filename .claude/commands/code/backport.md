---
description: Backport a feature across branch lines (e.g. dev -> main) as a re-implementation, then prove it with a trial rebase of the source line
argument-hint: "<source-branch> <target-branch> [feature scope, e.g. 'Voice framework']"
---

Backport a feature from a richer branch line to a leaner one: **$ARGUMENTS**

An example of how the user asks for this (the original Voice port request):

> Can you check out the `dev-voice` branch here for the purpose of looking at the Voice framework, and then backport it to the `main-voice` branch. In particular, port it in a way that will work and build greatly on `main`, however when we rebase dev-voice on top of it, it should not conflict (or rebase manually and resolve all the conflicts that arise) and then let me know the details of this large 'Voice' feature port in between the branches.

If the scope or branches are unclear, ask before doing anything. If source and target are on the SAME line (e.g. `dev` -> `staging`/`prod`), stop: that is a promotion (a release-marker move up the line; on the private `dev` line see `kb/product/PLAN-P-prod-promotion.md`), not a backport.

## The invariant

`dev` is rebased on top of `main`, never merged. A backport is a **re-implementation on the target line** (never a cherry-pick), and success is measured twice:

1. The port works and builds on the target line standalone - no dependencies on anything that stays on the source line (see "What crosses the line"), and the feature degrades gracefully where something was excluded.
2. When the source line is later rebased on top of it, the source's own feature commits land cleanly: they replay as empties (dropped) or as small deltas re-adding the source-only parts.

The rebase is not someone else's problem: finish by actually rebasing the source line onto the port (on a scratch branch) and resolving every conflict yourself - and do that from a conflict plan you wrote *before* starting the rebase, not by discovering conflicts as they happen.

The mechanical key to a clean rebase: wherever a file has no source-only dependencies, make the ported file **byte-identical** to the source-tip version. Every byte of deliberate divergence is a future conflict you are signing up to resolve - adapt only what must be adapted, and keep an exact list of where and why. That list essentially *is* your conflict forecast: diffing the port tip against the source tip over the ported paths tells you exactly which files will replay clean and which will fight.

## What crosses the line

The private/opensource contract, restated here because `main` does not carry it:

- `main` is the open-source build: local-first, BYO-keys, full AIX and provider coverage.
- `dev` extends `main` with the hosted/cloud layer: auth, Zync sync, Cloud Fabric, Stripe, multi-tenant, admin pages. That layer never crosses to `main`.
- Non-cloud improvements (UX, AIX, model support, bug fixes) can land on either line.

The test is whether the code depends on the hosted layer, not what it is named: local-first pieces of otherwise-private systems can cross (e.g. the Voice port brought ZYNC's local OPFS/IDB binary backends to `main` while the sync engine stayed on `dev`). In practice the densest entanglement is in shared Zustand stores, which on `dev` carry Zync sync/persistence hooks: the store logic crosses, the sync wiring does not. When in doubt about a borderline file, ask the user rather than guessing the boundary.

## How to approach it

- **Understand before porting.** Map the feature's commits and files on the source line, and expand to its dependency closure - features often sit on unported infrastructure (Voice required NorthBridge, ZYNC binary backends, ASRx). If the real scope is materially larger than asked, tell the user before proceeding.
- **Work where the user tells you.** This usually happens in a dedicated worktree; the user often has one already prepared with the environment set up (env vars copied, deps installed) - ask or check rather than creating one, and never disturb the main checkout (dev servers may be running).
- **Port with the source as reference, not as patch.** Own every hunk. Mirror the source's commit granularity and house-style subjects (short, scope-first, e.g. `Voice: capture/playback/library framework`), committing bottom-up so every commit builds. Validate with tsc + lint.
- **Pre-assess the rebase, then run it.** Know which source commits will conflict, in which files, and what the resolution will be before replaying anything. The default resolution rule: the source-line version wins on the source line - after the rebase, the rebased tip must carry exactly what the source had. An unforecast conflict means your understanding has a gap: stop, read both sides in full, and if it reveals the port itself is wrong, fix the port and retry rather than resolving through it.
- **Prove it.** The acceptance test is that the rebased source tip is content-identical to the original source tip (any exception is deliberate and justified). Validate the rebased tip too.

## Boundaries

Commit locally on the port and scratch branches only. Never push, never `git stash`, never merge between the lines, never move the real `dev`/`main`/`staging`/`prod` refs - adoption is the user's call.

## Report

Close with the details of the port: what was ported verbatim vs adapted (and why) vs excluded (and how the feature degrades), the dependency closure that was pulled in, forecast vs actual conflicts and how each was resolved, validation results, and the adoption steps left for the user.
