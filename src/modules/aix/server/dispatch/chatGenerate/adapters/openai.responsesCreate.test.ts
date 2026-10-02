/// <reference types="node" />

// Regression tests for issue #1200 (cross-provider hosted container provenance).
//
// Without a live session container (idle/expired, or the prior execution ran on another
// vendor's sandbox), the OpenAI Responses adapter converts a hosted code_execution
// invocation into a container-independent 'execute_code' function_call. The conversion
// previously reused the producer's raw item id (e.g. xAI's 83-char `ci_...`) as the
// function_call `call_id` on BOTH the call and its paired output - which risks OpenAI's
// 64-char id cap rejecting the whole request. Over-long ids must be deterministically
// regenerated, identically on both sides, while ids that already fit pass through.
//
// Run: npx tsx --test src/modules/aix/server/dispatch/chatGenerate/adapters/openai.responsesCreate.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aixToOpenAIResponses } from './openai.responsesCreate';
import type { AixAPIChatGenerate_Request, AixAPI_Model } from '../../../api/aix.wiretypes';

// xAI's `ci_...` item ids are 83 chars - longer than OpenAI's 64-char id cap (the reported 400).
const FOREIGN_ITEM_ID = `ci_${'a'.repeat(80)}`;
const SHORT_ITEM_ID = 'ci_short_local_id';

function buildRequest(itemId: string): ReturnType<typeof aixToOpenAIResponses> {
  const chatGenerate = {
    systemMessage: null,
    chatSequence: [
      {
        role: 'model' as const,
        parts: [
          {
            pt: 'tool_invocation' as const,
            id: itemId,
            invocation: { type: 'code_execution' as const, code: 'print("hello")' },
          },
          {
            pt: 'tool_response' as const,
            id: itemId,
            response: { type: 'code_execution' as const, result: 'hello' },
          },
        ],
      },
    ],
  } as unknown as AixAPIChatGenerate_Request;

  return aixToOpenAIResponses('openai', { id: 'gpt-6-test' } as unknown as AixAPI_Model, chatGenerate, false, false);
}

function findWireItems(request: ReturnType<typeof aixToOpenAIResponses>) {
  const fn = request.input.filter((it) => it.type === 'function_call');
  const out = request.input.filter((it) => it.type === 'function_call_output');
  const ci = request.input.filter((it) => it.type === 'code_interpreter_call');
  return { fn, out, ci };
}

test('regenerates over-long foreign call ids in the execute_code fallback, identically on both sides', () => {
  const { fn, out, ci } = findWireItems(buildRequest(FOREIGN_ITEM_ID));

  // no session container -> no native code_interpreter_call round-trip
  assert.equal(ci.length, 0, 'no code_interpreter_call item without a live container');
  assert.equal(fn.length, 1, 'the invocation converts to a function_call');
  assert.equal(fn[0].name, 'execute_code');

  // the raw 83-char id must not reach the wire as call_id
  assert.ok(fn[0].call_id.length <= 64, `call_id must fit the 64-char cap, got ${fn[0].call_id.length}`);
  assert.notEqual(fn[0].call_id, FOREIGN_ITEM_ID);

  // the paired output must carry the same regenerated id (anti-wedge pairing invariant)
  assert.equal(out.length, 1);
  assert.equal(out[0].call_id, fn[0].call_id);
});

test('leaves call ids that already fit the cap untouched', () => {
  const { fn, out, ci } = findWireItems(buildRequest(SHORT_ITEM_ID));

  assert.equal(ci.length, 0);
  assert.equal(fn.length, 1);
  assert.equal(fn[0].call_id, SHORT_ITEM_ID, 'short ids pass through unchanged');
  assert.equal(out.length, 1);
  assert.equal(out[0].call_id, SHORT_ITEM_ID);
});
