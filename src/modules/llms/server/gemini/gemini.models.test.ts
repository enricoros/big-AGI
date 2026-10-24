/// <reference types="node" />

// Offline tests for the Gemini model curation: no network, no keys.
//
// Run: `NODE_ENV=development npx tsx --test src/modules/llms/server/gemini/gemini.models.test.ts`

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { GeminiWire_API_Models_List } from '../../../aix/server/dispatch/wiretypes/gemini.wiretypes';

import { geminiModelToModelDescription } from './gemini.models';


function _wireModel(name: string, outputTokenLimit: number): GeminiWire_API_Models_List.Model {
  return {
    name,
    version: '001',
    displayName: name,
    inputTokenLimit: 1048576,
    outputTokenLimit,
    supportedGenerationMethods: ['generateContent'],
  };
}


describe('geminiModelToModelDescription: maxCompletionTokens', () => {

  test('Gemini 4 Argon allows 65,536 output tokens, even if the models list reports 32,768', () => {
    const md = geminiModelToModelDescription(_wireModel('models/gemini-4-argon', 32768));
    assert.ok(md, 'model description expected');
    assert.equal(md.maxCompletionTokens, 65536);
  });

  test('Gemini 4 Argon keeps the full context window computed from the models list', () => {
    const md = geminiModelToModelDescription(_wireModel('models/gemini-4-argon', 32768));
    assert.ok(md, 'model description expected');
    assert.equal(md.contextWindow, 1048576 + 32768);
  });

  test('models without a curated limit use the one from the models list', () => {
    const md = geminiModelToModelDescription(_wireModel('models/gemini-3.8-flash', 65536));
    assert.ok(md, 'model description expected');
    assert.equal(md.maxCompletionTokens, 65536);

    const unknown = geminiModelToModelDescription(_wireModel('models/some-unknown-model', 12345));
    assert.ok(unknown, 'model description expected');
    assert.equal(unknown.maxCompletionTokens, 12345);
  });

});
