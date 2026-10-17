import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';

import { CMRenderNode, CMRenderTree, CMToolCall, CMTrailingOptions, cmNodeFragments } from './cmRenderTree.types';


/**
 * Returns `prev` wherever `next` is equivalent, so consumers can rely on identity:
 * - the tree, when nothing changed
 * - each node: its predecessor is the previous node of the same kind sharing a fragment, else the one with the same
 *   key; the node keeps the predecessor's key, and its object when every field matches (fragments by reference,
 *   arrays element-wise, tool calls by id)
 * - inside a changed node, the arrays and tool calls that did not change
 */
export function recycleCMRenderTree(prev: CMRenderTree | undefined, next: CMRenderTree): CMRenderTree {
  if (!prev) return next;

  const prevByFragment = new Map<DMessageFragmentId, CMRenderNode>();
  const prevByKey = new Map<string, CMRenderNode>();
  for (const node of prev.nodes) {
    prevByKey.set(node.key, node);
    for (const fragment of cmNodeFragments(node))
      prevByFragment.set(fragment.fId, node);
  }

  // a node inherits a predecessor's key only if no other node is built with it
  const ownKeys = new Set(next.nodes.map(node => node.key));
  const usedKeys = new Set<string>();
  let nodesChanged = prev.nodes.length !== next.nodes.length;

  const nodes = next.nodes.map((node, index) => {
    const predecessor = _findPredecessor(node, prevByFragment, prevByKey, ownKeys, usedKeys);
    let recycled = node;
    if (predecessor) {
      if (predecessor.key !== node.key)
        recycled = { ...node, key: predecessor.key };
      recycled = _recycleNode(predecessor, recycled);
    }
    usedKeys.add(recycled.key);
    if (recycled !== prev.nodes[index]) nodesChanged = true;
    return recycled;
  });

  const trailingOptions = prev.trailingOptions && next.trailingOptions && _sameTrailingOptions(prev.trailingOptions, next.trailingOptions) ? prev.trailingOptions : next.trailingOptions;

  if (!nodesChanged && prev.mode === next.mode && trailingOptions === prev.trailingOptions)
    return prev;
  return { mode: next.mode, nodes: nodesChanged ? nodes : prev.nodes, trailingOptions };
}


function _findPredecessor(node: CMRenderNode, prevByFragment: ReadonlyMap<DMessageFragmentId, CMRenderNode>, prevByKey: ReadonlyMap<string, CMRenderNode>, ownKeys: ReadonlySet<string>, usedKeys: ReadonlySet<string>): CMRenderNode | undefined {
  const eligible = (candidate: CMRenderNode | undefined): candidate is CMRenderNode =>
    !!candidate && candidate.kind === node.kind && !usedKeys.has(candidate.key) && (candidate.key === node.key || !ownKeys.has(candidate.key));
  for (const fragment of cmNodeFragments(node)) {
    const candidate = prevByFragment.get(fragment.fId);
    if (eligible(candidate)) return candidate;
  }
  const byKey = prevByKey.get(node.key);
  return eligible(byKey) ? byKey : undefined;
}

function _recycleNode(prev: CMRenderNode, next: CMRenderNode): CMRenderNode {
  // nested values with their own identity first, then the node by its fields
  if (prev.kind === 'tool-calls' && next.kind === 'tool-calls')
    next = { ...next, calls: _recycleItems(prev.calls, next.calls, call => call.invocation.fId, _sameToolCall) };
  if (prev.kind === 'text' && next.kind === 'text' && prev.trailingOptions && next.trailingOptions && _sameTrailingOptions(prev.trailingOptions, next.trailingOptions))
    next = { ...next, trailingOptions: prev.trailingOptions };
  return _recycleFields(prev, next);
}

/** `prev` when every field is the same (arrays element-wise); otherwise `next`, with the unchanged arrays taken from `prev`. */
function _recycleFields<T extends object>(prev: T, next: T): T {
  const keys = Object.keys(next) as (keyof T)[];
  let same = keys.length === Object.keys(prev).length;
  let copy: T | null = null;
  for (const key of keys) {
    const p = prev[key], n = next[key];
    if (Object.is(p, n)) continue;
    if (Array.isArray(p) && Array.isArray(n) && _sameItems(p, n)) {
      (copy ??= { ...next })[key] = p;
      continue;
    }
    same = false;
  }
  return same ? prev : (copy ?? next);
}

/** Items matched by key keep their previous object when `same`; the previous array when nothing moved or changed. */
function _recycleItems<T>(prev: readonly T[], next: readonly T[], keyOf: (item: T) => string, same: (p: T, n: T) => boolean): readonly T[] {
  const prevByKey = new Map(prev.map(item => [keyOf(item), item]));
  let changed = prev.length !== next.length;
  const items = next.map((item, index) => {
    const p = prevByKey.get(keyOf(item));
    const recycled = p !== undefined && same(p, item) ? p : item;
    if (recycled !== prev[index]) changed = true;
    return recycled;
  });
  return changed ? items : prev;
}

function _sameToolCall(p: CMToolCall, n: CMToolCall): boolean {
  return p.invocation === n.invocation && p.response === n.response;
}

function _sameTrailingOptions(p: CMTrailingOptions, n: CMTrailingOptions): boolean {
  return p.fragmentId === n.fragmentId && p.suffix === n.suffix && _sameItems(p.options, n.options);
}

function _sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
}
