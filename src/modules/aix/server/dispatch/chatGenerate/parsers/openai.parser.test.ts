import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatGenerateTransmitter } from '../ChatGenerateTransmitter';
import { createOpenAIChatCompletionsChunkParser } from './openai.parser';


function flushParticles(transmitter: ChatGenerateTransmitter) {
  return Array.from(transmitter.flushParticles());
}

test('OpenAI chat completions parser defaults missing completion_tokens to zero', () => {
  const transmitter = new ChatGenerateTransmitter('OpenAI');
  const parser = createOpenAIChatCompletionsChunkParser();

  parser(transmitter, JSON.stringify({
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'gemini-3.1-pro-high',
    choices: [{
      index: 0,
      delta: {
        role: 'assistant',
        content: '',
        reasoning_content: null,
        tool_calls: null,
      },
      finish_reason: 'stop',
      native_finish_reason: 'stop',
    }],
    usage: {
      total_tokens: 3868,
      prompt_tokens: 3868,
    },
  }));

  const metricsParticle = flushParticles(transmitter)
    .find(p => 'cg' in p && p.cg === 'set-metrics');

  assert.ok(metricsParticle && 'metrics' in metricsParticle);
  assert.equal(metricsParticle?.metrics.TIn, 3868);
  assert.equal(metricsParticle?.metrics.TOut, 0);
});
