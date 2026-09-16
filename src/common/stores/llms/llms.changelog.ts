//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from './llms.types';
import type { DModelsServiceId } from './llms.service.types';


// configuration
const DEBUG_CHANGES = false; // [DEV] console.log the before/after of every changed field per model, to see what a vendor actually churns


/**
 * Changelog entry - the outcome of listing one service's models in one update operation (data object, stored).
 * One entry per service per operation; `at` is the operation start, shared by every service of the same batch.
 * Model refs are DLLM ids minus the `${sId}-` prefix (see _llmsChangelogRefOf), to keep entries small.
 */
export interface DModelsChangelogEntry {
  readonly at: number;          // epoch ms of the operation
  readonly sId: DModelsServiceId;
  via: DModelsChangelogVia;
  n?: number;                   // models listed; absent on error
  add?: string[];               // added model refs; absent on a service's first listing (a creation, not N additions); capped
  rem?: string[];               // removed model refs (user clones never count); capped
  mod?: Record<string, string>; // changed models: ref -> change letters, e.g. 'cp'; capped
  err?: string;                 // single-line failure message; the listing wrote nothing (a caller may still clear the service)
}

/**
 * What the operation listed:
 * - 'service': a single service (menu item, vendor setup button, wizard, or the auto-listing of a service without models)
 * - 'all': every eligible service (dialog title/menu, or a future home surface)
 * - 'boot': the startup refresh of services whose model definitions changed (see llm.client.defs.ts)
 */
export type DModelsChangelogVia = 'service' | 'all' | 'boot';


/**
 * Change letters - FROZEN, append-only: letters are storage, the UI renders the words.
 * Renderers must tolerate unknown letters (written by a newer build) by showing 'changed'.
 * Structured fields compare by value, not by stored shape: pricing through its price values only
 * (a build that reshapes the pricing object, e.g. dropping the wire `cType` tag, is not a price change),
 * parameterSpecs and benchmark through canonical JSON (key and spec order do not count).
 * Not compared: created/updated (vendor churn, e.g. TogetherAI re-stamps `created` on redeploys),
 * description (vendor prose churn), initialParameters (derived from maxOutputTokens and parameterSpecs),
 * user* overrides, and user clones.
 */
const _MODELS_CHANGELOG_LETTER_WORDS = {
  l: 'name',
  c: 'context',
  o: 'output limit',
  i: 'capabilities',
  p: 'pricing',
  s: 'parameters',
  h: 'hidden',
  v: 'shown',
  r: 'release date',
  b: 'benchmark',
} as const satisfies Record<string, string>;
// export type DModelsChangelogLetter = keyof typeof _MODELS_CHANGELOG_LETTER_WORDS;


/**
 * A change is meaningful unless it is noise: editorial (benchmark refreshes; hidden/shown curation, the model is still listed)
 * or the output limit (aggregators report the limit of whichever provider is on top, so it flaps)
 */
const _MEANINGFUL_LETTER = /[^bhvo]/;

/** Capability, context and price changes survive a capped `mod` map first */
const _PRIORITY_LETTER = /[cip]/;

/**
 * Routers advertise the price, context and output limit of whichever provider they rank first at the
 * moment (OpenRouter: 22 providers behind one DeepSeek model, prices 0.58 to 1.65 per M input, probed
 * 2026-09-16), so those three letters are not tracked for them: a routing swing is not a model change.
 */
const _ROUTER_VENDORS: ReadonlyArray<ModelVendorId> = ['openrouter'];

export function llmsChangelogIsRouter(vId: ModelVendorId): boolean {
  return _ROUTER_VENDORS.includes(vId);
}


// caps and retention (enforced by llmsDiffServiceModels and llmsChangelogPruneEntries; the UI shows '+' at the cap)
export const MODELS_CHANGELOG_REF_CAP = 32;                   // max refs per add/rem/mod
const MODELS_CHANGELOG_MAX_AGE_MS = 30 /* days */ * 24 * 60 * 60 * 1000;
const MODELS_CHANGELOG_MAX_ENTRIES = 50;                      // with the ref caps, this is the byte bound too (~2.5K chars per entry at worst)
const MODELS_CHANGELOG_ERR_MAX_LEN = 160;


/// Refs ///

/**
 * DLLM id -> ref stored in the log. Ids are `${sId}-${vendorModelId}` (variants append to the full id, service
 * ids contain dashes: slice, never split); the inverse is the same concatenation, should a surface ever look a ref up.
 */
function _llmsChangelogRefOf(sId: DModelsServiceId, llmId: DLLMId): string {
  return llmId.startsWith(sId + '-') ? llmId.slice(sId.length + 1) : llmId;
}


/// Diff ///

/**
 * Pure diff of a service's models: the previously stored factory models vs the freshly listed ones.
 * Compares factory fields only (never user edits), ignores user clones, and records a first listing as `{ n }`.
 */
export function llmsDiffServiceModels(sId: DModelsServiceId, previousServiceLLMs: ReadonlyArray<DLLM>, updatedServiceLLMs: ReadonlyArray<DLLM>): Pick<DModelsChangelogEntry, 'n' | 'add' | 'rem' | 'mod'> {

  const result: Pick<DModelsChangelogEntry, 'n' | 'add' | 'rem' | 'mod'> = { n: updatedServiceLLMs.length };

  // previous factory models, by id
  const previous = new Map<DLLMId, DLLM>();
  for (const llm of previousServiceLLMs)
    if (!llm.isUserClone)
      previous.set(llm.id, llm);

  // first listing: a creation, not N additions
  if (!previous.size)
    return result;

  const add: string[] = [];
  const mod: [ref: string, letters: string][] = [];
  for (const llm of updatedServiceLLMs) {
    const before = previous.get(llm.id);
    if (!before) {
      add.push(_llmsChangelogRefOf(sId, llm.id));
      continue;
    }
    previous.delete(llm.id);
    const letters = _changeLetters(before, llm);
    if (letters)
      mod.push([_llmsChangelogRefOf(sId, llm.id), letters]);
  }
  const rem = [...previous.keys()].map(id => _llmsChangelogRefOf(sId, id));

  if (add.length)
    result.add = add.slice(0, MODELS_CHANGELOG_REF_CAP);
  if (rem.length)
    result.rem = rem.slice(0, MODELS_CHANGELOG_REF_CAP);
  if (mod.length) {
    const rank = (m: [string, string]) => _PRIORITY_LETTER.test(m[1]) ? 0 : 1; // stable sort keeps the listing order within each group
    result.mod = Object.fromEntries(mod.sort((a, b) => rank(a) - rank(b)).slice(0, MODELS_CHANGELOG_REF_CAP));
  }
  return result;
}

function _changeLetters(before: DLLM, after: DLLM): string {
  const changes: [letter: string, before: unknown, after: unknown][] = [];
  const check = (letter: string, b: unknown, a: unknown) => {
    if (b !== a) changes.push([letter, b, a]);
  };
  const routed = llmsChangelogIsRouter(after.vId); // price, context and output limit follow the routing: not tracked
  check('l', before.label, after.label);
  if (!routed) check('c', before.contextTokens, after.contextTokens);
  if (!routed) check('o', before.maxOutputTokens, after.maxOutputTokens);
  check('i', _sortedListKey(before.interfaces), _sortedListKey(after.interfaces));
  if (!routed) check('p', _pricingKey(before.pricing), _pricingKey(after.pricing));
  check('s', _specsKey(before.parameterSpecs), _specsKey(after.parameterSpecs));
  // noinspection PointlessBooleanExpressionJS
  if (!!before.hidden !== !!after.hidden) {
    // noinspection PointlessBooleanExpressionJS
    changes.push([after.hidden ? 'h' : 'v', !!before.hidden, !!after.hidden]);
  }
  check('r', before.pubDate ?? '', after.pubDate ?? '');
  check('b', _canonicalJson(before.benchmark), _canonicalJson(after.benchmark));
  const letters = changes.map(([letter]) => letter).join('');
  if (DEBUG_CHANGES && letters)
    console.log(`[changelog] ${after.id}: ${letters}`, Object.fromEntries(changes.map(([letter, b, a]) => [(_MODELS_CHANGELOG_LETTER_WORDS as Record<string, string>)[letter] ?? letter, { before: b, after: a }])));
  return letters;
}

/** Order-insensitive key: a reordered list is not a change. */
function _sortedListKey(list: ReadonlyArray<string> | undefined): string {
  return list?.length ? [...list].sort().join('\n') : '';
}

/**
 * Price values only: input, output, cache read/write, per-call tool fees. Tags, derived flags
 * (`_isFree`) and informational fields (`cache.duration`) are not prices; a stored object from an
 * older build with a different shape compares equal as long as the prices are.
 */
function _pricingKey(pricing: DLLM['pricing']): string {
  const chat = pricing?.chat;
  return !chat ? '' : _canonicalJson({ i: chat.input, o: chat.output, cr: chat.cache?.read, cw: chat.cache?.write, t: chat.tools });
}

/** Specs by paramId, canonical: spec order and key order do not count. */
function _specsKey(specs: DLLM['parameterSpecs'] | undefined): string {
  return !specs?.length ? '' : _canonicalJson([...specs].sort((a, b) => a.paramId < b.paramId ? -1 : a.paramId > b.paramId ? 1 : 0));
}

/** JSON with object keys sorted at every level (arrays keep their order); '' for undefined. */
function _canonicalJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, (_key, v) =>
    (v && typeof v === 'object' && !Array.isArray(v))
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
      : v,
  );
}


/// Entry predicates and rendering helpers ///

/** Neither changes nor an error: a check that found the models as they were. */
export function llmsChangelogIsEventless(entry: DModelsChangelogEntry): boolean {
  return !entry.err && !entry.add?.length && !entry.rem?.length && !entry.mod;
}

/** Additions, removals, or a change beyond the noise letters: what the user calls 'the last change'. */
export function llmsChangelogIsMeaningful(entry: DModelsChangelogEntry): boolean {
  return !!(entry.add?.length || entry.rem?.length) || Object.values(entry.mod ?? {}).some(letters => _MEANINGFUL_LETTER.test(letters));
}

/** 'cp' -> 'context, pricing'; unknown letters (newer builds) render as 'changed'. */
export function llmsChangelogWords(letters: string): string {
  const words: string[] = [];
  for (const letter of letters) {
    const word = (_MODELS_CHANGELOG_LETTER_WORDS as Record<string, string>)[letter] ?? 'changed';
    if (!words.includes(word))
      words.push(word);
  }
  return words.join(', ');
}

/** Single-line, bounded message for `err` (no stacks, no payloads). */
export function llmsChangelogErrorText(error: unknown): string {
  const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, MODELS_CHANGELOG_ERR_MAX_LEN) || 'Unknown error';
}


/// Retention ///

/**
 * Bounds the log (returned newest first, input order does not matter):
 * 1. coalesce per service: only the newest no-change check is kept (it is the 'last checked' fact, older ones say nothing); a run of identical errors keeps only the newest
 * 2. pins: per service, the newest entry ('checked'), the newest meaningful entry ('last change') and the newest successful listing always survive
 * 3. keep entries younger than 30 days, at most 50
 */
export function llmsChangelogPruneEntries(entries: ReadonlyArray<DModelsChangelogEntry>, nowMs: number = Date.now()): DModelsChangelogEntry[] {

  // 1. coalesce (sort is stable: same-instant entries keep their relative order)
  const newestKept = new Map<DModelsServiceId, DModelsChangelogEntry>();
  const seenEventless = new Set<DModelsServiceId>();
  const coalesced: DModelsChangelogEntry[] = [];
  for (const entry of [...entries].sort((a, b) => b.at - a.at)) {
    if (llmsChangelogIsEventless(entry)) {
      if (seenEventless.has(entry.sId)) continue;
      seenEventless.add(entry.sId);
    } else if (entry.err !== undefined && newestKept.get(entry.sId)?.err === entry.err)
      continue;
    newestKept.set(entry.sId, entry);
    coalesced.push(entry);
  }

  // 2. pins: per service, the newest entry of each kind
  const pinned = new Set<DModelsChangelogEntry>();
  const pinNewest = (test: (entry: DModelsChangelogEntry) => boolean) => {
    const seen = new Set<DModelsServiceId>();
    for (const entry of coalesced)
      if (!seen.has(entry.sId) && test(entry)) {
        seen.add(entry.sId);
        pinned.add(entry);
      }
  };
  pinNewest(() => true); // 'checked'
  pinNewest(llmsChangelogIsMeaningful); // 'last change'
  pinNewest(entry => !entry.err); // last successful listing, kept behind a failure

  // 3. age and count bounds
  const minAt = nowMs - MODELS_CHANGELOG_MAX_AGE_MS;
  return coalesced.filter((entry, index) => pinned.has(entry) || (entry.at >= minAt && index < MODELS_CHANGELOG_MAX_ENTRIES));
}
