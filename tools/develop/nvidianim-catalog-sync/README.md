# NVIDIA NIM Catalog Sync

Refreshes the curated NVIDIA model table (`_knownNvidiaNIMModels` in
`src/modules/llms/server/openai/models/nvidianim.models.ts`) by merging four sources into one
facts table per hosted model. See the `llms:update-models-nvidia` command for the full workflow.

## Run

```bash
npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts                # full, 30-45 min (paced probes)
npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts --skip-probes  # no key, sources 1-3, ~2 min
npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts --only glm-5.2,minimax-m3
```

API key: `NVIDIANIM_API_KEY` from `process.env`, then repo-root `.env.api-keys` / `.env.local` /
`.env`. Never printed. Without a key, probes are skipped.

## Output

`harvest-latest.json` (`{ harvestedAt, counts, models[] }`) plus a console table, context
mismatches, and join anomalies. Partial runs (`--skip-probes` / `--only`) write
`harvest-preview.json` (gitignored) instead, so they can never clobber the committed ledger.

The JSON is **committed on purpose** and id-sorted, so `git diff harvest-latest.json` across runs
shows real catalog churn (models added/retired, context/capability flips, deprecation dates) and
`git log -p` is the historical record. After a run: review the diff, port the deltas into
`nvidianim.models.ts`, commit both together. Benign per-run noise: `harvestedAt` and
`lastMonthInvocations`.

## Sources

1. **Live ids** - `GET integrate.api.nvidia.com/v1/models` (no auth; its `created` is a constant sentinel, ignored).
2. **build.nvidia.com catalog** (no auth) - `/models.md` index + per-model `.md` cards (label,
   description, specs, capabilities); `pubDate` from the page HTML `createdDate`, with NGC
   `dateCreated` as a flagged fallback, never guessed. Gotchas handled in `sources.ts`: missing
   pages soft-200 with an SPA shell, and non-browser requests get the payload stripped.
3. **NGC endpoint search** (no auth) - `DEPRECATION` dates (the only forward-looking removal
   signal) and `lastMonthApiInvocationCount` (popularity). Fuzzy id joins are recorded, never forced.
4. **Live probes** (key required) - per model: a tiny completion for liveness (`alive`,
   `dead-entitlement`, `no-chat-route`, `retired`, `throttled`, `slow-or-dead`, `probe-error`), then
   for alive models an oversized prompt whose 400 error states the real context window (a 200 means
   silent truncation, e.g. gemma-4-31b). Inconclusive results keep their raw evidence in `notes[]`.

## Pacing (do not change casually)

- The account limit is ~40 requests/minute: probes run strictly sequentially through one global
  gate, >= 1600ms apart. Do not parallelize them.
- Timeout 45s, escalated to 120s on the single retry only after a timeout. Load-bearing: at a flat
  45s, cold-starting and big-window models get misfiled as dead, and a false `dead` corrupts the
  curated table far worse than a slow run does.
