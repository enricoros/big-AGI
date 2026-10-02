/// <reference types="node" />

// Regression tests for issue #1200 (cross-provider hosted container provenance).
//
// The OpenAI Responses parser is shared by every RspVendor ('openai', 'xai', ...), so a hosted
// `code_interpreter_call` must stamp its session container under the PRODUCING vendor's
// namespace. Stamping every vendor's container as 'openai-container' made a later OpenAI-targeted
// turn adopt a foreign sandbox via the history walk (aix.client.ts `_findRecentUpstreamContainer`)
// and round-trip foreign item ids (e.g. xAI's 83-char `ci_...`), which OpenAI rejects with
// "Invalid 'input[N].id': string too long".
//
// Run: npx tsx --test src/modules/aix/server/dispatch/chatGenerate/parsers/openai.responses.parser.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createOpenAIResponsesEventParser } from './openai.responses.parser';
import type { IParticleTransmitter } from './IParticleTransmitter';

// xAI's `ci_...` item ids are 83 chars - longer than OpenAI's 64-char id cap (the reported 400).
const FOREIGN_ITEM_ID = `ci_${'a'.repeat(80)}`;

function makeRecordingTransmitter() {
  const containerStates: Array<{ vendor: string; containerId: string }> = [];
  const invocationIds: string[] = [];
  const pt = {
    sendSetVendorState(op: { vendor: string; state: { container?: { id: string } } }) {
      if (op.state?.container) containerStates.push({ vendor: op.vendor, containerId: op.state.container.id });
    },
    addCodeExecutionInvocation(id: string, _language: string, _code: string, _author: string) {
      invocationIds.push(id);
    },
    addCodeExecutionResponse() { /* not asserted here */ },
    endMessagePart() { /* part boundary, not asserted here */ },
  } as unknown as IParticleTransmitter;
  return { pt, containerStates, invocationIds };
}

function codeInterpreterDoneEvent(): string {
  return JSON.stringify({
    type: 'response.output_item.done',
    sequence_number: 1,
    output_index: 0,
    item: {
      type: 'code_interpreter_call',
      id: FOREIGN_ITEM_ID,
      status: 'completed',
      container_id: 'cntr_foreign_sandbox',
      code: 'print("hello")',
      outputs: [{ type: 'logs', logs: 'hello' }],
    },
  });
}

test('stamps an xAI-produced hosted container under the xai namespace', () => {
  const { pt, containerStates, invocationIds } = makeRecordingTransmitter();
  const parse = createOpenAIResponsesEventParser('xai');
  parse(pt, codeInterpreterDoneEvent());

  assert.equal(containerStates.length, 1, 'exactly one container state particle');
  assert.equal(containerStates[0].vendor, 'xai-container');
  assert.equal(containerStates[0].containerId, 'cntr_foreign_sandbox');
  // fragment identity is unchanged: the invocation keeps its raw upstream id
  assert.deepEqual(invocationIds, [FOREIGN_ITEM_ID]);
});

test('keeps the openai container namespace for OpenAI-produced calls', () => {
  const { pt, containerStates } = makeRecordingTransmitter();
  const parse = createOpenAIResponsesEventParser('openai');
  parse(pt, codeInterpreterDoneEvent());

  assert.equal(containerStates.length, 1);
  assert.equal(containerStates[0].vendor, 'openai-container');
});
