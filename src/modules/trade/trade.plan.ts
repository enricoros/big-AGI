/**
 * Trade planner: relates the items of the loaded files to the local items, before anything is written.
 *
 * Pure: no stores, no clocks, no time. What a kind of data means lives in its adapter's relate();
 * tradeRelateByContent is the default any JSON entity can use.
 */

import { analyzeMerge } from '~/common/util/mergeUtils';

import type { TradeAdapter, TradeItem, TradeOp, TradeRejected, TradeRelated, TradeRelation, TradeResolution, TradeSection } from './trade.types';


export interface TradePlanRow {
  id: string;
  incoming: TradeItem;
  local?: TradeItem;                    // absent for 'new' and 'removed'
  relation: TradeRelation;
  merged?: unknown;                     // for 'mergeable'
}

/** What to do with the conflicts no row has decided: null asks for each. */
export type TradeConflictPolicy = null | 'accept-incoming' | 'accept-local' | 'keep-both';

export interface TradePreviewGroup {
  adapter: TradeAdapter;
  rows: TradePlanRow[];
  rejected: TradeRejected[];
}


/**
 * What importing the sections would do, per adapter that has something to read. Nothing is written.
 * Sections no adapter reads are returned, so they can be named.
 */
export async function tradePreview(sections: readonly TradeSection[], adapters: readonly TradeAdapter[]): Promise<{ groups: TradePreviewGroup[], unread: TradeSection[] }> {
  const groups: TradePreviewGroup[] = [];
  for (const adapter of adapters) {
    const adapterSections = sections.filter(section => section.type === adapter.type);
    if (!adapterSections.length) continue;
    if (adapter.unavailable) {
      groups.push({ adapter, rows: [], rejected: [] });
      continue;
    }
    const { items: localItems, removedIds } = await adapter.localItems();
    const local = new Map(localItems.map(item => [item.id, item]));
    const incoming: TradeItem[] = [];
    const rejected: TradeRejected[] = [];
    for (const section of adapterSections) {
      const read = adapter.readSection(section, local);
      incoming.push(...read.items);
      rejected.push(...read.rejected);
    }
    const plan = tradePlan(incoming, local, new Set(removedIds), adapter.relate);
    groups.push({ adapter, rows: plan.rows, rejected: [...rejected, ...plan.rejected] });
  }
  return { groups, unread: sections.filter(section => !adapters.some(adapter => adapter.type === section.type)) };
}


/**
 * One row per id. Several copies of one id in the loaded files are folded first, with the same relate():
 * equal copies collapse and a successor replaces its ancestor, whatever the order of the files.
 */
export function tradePlan(
  incoming: readonly TradeItem[],
  local: ReadonlyMap<string, TradeItem>,
  removedIds: ReadonlySet<string>,
  relate: (incoming: TradeItem, local: TradeItem) => TradeRelated,
): { rows: TradePlanRow[], rejected: TradeRejected[] } {

  const rows: TradePlanRow[] = [];
  const rejected = new Map<string, string>();

  // a file is untrusted input: what cannot be compared is one rejected item, not a failed import
  const relateOrReject = (item: TradeItem, other: TradeItem): TradeRelated | null => {
    try {
      return relate(item, other);
    } catch {
      rejected.set(item.id, 'Could not be compared');
      return null;
    }
  };

  const heads = new Map<string, TradeItem>();
  for (const item of incoming) {
    const head = heads.get(item.id);
    const related = head ? relateOrReject(item, head) : { relation: 'ahead' as const };
    if (related?.relation === 'ahead')
      heads.set(item.id, item);
    else if (related && related.relation !== 'same' && related.relation !== 'behind')
      rejected.set(item.id, 'The files hold different versions of this item: import them one at a time');
  }

  for (const [id, item] of heads) {
    if (rejected.has(id)) continue;
    const localItem = local.get(id);
    const related = localItem ? relateOrReject(item, localItem) : { relation: removedIds.has(id) ? 'removed' as const : 'new' as const };
    if (related)
      rows.push({ id, incoming: item, ...(localItem && { local: localItem }), ...related });
  }
  return { rows, rejected: [...rejected].map(([id, reason]) => ({ id, reason })) };
}


/** What a row does when nothing was chosen for it: null writes nothing. */
export function tradeDefaultResolution(relation: TradeRelation, onConflict: TradeConflictPolicy): TradeResolution | null {
  switch (relation) {
    case 'new':
      return 'add';
    case 'ahead':
      return 'accept-incoming';
    case 'mergeable':
      return 'merge';
    case 'conflict':
      return onConflict;
    case 'same':
    case 'behind':
    case 'removed':
      return null;
  }
}

/** The resolutions a row can be given, besides writing nothing. */
export function tradeResolutionChoices(relation: TradeRelation): TradeResolution[] {
  switch (relation) {
    case 'new':
      return ['add'];
    case 'ahead':
    case 'behind':
      return ['accept-incoming'];
    case 'mergeable':
      return ['merge', 'accept-incoming', 'accept-local', 'keep-both'];
    case 'conflict':
      return ['accept-incoming', 'accept-local', 'keep-both'];
    case 'removed':
      return ['keep-both'];
    case 'same':
      return [];
  }
}

/** The operations to apply: each row's own choice when it has one, otherwise its default. */
export function tradePlanOps(rows: readonly TradePlanRow[], chosen: ReadonlyMap<string, TradeResolution | null>, onConflict: TradeConflictPolicy): TradeOp[] {
  const ops: TradeOp[] = [];
  for (const row of rows) {
    const resolution = chosen.has(row.id) ? chosen.get(row.id)! : tradeDefaultResolution(row.relation, onConflict);
    if (resolution)
      ops.push({ item: row.incoming, ...(row.local && { local: row.local }), relation: row.relation, resolution, ...(resolution === 'merge' && { merged: row.merged }) });
  }
  return ops;
}


/**
 * Relates two versions of a JSON entity by content alone, with no common base and no timestamps:
 * - the side that only adds is the successor
 * - additions on both sides merge
 * - a value, or an array item with the same id, that differs on the two sides is a conflict
 *
 * ignoreKeys are left out at every depth: what a device rewrites on its own. Undefined values and
 * empty arrays read as absent: the chat stores write 'userFlags: []' on load where a new message has none.
 * An item deleted on one side reads as an addition of the other.
 */
export function tradeRelateByContent(incoming: unknown, local: unknown, ignoreKeys: ReadonlySet<string>): TradeRelated {
  const analysis = analyzeMerge(_withoutAbsent(local), _withoutAbsent(incoming), ignoreKeys);
  if (!analysis.canMerge) return { relation: 'conflict' };
  if (!analysis.serverOnlyCount) return { relation: analysis.localOnlyCount ? 'behind' : 'same' };
  if (!analysis.localOnlyCount) return { relation: 'ahead' };
  return { relation: 'mergeable', merged: analysis.merged };
}

function _withoutAbsent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(_withoutAbsent);
  if (!value || typeof value !== 'object') return value;
  const present: Record<string, unknown> = {};
  for (const [key, keyValue] of Object.entries(value)) {
    if (keyValue === undefined || key === '__proto__') continue;
    if (Array.isArray(keyValue) && !keyValue.length) continue;
    present[key] = _withoutAbsent(keyValue);
  }
  return present;
}
