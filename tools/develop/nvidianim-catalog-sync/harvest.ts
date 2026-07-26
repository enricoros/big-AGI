#!/usr/bin/env tsx
/**
 * NVIDIA Catalog Harvest
 *
 * Merges 4 sources into one facts table per hosted NVIDIA model, the refresh mechanism behind the
 * curated `_knownNvidiaModels` table:
 *   1. live ids       - integrate.api.nvidia.com/v1/models
 *   2. build catalog  - build.nvidia.com model cards (.md) + page HTML for createdDate
 *   3. NGC search     - deprecation dates + last-month invocation counts
 *   4. live probes    - liveness classification and measured context window (needs NVIDIANIM_API_KEY)
 *
 * Usage:
 *   npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts
 *   npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts --skip-probes
 *   npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts --only nemotron
 *   npx tsx tools/develop/nvidianim-catalog-sync/harvest.ts --help
 *
 * Writes harvest-latest.json next to this file, and prints an aligned table.
 * A full probed run takes 8-15 minutes: the account allows 40 requests/minute, so probes are serial.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AliveClass, CatalogIndexEntry, HarvestedModel, HarvestFile, NgcEndpoint } from './types';
import { KEY_FILE_NAMES, lookupNvidiaKey, NVIDIA_KEY_VAR } from './access';
import { PROBE_PACING_MS, probeContextWindow, probeLiveness } from './probes';
import { fetchCatalogCard, fetchCatalogIndex, fetchCreatedDate, fetchLiveModelIds, fetchNgcEndpoints, joinKey, mapPooled } from './sources';


const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
// full runs write the committed catalog ledger; partial runs (--skip-probes / --only) write a
// preview file instead, so a quick metadata pass can never clobber the probed snapshot in git
const OUTPUT_FILE = path.join(TOOL_DIR, 'harvest-latest.json');
const PREVIEW_FILE = path.join(TOOL_DIR, 'harvest-preview.json');
const CATALOG_CONCURRENCY = 4;
/** The HTML pages are 200-300KB each and trip the WAF far more easily than the .md endpoints. */
const HTML_CONCURRENCY = 2;

const ALIVE_ORDER: AliveClass[] = ['alive', 'throttled', 'unprobed', 'probe-error', 'slow-or-dead', 'no-chat-route', 'dead-entitlement', 'retired'];


// --- CLI ---

interface Options {
  skipProbes: boolean;
  only: string | null;
  extra: string | null;
}

function parseArgs(argv: string[]): Options | 'help' {
  const options: Options = { skipProbes: false, only: null, extra: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return 'help';
    else if (arg === '--skip-probes') options.skipProbes = true;
    else if (arg === '--only') options.only = argv[++i] ?? null;
    else if (arg.startsWith('--only=')) options.only = arg.slice('--only='.length);
    else if (arg === '--extra') options.extra = argv[++i] ?? null;
    else if (arg.startsWith('--extra=')) options.extra = arg.slice('--extra='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp(): void {
  console.log(`
NVIDIA Catalog Harvest - merges live ids, build.nvidia.com cards, NGC metadata and live probes.

  --skip-probes        sources 1-3 only, no API key needed, finishes in ~1 minute
  --only <substring>   restrict to model ids containing the substring (comma-separate for several)
  --extra <id,id>      also probe ids NOT in /v1/models (delisted models can still serve for days;
                       alive-ish ids from the previous ledger are carried over automatically)
  --help               this text

Output: harvest-latest.json in the tool directory, plus an aligned console table.
Probes are paced at one request per ${PROBE_PACING_MS}ms (the account limit is 40 requests/minute).
`.trim());
}


// --- formatting helpers ---

function isoToPubDate(iso: string | null): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

function fmtCount(n: number | null): string {
  if (n === null) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCap(value: boolean | null): string {
  return value === null ? '?' : value ? 'Y' : 'n';
}

/**
 * Exact join-key lookup, then a deliberately narrow prefix-tolerant fallback for the version-suffix
 * mismatches between the hosted ids and the catalog/NGC names (id 'mixtral-8x7b-instruct-v0.1' vs
 * catalog slug 'mixtral-8x7b-instruct'). Only the id may carry the extra suffix, bounded to 3 extra
 * characters on a >=10 character stem: matching the other direction would let a bare id
 * ('riva-translate-4b-instruct') steal the entry its own '-v1.1' sibling owns exactly, and sibling
 * models (qwen-image vs qwen-image-edit) must never collapse into each other.
 */
function fuzzyLookup<T>(byKey: Map<string, T>, name: string): { value: T; matchedKey: string | null } | null {
  const key = joinKey(name);
  const exact = byKey.get(key);
  if (exact !== undefined) return { value: exact, matchedKey: null };

  let best: { key: string; value: T } | null = null;
  for (const [candidateKey, value] of byKey) {
    if (candidateKey.length < 10 || key.length - candidateKey.length > 3 || !key.startsWith(candidateKey)) continue;
    if (!best || candidateKey.length > best.key.length) best = { key: candidateKey, value };
  }
  return best ? { value: best.value, matchedKey: best.key } : null;
}

function elapsed(startedAt: number): string {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
}


// --- main ---

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') return printHelp();
  const options = parsed;

  const startedAt = Date.now();
  console.log('# NVIDIA catalog harvest');
  console.log(`  started ${new Date().toISOString()}${options.only ? `, only ids containing '${options.only}'` : ''}`);

  // key (never printed, only its provenance)
  const key = options.skipProbes ? null : lookupNvidiaKey();
  if (options.skipProbes)
    console.log('  probes: skipped (--skip-probes), sources 1-3 only');
  else if (!key)
    console.log(`  probes: SKIPPED - no ${NVIDIA_KEY_VAR} in process.env or ${KEY_FILE_NAMES}; running unauthenticated`);
  else
    console.log(`  probes: enabled, key from ${key.source}, paced at ${PROBE_PACING_MS}ms between requests`);

  // --- source 1: live ids
  const liveIds = await fetchLiveModelIds();

  // Probe BEYOND /v1/models: delisting is not death on this endpoint (models have served for days
  // after leaving the list, e.g. mistral-large-3, and only a probe can record the 410 + its EOL date).
  // Carry over ids from the previous ledger that vanished from the list while still classified
  // alive-ish; once a run records them 'retired'/dead they decay off naturally. Plus --extra ids.
  const listedIds = new Set(liveIds.map((m) => m.id));
  const unlistedIds: string[] = [];
  try {
    const prev = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')) as HarvestFile;
    const carryable = new Set(['alive', 'throttled', 'slow-or-dead', 'probe-error']);
    for (const m of prev.models)
      if (!listedIds.has(m.id) && carryable.has(m.alive)) unlistedIds.push(m.id);
  } catch { /* no previous ledger - fine */ }
  for (const id of options.extra ? options.extra.split(',').map((s) => s.trim()).filter(Boolean) : [])
    if (!listedIds.has(id) && !unlistedIds.includes(id)) unlistedIds.push(id);
  const allIds: typeof liveIds = [...liveIds, ...unlistedIds.map((id) => ({ id, ownedBy: null }))];

  const onlyParts = options.only ? options.only.split(',').map((part) => part.trim()).filter(Boolean) : null;
  const selected = onlyParts ? allIds.filter((m) => onlyParts.some((part) => m.id.includes(part))) : allIds;
  console.log(`\n[1/4] live ids: ${liveIds.length} from /v1/models${unlistedIds.length ? ` + ${unlistedIds.length} unlisted carryover/extra` : ''}${options.only ? `, ${selected.length} selected` : ''}`);

  // --- source 2: build.nvidia.com catalog
  const { entries: indexEntries, pagesRead, notes: indexNotes } = await fetchCatalogIndex();
  const indexBySlugKey = new Map<string, CatalogIndexEntry>();
  for (const entry of indexEntries) {
    const slugKey = joinKey(entry.slug);
    if (!indexBySlugKey.has(slugKey)) indexBySlugKey.set(slugKey, entry);
  }
  console.log(`[2/4] build catalog: ${indexEntries.length} index entries over ${pagesRead} page(s)`);
  for (const note of indexNotes) console.log(`       note: ${note}`);

  const modelNameOf = (id: string) => id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;

  const cards = await mapPooled(selected, CATALOG_CONCURRENCY, async (model) => {
    const matched = fuzzyLookup(indexBySlugKey, modelNameOf(model.id));
    const indexEntry = matched?.value ?? null;
    const card = await fetchCatalogCard(model.id, indexEntry?.slug ?? null);
    return { id: model.id, indexEntry, card, fuzzySlug: matched?.matchedKey ? indexEntry?.slug ?? null : null };
  });
  const withCard = cards.filter((c) => c.card).length;
  console.log(`       model cards: ${withCard}/${selected.length} resolved`);

  // createdDate lives only in the page HTML flight payload
  const cardPages = cards.filter((c) => c.card?.canonical);
  const createdDates = await mapPooled(cardPages, HTML_CONCURRENCY, async (entry) => {
    const { createdDate, failure } = await fetchCreatedDate(entry.card!.canonical!);
    return { id: entry.id, createdDate, failure };
  });
  const createdById = new Map(createdDates.map((c) => [c.id, c]));
  console.log(`       createdDate: ${createdDates.filter((c) => c.createdDate).length}/${cardPages.length} resolved from the page HTML`);

  // --- source 3: NGC endpoint metadata
  const { endpoints: ngcEndpoints, notes: ngcNotes } = await fetchNgcEndpoints();
  const ngcByKey = new Map<string, NgcEndpoint>();
  const ngcKeyCollisions: string[] = [];
  for (const endpoint of ngcEndpoints) {
    for (const candidate of [endpoint.name, endpoint.displayName ?? '']) {
      if (!candidate) continue;
      const nameKey = joinKey(candidate.includes('/') ? candidate.slice(candidate.indexOf('/') + 1) : candidate);
      if (!nameKey) continue;
      const existing = ngcByKey.get(nameKey);
      if (existing && existing.resourceId !== endpoint.resourceId)
        ngcKeyCollisions.push(`${nameKey}: ${existing.resourceId} vs ${endpoint.resourceId}`);
      else if (!existing)
        ngcByKey.set(nameKey, endpoint);
    }
  }
  const deprecatedCount = ngcEndpoints.filter((e) => e.deprecationDate).length;
  console.log(`[3/4] NGC endpoints: ${ngcEndpoints.length} resources, ${deprecatedCount} with a DEPRECATION date`);
  for (const note of ngcNotes) console.log(`       note: ${note}`);

  // --- assemble the pre-probe records
  const models: HarvestedModel[] = [];
  const matchedNgcIds = new Set<string>();

  for (const { id, indexEntry, card, fuzzySlug } of cards) {
    const notes: string[] = [];
    if (!listedIds.has(id)) notes.push('NOT in /v1/models this run (unlisted carryover/extra probe)');
    const ngcMatch = fuzzyLookup(ngcByKey, modelNameOf(id));
    const ngc = ngcMatch?.value ?? null;
    if (ngc) {
      matchedNgcIds.add(ngc.resourceId);
      if (ngcMatch?.matchedKey) notes.push(`NGC joined by prefix match to '${ngc.name}'`);
    } else notes.push('no NGC endpoint matched');
    if (fuzzySlug) notes.push(`catalog slug joined by prefix match to '${fuzzySlug}'`);
    if (!card) notes.push('no build.nvidia.com card (legacy or unlisted endpoint)');
    else if (card.type && card.type !== 'endpoint') notes.push(`catalog type is '${card.type}', not 'endpoint'`);

    // pubDate: the build.nvidia.com page HTML createdDate, falling back to the NGC dateCreated when
    // the WAF or a missing payload denies it (verified identical on every sampled model, not a guess)
    const htmlCreated = createdById.get(id) ?? null;
    let createdDate = htmlCreated?.createdDate ?? null;
    if (!createdDate && card?.canonical)
      notes.push(`createdDate unavailable from the page HTML (${htmlCreated?.failure ?? 'not fetched'})`);
    if (!createdDate && ngc?.dateCreated) {
      createdDate = ngc.dateCreated;
      notes.push('pubDate from the NGC dateCreated fallback');
    }

    models.push({
      id,
      alive: 'unprobed',
      label: indexEntry?.label ?? ngc?.displayName ?? card?.title ?? null,
      description: card?.description ?? indexEntry?.description ?? ngc?.description ?? null,
      publisher: card?.publisher ?? (id.includes('/') ? id.slice(0, id.indexOf('/')) : null),
      ctxMeasured: null,
      ctxAdvertised: card?.ctxAdvertised ?? null,
      capabilities: card?.capabilities ?? { tools: null, structuredOutput: null, reasoning: null },
      modalitiesIn: card?.modalitiesIn ?? null,
      modalitiesOut: card?.modalitiesOut ?? null,
      pubDate: isoToPubDate(createdDate),
      catalogUpdated: card?.updated ?? null,
      deprecationDate: ngc?.deprecationDate ?? null,
      lastMonthInvocations: ngc?.lastMonthInvocations ?? null,
      notes,
    });
  }

  const unmatchedNgc = ngcEndpoints.filter((e) => !matchedNgcIds.has(e.resourceId));

  // --- source 4: live probes
  if (key && !options.skipProbes) {
    // ~2.2 requests per model at ~5s each, plus the escalated retries the slow models drag in
    const estimateMin = Math.ceil((models.length * 2.2 * (PROBE_PACING_MS + 3500)) / 60_000);
    console.log(`\n[4/4] live probes: ${models.length} models, serial, ~${estimateMin}-${estimateMin * 2} minutes estimated\n`);

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const progress = `${String(i + 1).padStart(3)}/${models.length}`;

      const liveness = await probeLiveness(key.value, model.id);
      model.alive = liveness.alive;
      model.notes.push(...liveness.notes);

      let ctxLine = '';
      if (liveness.alive === 'alive') {
        const ctx = await probeContextWindow(key.value, model.id);
        model.ctxMeasured = ctx.ctxMeasured;
        if (ctx.note) model.notes.push(ctx.note);
        if (ctx.ctxProbe) model.notes.push(`ctxProbe: ${ctx.ctxProbe}`);
        ctxLine = ctx.ctxMeasured !== null ? ` ctx=${ctx.ctxMeasured}` : ` ctx=${ctx.ctxProbe ?? '?'}`;
      }
      console.log(`  ${progress} [${elapsed(startedAt)}] ${model.id.padEnd(48)} ${model.alive}${ctxLine}`);
    }
  } else {
    console.log('\n[4/4] live probes: skipped, every model stays classified as "unprobed"');
  }

  // --- counts, output, table
  const counts: Record<string, number> = { total: models.length };
  for (const model of models) counts[model.alive] = (counts[model.alive] ?? 0) + 1;
  counts.withCatalogCard = withCard;
  counts.withPubDate = models.filter((m) => m.pubDate).length;
  counts.withDeprecation = models.filter((m) => m.deprecationDate).length;
  counts.withCtxMeasured = models.filter((m) => m.ctxMeasured !== null).length;
  counts.ngcUnmatched = unmatchedNgc.length;

  const sorted = [...models].sort((a, b) => {
    const rank = ALIVE_ORDER.indexOf(a.alive) - ALIVE_ORDER.indexOf(b.alive);
    if (rank) return rank;
    const invocations = (b.lastMonthInvocations ?? -1) - (a.lastMonthInvocations ?? -1);
    return invocations || a.id.localeCompare(b.id);
  });

  // JSON is DIFF-STABLE: sorted by id only, so `git diff harvest-latest.json` across runs surfaces
  // real catalog changes (models added/retired, ctx/caps/deprecation flips) instead of popularity reshuffles.
  // The console table above stays popularity-sorted for human reading.
  const byId = [...models].sort((a, b) => a.id.localeCompare(b.id));
  const output: HarvestFile = { harvestedAt: new Date().toISOString(), counts, models: byId };
  const isPartialRun = options.skipProbes || !!options.only;
  const outFile = isPartialRun ? PREVIEW_FILE : OUTPUT_FILE;
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n');

  printTable(sorted);

  console.log('\n## Counts');
  for (const [key2, value] of Object.entries(counts)) console.log(`  ${key2.padEnd(18)} ${value}`);

  const ctxMismatch = sorted.filter((m) => m.ctxMeasured !== null && m.ctxAdvertised !== null && m.ctxMeasured !== m.ctxAdvertised);
  if (ctxMismatch.length) {
    console.log('\n## Context mismatches (measured vs advertised)');
    for (const model of ctxMismatch)
      console.log(`  ${model.id.padEnd(48)} measured ${String(model.ctxMeasured).padStart(9)}  advertised ${model.ctxAdvertised}`);
  }

  if (unmatchedNgc.length && !options.only) {
    console.log(`\n## NGC entries with no live model id (${unmatchedNgc.length}) - mostly non-chat NIMs (vision, ASR, biology, image gen)`);
    for (const endpoint of unmatchedNgc.sort((a, b) => a.name.localeCompare(b.name)))
      console.log(`  ${endpoint.name.padEnd(48)} ${endpoint.deprecationDate ? `DEPRECATION ${endpoint.deprecationDate}` : ''}`.trimEnd());
  } else if (unmatchedNgc.length) {
    console.log(`\n## NGC entries with no live model id: ${unmatchedNgc.length} (list suppressed under --only)`);
  }
  if (ngcKeyCollisions.length) {
    console.log(`\n## NGC join-key collisions (${ngcKeyCollisions.length})`);
    for (const collision of ngcKeyCollisions) console.log(`  ${collision}`);
  }

  console.log(`\nWrote ${outFile}`);
  if (isPartialRun) console.log('(partial run: wrote the PREVIEW file - the committed harvest-latest.json ledger is only updated by full runs)');
  console.log(`Done in ${elapsed(startedAt)}`);
}


// --- table ---

function printTable(models: HarvestedModel[]): void {
  const header = ['ID', 'ALIVE', 'CTX-MEAS', 'CTX-ADV', 'TSR', 'IN', 'OUT', 'PUBDATE', 'UPDATED', 'DEPREC', 'INVOK'];
  const rows = models.map((model) => [
    model.id,
    model.alive,
    model.ctxMeasured !== null ? String(model.ctxMeasured) : '-',
    model.ctxAdvertised !== null ? String(model.ctxAdvertised) : '-',
    `${fmtCap(model.capabilities.tools)}${fmtCap(model.capabilities.structuredOutput)}${fmtCap(model.capabilities.reasoning)}`,
    model.modalitiesIn?.join('+') ?? '-',
    model.modalitiesOut?.join('+') ?? '-',
    model.pubDate ?? '-',
    model.catalogUpdated?.slice(0, 10).replace(/-/g, '') ?? '-',
    model.deprecationDate ?? '-',
    fmtCount(model.lastMonthInvocations),
  ]);

  const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map((row) => row[column].length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();

  console.log('\n## Harvest table (alive first, by last-month invocations)\n');
  console.log(line(header));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) console.log(line(row));
}


main().catch((error: unknown) => {
  console.error(`\nHarvest failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
