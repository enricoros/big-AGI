/// <reference types="node" />

// Pure tests for the render tree: grouping rules, and the identity guarantees of the recycler across fragment updates.
// Run: `NODE_ENV=development npx tsx --test src/apps/chat/components/message/render-tree/cmRenderTree.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import type { Immutable } from '../../../../../common/types/immutable.types';
import { create_FunctionCallInvocation_ContentFragment, create_FunctionCallResponse_ContentFragment, createAnnotationsVoidFragment, createDMessageDataInlineText, createDocAttachmentFragment, createDVoidWebCitation, createModelAuxVoidFragment, createPlaceholderVoidFragment, createTextContentFragment, createZyncAssetReferenceAttachmentFragment, DMessageFragment } from '../../../../../common/stores/chat/chat.fragments';

import { buildCMRenderTree, CMBuildOptions } from './cmRenderTree.build';
import { CMRenderMode, CMRenderNode, CMRenderTree, cmNodeFragments } from './cmRenderTree.types';
import { recycleCMRenderTree } from './cmRenderTree.recycle';


// fragment factories
const text = (t: string) => createTextContentFragment(t);
const reasoning = (t: string, signature?: string) => createModelAuxVoidFragment('reasoning', t, signature);
const citation = (url: string) => createAnnotationsVoidFragment([createDVoidWebCitation(url, url)]);
const image = (name: string) => createZyncAssetReferenceAttachmentFragment(name, '', `uuid-${name}`, undefined, 'image');
const doc = (name: string) => createDocAttachmentFragment(name, '', 'text/plain', createDMessageDataInlineText(name), `ref-${name}`, 1);
const placeholder = (t: string) => createPlaceholderVoidFragment(t);
const call = (id: string, name = 'fn') => create_FunctionCallInvocation_ContentFragment(id, name, '{}');
const result = (id: string, name = 'fn') => create_FunctionCallResponse_ContentFragment(id, false, name, 'ok', 'upstream');
const withOrigin = <T extends DMessageFragment>(fragment: T, originId: string): T => ({ ...fragment, originId });
/** A streamed update: the same fragment id with new content, as the store produces it. */
const grown = <T extends { part: object }>(fragment: T, grow: (part: T['part']) => T['part']): T => ({ ...fragment, part: grow(fragment.part) });

// inspection
const build = (fragments: Immutable<DMessageFragment[]>, mode: CMRenderMode = 'view', options?: CMBuildOptions) => buildCMRenderTree(fragments, mode, options);
const kinds = (tree: CMRenderTree) => tree.nodes.map(node => node.kind);
const members = (node: CMRenderNode) => cmNodeFragments(node).map(fragment => fragment.fId);
const membership = (tree: CMRenderTree) => tree.nodes.map(members);
const fIds = (...fragments: DMessageFragment[]) => fragments.map(fragment => fragment.fId);
function nodeOfKind<K extends CMRenderNode['kind']>(tree: CMRenderTree, kind: K, nth = 0): Extract<CMRenderNode, { kind: K }> {
  const found = tree.nodes.filter((node): node is Extract<CMRenderNode, { kind: K }> => node.kind === kind)[nth];
  assert.ok(found, `expected a '${kind}' node (#${nth}) in [${kinds(tree)}]`);
  return found;
}


describe('CMRenderTree: grouping', () => {

  // the reference message: r1 r2 t1 i1 d1 d2 i2 i3 t2 r3 fc1 t3 fr1 fc2 fr2
  const r1 = reasoning('r1'), r2 = reasoning('r2'), t1 = text('t1'), i1 = image('i1'), d1 = doc('d1'), d2 = doc('d2'), i2 = image('i2'), i3 = image('i3');
  const t2 = text('t2'), r3 = reasoning('r3'), fc1 = call('c1'), t3 = text('t3'), fr1 = result('c1'), fc2 = call('c2'), fr2 = result('c2');
  const reference = [r1, r2, t1, i1, d1, d2, i2, i3, t2, r3, fc1, t3, fr1, fc2, fr2];

  it('view: fuses adjacent runs, pairs each response with its invocation wherever it sits', () => {
    const tree = build(reference);
    assert.deepEqual(kinds(tree), ['reasoning', 'text', 'images', 'documents', 'images', 'text', 'reasoning', 'tool-calls', 'text', 'tool-calls']);
    assert.deepEqual(membership(tree), [fIds(r1, r2), fIds(t1), fIds(i1), fIds(d1, d2), fIds(i2, i3), fIds(t2), fIds(r3), fIds(fc1, fr1), fIds(t3), fIds(fc2, fr2)]);
    const group1 = nodeOfKind(tree, 'tool-calls', 0), group2 = nodeOfKind(tree, 'tool-calls', 1);
    assert.deepEqual(group1.calls.map(c => [c.id, c.invocation, c.response]), [['c1', fc1, fr1]]);
    assert.equal(group1.sealed, true, 'text follows the first group');
    assert.equal(group2.sealed, false, 'nothing follows the last group');
    assert.equal(tree.trailingOptions, null);
  });

  it('edit: one node per text-like fragment in place, adjacent attachments of any kind fused, reasoning as in view', () => {
    const tree = build(reference, 'edit');
    assert.deepEqual(kinds(tree), ['reasoning', 'edit-text', 'edit-attachments', 'edit-text', 'reasoning', 'edit-text', 'edit-text', 'edit-text', 'edit-text', 'edit-text']);
    assert.deepEqual(membership(tree), [fIds(r1, r2), fIds(t1), fIds(i1, d1, d2, i2, i3), fIds(t2), fIds(r3), fIds(fc1), fIds(t3), fIds(fr1), fIds(fc2), fIds(fr2)]);
  });

  it('hoists citations to one leading node and fuses the text around them', () => {
    const r = reasoning('r'), ts = [text('t1'), text('t2'), text('t3'), text('t4'), text('t5')], cs = [citation('a'), citation('b'), citation('c')];
    const tree = build([r, ts[0], cs[0], ts[1], cs[1], ts[2], ts[3], cs[2], ts[4]]);
    assert.deepEqual(kinds(tree), ['citations', 'reasoning', 'text']);
    assert.deepEqual(membership(tree), [fIds(...cs), fIds(r), fIds(...ts)]);
    assert.equal(tree.nodes[0].key, 'citations');
    // edit mode keeps the citations node (no edit node) and the texts apart
    assert.deepEqual(kinds(build([ts[0], cs[0], ts[1]], 'edit')), ['citations', 'edit-text', 'edit-text']);
  });

  it('hidden fragments leave the sequence, their neighbors fuse', () => {
    const t1 = text('t1'), r = reasoning('r'), t2 = text('t2'), fc1 = call('c1'), fc2 = call('c2');
    const isVisible = (fragment: Immutable<DMessageFragment>) => fragment.ft !== 'void';
    assert.deepEqual(membership(build([t1, r, t2], 'view', { isVisible })), [fIds(t1, t2)]);
    assert.deepEqual(membership(build([fc1, r, fc2], 'view', { isVisible })), [fIds(fc1, fc2)]);
    assert.deepEqual(membership(build([fc1, r, fc2])), [fIds(fc1), fIds(r), fIds(fc2)], 'visible reasoning closes the group');
  });

  it('placeholders are transparent to an open tool group, orphan responses stand alone', () => {
    const fc1 = call('c1'), ph = placeholder('working'), fc2 = call('c2'), orphan = result('c9');
    const tree = build([fc1, ph, fc2, orphan]);
    assert.deepEqual(kinds(tree), ['tool-calls', 'placeholder', 'tool-response']);
    assert.deepEqual(members(tree.nodes[0]), fIds(fc1, fc2));
    assert.equal(nodeOfKind(tree, 'tool-calls').sealed, true);
  });

  it('activity placeholders span runs, notices close them', () => {
    const r1 = reasoning('r1'), ph = placeholder('searching'), r2 = reasoning('r2'), t1 = text('t1'), notice = createPlaceholderVoidFragment('note', 'notice'), t2 = text('t2');
    const spanned = build([r1, ph, r2]);
    assert.deepEqual(kinds(spanned), ['reasoning', 'placeholder']);
    assert.deepEqual(members(spanned.nodes[0]), fIds(r1, r2));
    assert.deepEqual(kinds(build([t1, notice, t2])), ['text', 'placeholder', 'text']);
  });

  it('proposal invocations get their own node with their response, and close the group before them', () => {
    const fc1 = call('c1'), fp = call('c2', 'propose_rename'), frp = result('c2', 'propose_rename'), fc3 = call('c3');
    const tree = build([fc1, fp, frp, fc3], 'view', { proposalToolNames: new Set(['propose_rename']) });
    assert.deepEqual(kinds(tree), ['tool-calls', 'tool-proposal', 'tool-calls']);
    const proposal = nodeOfKind(tree, 'tool-proposal');
    assert.equal(proposal.fragment, fp);
    assert.equal(proposal.response, frp);
    assert.equal(nodeOfKind(tree, 'tool-calls', 0).sealed, true);
    assert.equal(nodeOfKind(tree, 'tool-calls', 1).sealed, false);
  });

  it('unclaimed responses of proposal tools leave the sequence and the group open', () => {
    const fc1 = call('a'), fr1 = result('a'), orphan = result('zz', 'propose_note'), fc2 = call('b'), fr2 = result('b');
    const tree = build([fc1, fr1, orphan, fc2, fr2], 'view', { proposalToolNames: new Set(['propose_note']) });
    assert.deepEqual(kinds(tree), ['tool-calls']);
    assert.deepEqual(members(tree.nodes[0]), fIds(fc1, fr1, fc2, fr2));
    assert.equal(nodeOfKind(tree, 'tool-calls').sealed, false);
    assert.deepEqual(kinds(build([fc1, fr1, orphan, fc2, fr2])), ['tool-calls', 'tool-response', 'tool-calls'], 'any other orphan stands alone');
  });

  it('cuts trailing options only when the text is the last fragment', () => {
    const fc = call('c1'), fr = result('c1'), t = text('Next?\n- a\n- b');
    assert.equal(build([fc, t, fr], 'view', { trailingOptions: true }).trailingOptions, null, 'a claimed response still follows the text');
    assert.notEqual(build([fc, fr, t], 'view', { trailingOptions: true }).trailingOptions, null);
  });

  it('separates the fragments of different origins', () => {
    const a1 = withOrigin(text('a1'), 'ray-1'), a2 = withOrigin(text('a2'), 'ray-1'), b1 = withOrigin(reasoning('b1'), 'ray-2'), b2 = withOrigin(text('b2'), 'ray-2');
    const tree = build([a1, a2, b1, b2]);
    assert.deepEqual(kinds(tree), ['text', 'separator', 'reasoning', 'text']);
    assert.deepEqual(members(tree.nodes[0]), fIds(a1, a2));
    assert.deepEqual(kinds(build([text('plain'), a1])), ['text'], 'the first stamped fragment sets the origin without a separator');
    assert.deepEqual(kinds(build([a1, { ...text('x'), originId: undefined }])), ['text'], 'an undefined originId is unstamped');
    assert.deepEqual(kinds(build([a1, withOrigin(image('i'), 'ray-2'), a2])), ['text', 'images', 'text'], 'attachments do not take part');
  });

  it('edit: reasoning is not editable, it keeps its chip and its continuity data', () => {
    const vehicle = reasoning('', 'sig'), redacted = createModelAuxVoidFragment('reasoning', '', undefined, ['blob']), t = text('t'), ph = placeholder('p');
    assert.deepEqual(kinds(build([vehicle, redacted, t, ph], 'edit')), ['reasoning', 'edit-text', 'placeholder']);
    assert.deepEqual(kinds(build([vehicle, redacted, t, ph])), ['reasoning', 'text', 'placeholder']);
  });

  it('cuts a trailing option list off the last text node when asked', () => {
    const t1 = text('Intro'), t2 = text('Pick one:\n- Red\n- Blue\n');
    const on = build([t1, t2], 'view', { trailingOptions: true });
    assert.deepEqual(on.trailingOptions, { fragmentId: t2.fId, options: ['Red', 'Blue'], suffix: '\n- Red\n- Blue\n' });
    assert.equal(nodeOfKind(on, 'text').trailingOptions, on.trailingOptions, 'one object, on the node and on the tree');
    assert.equal(nodeOfKind(build([t1, t2]), 'text').trailingOptions, undefined, 'off by default');
    assert.equal(build([t1, t2], 'edit', { trailingOptions: true }).trailingOptions, null, 'never in edit mode');
    assert.equal(build([t2, doc('d')], 'view', { trailingOptions: true }).trailingOptions, null, 'only when the message ends with text');
  });

  it('ungrouped: one node per fragment in stored order, no claimed responses', () => {
    const tree = build(reference, 'view', { ungrouped: true });
    assert.deepEqual(kinds(tree), ['reasoning', 'reasoning', 'text', 'images', 'documents', 'documents', 'images', 'images', 'text', 'reasoning', 'tool-calls', 'text', 'tool-response', 'tool-calls', 'tool-response']);
    assert.deepEqual(membership(tree), reference.map(fragment => [fragment.fId]));
    assert.deepEqual(nodeOfKind(tree, 'tool-calls', 0).calls.map(c => [c.id, c.invocation, c.response]), [['c1', fc1, null]]);
    assert.deepEqual(nodeOfKind(tree, 'tool-calls', 1).calls.map(c => [c.id, c.invocation, c.response]), [['c2', fc2, null]]);
    assert.equal(recycleCMRenderTree(tree, build(reference, 'view', { ungrouped: true })), tree, 'a rebuild recycles to the same tree');
  });

  it('ungrouped: citations stay in place, proposal responses stand alone', () => {
    const r = reasoning('r'), ts = [text('t1'), text('t2'), text('t3'), text('t4'), text('t5')], cs = [citation('a'), citation('b'), citation('c')];
    const fragments = [r, ts[0], cs[0], ts[1], cs[1], ts[2], ts[3], cs[2], ts[4]];
    const tree = build(fragments, 'view', { ungrouped: true });
    assert.deepEqual(kinds(tree), ['reasoning', 'text', 'citations', 'text', 'citations', 'text', 'text', 'citations', 'text']);
    assert.deepEqual(membership(tree), fragments.map(fragment => [fragment.fId]));
    assert.deepEqual(tree.nodes.filter(node => node.kind === 'citations').map(node => node.key), cs.map(c => `citations:${c.fId}`), 'keyed in place, not hoisted');
    const fp = call('c1', 'propose_rename'), frp = result('c1', 'propose_rename');
    const proposals = build([fp, frp], 'view', { proposalToolNames: new Set(['propose_rename']), ungrouped: true });
    assert.deepEqual(kinds(proposals), ['tool-proposal', 'tool-response']);
    assert.equal(nodeOfKind(proposals, 'tool-proposal').response, null);
  });

});


describe('CMRenderTree: recycling', () => {

  it('returns the previous tree for an equivalent build', () => {
    const fragments = [reasoning('r'), text('t'), image('i'), call('c1'), result('c1')];
    const tree = build(fragments);
    assert.equal(recycleCMRenderTree(tree, build(fragments)), tree);
    assert.equal(recycleCMRenderTree(undefined, tree), tree);
  });

  it('removing a transient placeholder changes no node', () => {
    const r1 = reasoning('r1'), ph = placeholder('searching'), r2 = reasoning('r2');
    const streaming = build([r1, ph, r2]);
    const settled = recycleCMRenderTree(streaming, build([r1, r2]));
    assert.deepEqual(kinds(settled), ['reasoning']);
    assert.equal(settled.nodes[0], streaming.nodes[0]);
  });

  it('keeps every untouched node, key, array and call through a streamed message', () => {
    // reasoning streams in
    const r1a = reasoning('thinking');
    let tree = build([r1a]);
    assert.deepEqual(kinds(tree), ['reasoning']);

    // the reasoning fragment grows (same id, new object): new node, same key
    const r1b = grown(r1a, part => ({ ...part, aText: 'thinking more' }));
    let next = recycleCMRenderTree(tree, build([r1b]));
    assert.notEqual(next, tree);
    assert.notEqual(next.nodes[0], tree.nodes[0]);
    assert.equal(next.nodes[0].key, tree.nodes[0].key);
    tree = next;

    // text starts: the reasoning node is the same object
    const t1a = text('Hello');
    next = recycleCMRenderTree(tree, build([r1b, t1a]));
    assert.equal(next.nodes[0], tree.nodes[0]);
    assert.equal(next.nodes[1].kind, 'text');
    tree = next;

    // the text grows: only its node changes
    const t1b = grown(t1a, part => ({ ...part, text: 'Hello world' }));
    next = recycleCMRenderTree(tree, build([r1b, t1b]));
    assert.equal(next.nodes[0], tree.nodes[0]);
    assert.notEqual(next.nodes[1], tree.nodes[1]);
    assert.equal(next.nodes[1].key, tree.nodes[1].key);
    tree = next;

    // two invocations: one group, open
    const fc1 = call('c1'), fc2 = call('c2');
    next = recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2]));
    assert.equal(next.nodes[0], tree.nodes[0]);
    assert.equal(next.nodes[1], tree.nodes[1]);
    const group1 = nodeOfKind(next, 'tool-calls');
    assert.deepEqual(group1.calls.map(c => c.id), ['c1', 'c2']);
    assert.equal(group1.sealed, false);
    tree = next;

    // the response for c2 lands: the group node changes, its first call is the same object, the key stays
    const fr2 = result('c2');
    next = recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2, fr2]));
    assert.equal(next.nodes[0], tree.nodes[0]);
    assert.equal(next.nodes[1], tree.nodes[1]);
    const group2 = nodeOfKind(next, 'tool-calls');
    assert.notEqual(group2, group1);
    assert.equal(group2.key, group1.key);
    assert.equal(group2.calls[0], group1.calls[0]);
    assert.notEqual(group2.calls[1], group1.calls[1]);
    assert.equal(group2.calls[1].response, fr2);
    tree = next;

    // a citation and more text: the group seals (one more change, arrays recycled), citations go first, the rest stays
    const c1 = citation('https://a'), t2 = text('After');
    next = recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2, fr2, c1, t2]));
    assert.deepEqual(kinds(next), ['citations', 'reasoning', 'text', 'tool-calls', 'text']);
    assert.equal(next.nodes[1], tree.nodes[0]);
    assert.equal(next.nodes[2], tree.nodes[1]);
    const group3 = nodeOfKind(next, 'tool-calls');
    assert.notEqual(group3, group2);
    assert.equal(group3.sealed, true);
    assert.equal(group3.calls, group2.calls, 'unchanged calls array reused');
    assert.equal(group3.fragments, group2.fragments, 'unchanged members array reused');
    tree = next;

    // a second citation lands at the end: only the citations node changes, every other node is the same object
    const c2 = citation('https://b');
    next = recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2, fr2, c1, t2, c2]));
    assert.notEqual(next.nodes[0], tree.nodes[0]);
    assert.deepEqual(members(next.nodes[0]), fIds(c1, c2));
    assert.equal(next.nodes[0].key, tree.nodes[0].key);
    for (let i = 1; i < next.nodes.length; i++)
      assert.equal(next.nodes[i], tree.nodes[i], `node ${i} is the same object`);
    tree = next;

    // the last text grows: the text node changes, the citations node and all the others stay
    const t2b = grown(t2, part => ({ ...part, text: 'After all' }));
    next = recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2, fr2, c1, t2b, c2]));
    assert.equal(next.nodes[0], tree.nodes[0]);
    assert.notEqual(next.nodes[4], tree.nodes[4]);
    for (let i = 1; i < 4; i++)
      assert.equal(next.nodes[i], tree.nodes[i]);
    tree = next;

    // the same fragments again: the same tree
    assert.equal(recycleCMRenderTree(tree, build([r1b, t1b, fc1, fc2, fr2, c1, t2b, c2])), tree);
  });

  it('a node keeps its key through a reorder and the removal of its first member', () => {
    const t1 = text('t1'), d1 = doc('d1'), d2 = doc('d2'), t2 = text('t2');
    const tree = build([t1, d1, d2, t2]);
    const docs = nodeOfKind(tree, 'documents');
    assert.equal(docs.key, `documents:${d1.fId}`);

    const reordered = recycleCMRenderTree(tree, build([t1, d2, d1, t2]));
    const docsReordered = nodeOfKind(reordered, 'documents');
    assert.notEqual(docsReordered, docs);
    assert.equal(docsReordered.key, docs.key);
    assert.deepEqual(members(docsReordered), fIds(d2, d1));
    assert.equal(reordered.nodes[0], tree.nodes[0]);
    assert.equal(reordered.nodes[2], tree.nodes[2]);

    const removed = recycleCMRenderTree(tree, build([t1, d2, t2]));
    assert.equal(nodeOfKind(removed, 'documents').key, docs.key, 'the key outlives the member it was built from');

    // a split run: the first part keeps the key, the second part gets its own
    const split = recycleCMRenderTree(tree, build([t1, d1, text('mid'), d2, t2]));
    assert.deepEqual(kinds(split), ['text', 'documents', 'text', 'documents', 'text']);
    assert.equal(split.nodes[1].key, docs.key);
    assert.equal(split.nodes[3].key, `documents:${d2.fId}`);
    assert.notEqual(split.nodes[1].key, split.nodes[3].key);
  });

  it('a mode switch recycles the nodes shared by both modes', () => {
    const r = reasoning('r'), t = text('t'), ph = placeholder('p');
    const view = build([r, t, ph]);
    const edit = recycleCMRenderTree(view, build([r, t, ph], 'edit'));
    assert.deepEqual(kinds(edit), ['reasoning', 'edit-text', 'placeholder']);
    assert.equal(edit.nodes[0], view.nodes[0]);
    assert.equal(edit.nodes[2], view.nodes[2]);
    assert.equal(recycleCMRenderTree(edit, build([r, t, ph])).nodes[0], view.nodes[0]);
  });

  it('recycles the trailing options and the separators', () => {
    const t1 = text('Pick one:\n- Red\n- Blue'), opts = { trailingOptions: true };
    const tree = build([t1], 'view', opts);
    const same = recycleCMRenderTree(tree, build([t1], 'view', opts));
    assert.equal(same, tree);
    const longer = recycleCMRenderTree(tree, build([reasoning('r'), t1], 'view', opts));
    assert.equal(longer.nodes[1], tree.nodes[0], 'the text node, options included, is the same object');
    assert.equal(longer.trailingOptions, tree.trailingOptions);

    const a = withOrigin(text('a'), 'ray-1'), b = withOrigin(text('b'), 'ray-2');
    const separated = build([a, b]);
    const grownB = recycleCMRenderTree(separated, build([a, grown(b, part => ({ ...part, text: 'bb' }))]));
    assert.equal(grownB.nodes[1], separated.nodes[1], 'the separator is the same object');
    assert.equal(grownB.nodes[0], separated.nodes[0]);
  });

});
