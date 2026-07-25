---
description: Update NVIDIA NIM model definitions from a live catalog harvest
---

Update `src/modules/llms/server/openai/models/nvidianim.models.ts` with the latest model definitions for NVIDIA's hosted endpoint (integrate.api.nvidia.com / build.nvidia.com).

Reference `src/modules/llms/server/llm.server.types.ts` and `src/modules/llms/server/models.mappings.ts` for context only. Focus on the model file, do not descend into other code.

**Primary source - run the harvest tool** (requires `NVIDIANIM_API_KEY` in `.env.api-keys` for the probe phase; never commit or echo the key):

```bash
npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts
```

This merges 4 sources (see the tool's README): live `/v1/models` ids, build.nvidia.com markdown catalog (labels, capabilities, createdDate -> pubDate), NGC deprecation dates, and authenticated liveness + context-window probes. It writes `tools/develop/nvidianim-catalog-sync/harvest-latest.json`. The probe phase is paced for the 40 RPM account limit and takes 30-45 minutes; use `--skip-probes` for a metadata-only refresh.

**`harvest-latest.json` is a committed snapshot** (id-sorted, diff-stable): after the run, `git diff tools/develop/nvidianim-catalog-sync/harvest-latest.json` IS the change review - alive flips, context changes, and new deprecation dates in that diff are exactly the edits to port into the curated table. Commit the refreshed snapshot together with the table changes. Ignore `harvestedAt` and `lastMonthInvocations` churn.

**Do NOT use web search.** The harvest output is the ground truth.

**Applying the results to the curated table:**

- ADD newly-alive chat models worth surfacing (skip embeddings/rerankers/parsers/guards unless hidden)
- REMOVE models that are dead (`dead-entitlement`, `retired`, `no-chat-route`) or carry a `deprecationDate` in the past or within days
- REGENERATE `_retiredNvidiaNIMIds` (the deny list): every harvested id that is neither curated nor a live chat model belongs there, grouped by classification. The invariant is total coverage: curated + denied should equal the full `/v1/models` list, so that any id outside both sets is a genuine 0-day arrival (those surface automatically as hidden entries)
- CAUTION - dead-for-our-key is not dead-for-everyone: NVIDIA scopes function visibility per account, so `dead-entitlement` and `probe-error` classifications reflect OUR key only. Before denying such a model, cross-check production analytics (PostHog, host `integrate.api.nvidia.com`, successful `aix_chat_generate_completed` events in the last ~14 days) for other accounts using it successfully. Precedent: `qwen/qwen3.5-397b-a17b` probed dead for our key on 2026-07-25 yet had 17 recent successes from 4 users - it stays OFF the deny list (hidden 0-day entry). Models with zero successes across all accounts are safe to deny
- `contextWindow` MUST come from the measured probe value (`ctxMeasured`), never from build.nvidia.com's advertised value - they disagree on ~25% of models, up to 8x, and gemma-4-31b silently truncates
- `pubDate` is the upstream model release date: prefer the same model's pubDate from another vendor's `*.models.ts` (add a `// = <file> '<id>'` cross-reference comment), fall back to the harvest `pubDate` (catalog createdDate)
- Borrowed `benchmark: { cbaElo }` values use the `- 2` yield idiom so native vendors win auto-picks
- Keep `chatPrice: _freePrice` on all models (the endpoint has no paid tier)
- Reasoning params: gpt-oss models use `_PS_OaiEffort`; other thinking models use `_PS_Thinking` (wired to `chat_template_kwargs` in the adapter)
- Preserve comments and table order (flagships first, hidden tail last); minimize whitespace churn

**Verify:** `tsc --noEmit --pretty && npm run lint`, then `NVIDIANIM_API_KEY=... npm test` (the nvidianim tests do a live listing; a `[DEV]` stale warning fails the test - that is the drift alarm).
