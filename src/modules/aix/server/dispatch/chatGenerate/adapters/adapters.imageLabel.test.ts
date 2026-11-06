/// <reference types="node" />

// Offline tests for naming user images in requests sent to AI APIs (the optional `label` of an inline image part).
//
// Run: `NODE_ENV=development npx tsx --test src/modules/aix/server/dispatch/chatGenerate/adapters/adapters.imageLabel.test.ts`

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { AixAPI_Model, AixAPIChatGenerate_Request } from '../../../api/aix.wiretypes';

import { approxImageLabel_To_String } from './adapters.common';
import { aixToAnthropicMessageCreate, aixAnthropicHostedFeatures } from './anthropic.messageCreate';
import { aixToGeminiGenerateContent } from './gemini.generateContent';
import { aixToOpenAIChatCompletions } from './openai.chatCompletions';
import { aixToOpenAIResponses } from './openai.responsesCreate';
import { aixToXAIResponses } from './xai.responsesCreate';


const model: AixAPI_Model = { id: 'test-model', acceptsOutputs: ['text'] };

function _request(label?: string): AixAPIChatGenerate_Request {
  return {
    systemMessage: null,
    chatSequence: [{
      role: 'user',
      parts: [
        { pt: 'text', text: 'Compare these images.' },
        { pt: 'inline_image', mimeType: 'image/png', base64: 'AAAA', ...(label !== undefined ? { label } : {}) },
      ],
    }],
  };
}

/** JSON of the request, so tests can look at the order of the parts without caring about each dialect's exact shape. */
const _json = (value: unknown) => JSON.stringify(value);


describe('approxImageLabel_To_String', () => {

  test('names the image with its file name', () => {
    assert.equal(approxImageLabel_To_String('Image_A.png'), 'Image_A.png:');
  });

  test('keeps only the base name of a path', () => {
    assert.equal(approxImageLabel_To_String('folder/sub/Image_A.png'), 'Image_A.png:');
    assert.equal(approxImageLabel_To_String('folder\\sub\\Image_A.png'), 'Image_A.png:');
  });

  test('returns null when there is no usable label', () => {
    assert.equal(approxImageLabel_To_String(undefined), null);
    assert.equal(approxImageLabel_To_String(''), null);
    assert.equal(approxImageLabel_To_String('   '), null);
  });

});


describe('labeled user images in the dialect adapters', () => {

  test('OpenAI Responses: input_text with the name comes right before the input_image', () => {
    const req = aixToOpenAIResponses('openai', model, _request('Image_A.png'), false, false);
    const content = (req.input as any[]).flatMap(m => m.content ?? []);
    const i = content.findIndex((c: any) => c.type === 'input_image');
    assert.ok(i > 0);
    assert.deepEqual(content[i - 1], { type: 'input_text', text: 'Image_A.png:' });
  });

  test('xAI Responses: input_text with the name comes right before the input_image', () => {
    const req = aixToXAIResponses(model, _request('Image_A.png'), false, false);
    const content = (req.input as any[]).flatMap(m => m.content ?? []);
    const i = content.findIndex((c: any) => c.type === 'input_image');
    assert.ok(i > 0);
    assert.deepEqual(content[i - 1], { type: 'input_text', text: 'Image_A.png:' });
  });

  test('OpenAI Chat Completions: text part with the name comes right before the image_url part', () => {
    const req = aixToOpenAIChatCompletions('openai', model, _request('Image_A.png'), false);
    const content = req.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : []);
    const i = content.findIndex((c: any) => c.type === 'image_url');
    assert.ok(i > 0);
    assert.deepEqual(content[i - 1], { type: 'text', text: 'Image_A.png:' });
  });

  test('Anthropic: text block with the name comes right before the image block', () => {
    const chatGenerate = _request('Image_A.png');
    const req = aixToAnthropicMessageCreate('anthropic', model, chatGenerate, false, aixAnthropicHostedFeatures(model, chatGenerate));
    const content = (req.messages as any[]).flatMap(m => Array.isArray(m.content) ? m.content : []);
    const i = content.findIndex((c: any) => c.type === 'image');
    assert.ok(i > 0);
    assert.equal(content[i - 1].type, 'text');
    assert.equal(content[i - 1].text, 'Image_A.png:');
  });

  test('Gemini: text part with the name comes right before the inlineData part', () => {
    const req = aixToGeminiGenerateContent(model, _request('Image_A.png'), 'BLOCK_NONE', false, false);
    const parts = (req.contents as any[]).flatMap(c => c.parts ?? []);
    const i = parts.findIndex((p: any) => p.inlineData);
    assert.ok(i > 0);
    assert.deepEqual(parts[i - 1], { text: 'Image_A.png:' });
  });

  test('images without a name are sent as before (no extra text)', () => {
    const noLabel = _request();
    assert.ok(!_json(aixToOpenAIResponses('openai', model, noLabel, false, false)).includes('.png:'));
    assert.ok(!_json(aixToXAIResponses(model, noLabel, false, false)).includes('input_text","text":":'));
    const chatContent = aixToOpenAIChatCompletions('openai', model, noLabel, false).messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : []);
    assert.deepEqual(chatContent.map((c: any) => c.type), ['text', 'image_url']);
    const geminiParts = (aixToGeminiGenerateContent(model, noLabel, 'BLOCK_NONE', false, false).contents as any[]).flatMap(c => c.parts ?? []);
    assert.equal(geminiParts.length, 2);
  });

});
