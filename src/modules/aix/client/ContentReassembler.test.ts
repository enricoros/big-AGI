/// <reference types="node" />

// Regression test for issue #1200 (cross-provider hosted container provenance).
//
// The reassembler maps the parser's `svs` container particles onto the message-scoped
// `generator.upstreamContainer` slot. xAI's hosted code-interpreter sandbox arrives under
// the vendor-scoped 'xai-container' name and must land in its own 'vnd.xai.container'
// variant - NOT in 'vnd.oai.container', which the OpenAI-targeted turn walk consumes
// (aix.client.ts `_findRecentUpstreamContainer(history, 'vnd.oai.container')`).
//
// Run: npx tsx --test src/modules/aix/client/ContentReassembler.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ContentReassembler } from './ContentReassembler';
import type { AixWire_Particles } from '../server/api/aix.wiretypes';

function newReassembler(): ContentReassembler {
  return new ContentReassembler({ mgt: 'aix' } as ContentReassembler['S']['generator'], undefined, undefined, []);
}

test('slots an xai-container vendor state under vnd.xai.container', async () => {
  const reassembler = newReassembler();
  const op = {
    p: 'svs',
    vendor: 'xai-container',
    state: { container: { id: 'cntr_xai_sandbox', expiresAt: new Date(Date.now() + 20 * 60_000).toISOString() } },
  } as unknown as AixWire_Particles.ChatGenerateOp;

  reassembler.enqueueWireParticle(op);
  await reassembler.waitForWireComplete();

  const uc = reassembler.S.generator.upstreamContainer;
  assert.ok(uc, 'upstream container slot is populated');
  assert.equal(uc.uct, 'vnd.xai.container');
  assert.equal('containerId' in uc && uc.containerId, 'cntr_xai_sandbox');
});

test('still slots an openai-container vendor state under vnd.oai.container', async () => {
  const reassembler = newReassembler();
  const op = {
    p: 'svs',
    vendor: 'openai-container',
    state: { container: { id: 'cntr_oai_sandbox', expiresAt: new Date(Date.now() + 20 * 60_000).toISOString() } },
  } as unknown as AixWire_Particles.ChatGenerateOp;

  reassembler.enqueueWireParticle(op);
  await reassembler.waitForWireComplete();

  const uc = reassembler.S.generator.upstreamContainer;
  assert.ok(uc, 'upstream container slot is populated');
  assert.equal(uc.uct, 'vnd.oai.container');
});
