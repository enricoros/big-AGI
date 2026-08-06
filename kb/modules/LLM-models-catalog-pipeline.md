# LLM Models Catalog Pipeline (forward-looking)

Status: **proposal / partially implemented**. Companion to [LLM-editorial-control.md](LLM-editorial-pubdate.md) which describes the durable reference (`pubDate` semantics, editorial-vs-dynamic matrix, propagation chain).

This document captures the forward-looking pipeline that turns Big-AGI's editorial model metadata into website value-add (plots, decision helpers, comparison tools at big-agi.com).


## Goal

Stand up a database/datastore that the website (`~/dev/website`) can query for plots, decision helpers, and comparison tools - without requiring the website to call our authenticated tRPC endpoints.


## Stages

### Stage 1: source of truth (in this repo) — DONE

Editorial files in `src/modules/llms/server/` remain the canonical source for:

- Identity: id, label, vendor
- Capabilities: `interfaces`, `parameterSpecs`, `contextWindow`, `maxCompletionTokens`
- Pricing: `chatPrice` (input / output / cache tiers)
- Benchmarks: `benchmark.cbaElo` (Chat Bot Arena ELO)
- Lifecycle: `pubDate`, `isLegacy`, `isPreview`, `hidden`, deprecation comments

Well-typed, version-controlled, reviewed - every model edit is a code change with diff history. 282 entries currently carry `pubDate` (see editorial-control matrix).

### Stage 2: extraction script — IN PROGRESS

A build-time script (e.g. `scripts/llms/export-models.ts`) that:

1. Loads every editorial vendor's model array.
2. Normalizes per-vendor shapes (array vs Record, `id` vs `idPrefix`, `KnownLink` symlinks) to a single row format.
3. Resolves symlinks (target's `pubDate` flows through).
4. Writes a single JSON snapshot: `data/models-catalog.json` (one row per model, with vendor + the editorial fields above).

Open question: do we want this committed (gives the website a stable artifact / public URL) or built on-demand in CI? **Recommend committed snapshot** under `data/` so consumers get a stable URL.

### Stage 3: enrichment — NOT STARTED

The exported snapshot gets enriched with data we don't currently track in editorial files:

- **Knowledge cutoff** (proposed in `llms.types.next.ts:217` but never implemented; should be added to `ModelDescription_schema` as a follow-up).
- **MMLU / HumanEval / SWE-bench / GPQA / MATH** scores (currently only `cbaElo`; richer benchmarks belong in a separate block).
- **Throughput / latency** numbers (per-vendor, possibly per-region).
- **Modalities matrix** (input image, input audio, input video, input PDF, output image, output audio).
- **Weights availability** (closed / open / restricted), license.

Sources for enrichment: HuggingFace cards, vendor docs, Artificial Analysis, LLM-Stats, official benchmarks. Some can be scraped on a cadence; some needs editorial review.

### Stage 4: website consumption — NOT STARTED

The website (`~/dev/website`) consumes the snapshot to render:

- **Timeline plot**: `pubDate` (x-axis) vs `cbaElo` (y-axis), grouped by vendor - shows the frontier and rate of progress.
- **Cost-per-quality plot**: `chatPrice.output` vs `cbaElo` - "best model per dollar".
- **Decision helpers**: filter by capability (`interfaces`), context window, pricing tier, vendor.
- **Comparison cards**: side-by-side specs.
- **Lifecycle alerts**: deprecation warnings for retiring models.


## Open questions

1. **Where does enrichment data live?** A separate `data/models-enrichment.json` (joined by id at build time) keeps editorial files clean but introduces a join surface. Alternative: extend `ModelDescription_schema` with optional enrichment fields and treat editorial files as the only source. Recommend the separate file approach - editorial files stay focused on vendor-API integration; enrichment evolves on a different cadence.
2. **How fresh does the website need to be?** If daily, build the snapshot in CI on push and publish to a static URL. If real-time, consume tRPC directly - more work but fewer freshness gaps.
3. **Do we expose `pubDate` and other editorial metadata via tRPC publicly, or only via the snapshot?** The current tRPC routes require auth; the website should consume the snapshot, not live tRPC.
4. **Schema versioning** - if `ModelDescription_schema` evolves, the snapshot consumers need to be tolerant. Include a `schemaVersion` field in the snapshot envelope.


## Future extensions to `ModelDescription_schema`

Beyond `pubDate`, the natural follow-ups (in priority order):

1. **`knowledgeCutoff?: string`** (`'YYYY-MM'` or `'YYYY-MM-DD'`) - already proposed in `llms.types.next.ts`. Useful for the timeline plot and for context-aware prompts.
2. **`deprecationDate?: string`** - currently exists informally as `deprecated?: string` on `_knownGeminiModels`; should be promoted to the schema.
3. **`license?: string`** - especially important for open-weights models (apache-2.0, mit, llama-community, custom).
4. **`weights?: 'closed' | 'open' | 'restricted'`** - quick filter for "can I run this myself?".
5. **`benchmarks?: { mmlu?: number, humaneval?: number, gpqa?: number, ... }`** - richer than the current `cbaElo`-only block.
6. **`modalities?: { in: string[], out: string[] }`** - more precise than `interfaces` for input/output capability matrices.
