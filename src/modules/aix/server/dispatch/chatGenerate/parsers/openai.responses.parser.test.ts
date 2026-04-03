import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatGenerateTransmitter } from '../ChatGenerateTransmitter';
import { createOpenAIResponsesEventParser } from './openai.responses.parser';


function flushParticles(transmitter: ChatGenerateTransmitter) {
  return Array.from(transmitter.flushParticles());
}

test('OpenAI Responses streaming parser stores startingAfter on the upstream resume handle', () => {
  const transmitter = new ChatGenerateTransmitter('OpenAI Responses');
  const parser = createOpenAIResponsesEventParser();

  parser(transmitter, JSON.stringify({
    type: 'response.created',
    sequence_number: 7,
    response: {
      object: 'response',
      id: 'resp_resume_1',
      created_at: 1742385600,
      status: 'in_progress',
      background: false,
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      max_tool_calls: null,
      model: 'gpt-5.4',
      output: [],
      parallel_tool_calls: true,
      previous_response_id: null,
      prompt_cache_key: null,
      prompt_cache_retention: null,
      reasoning: { effort: null, summary: null },
      safety_identifier: null,
      service_tier: 'default',
      store: true,
      temperature: 1,
      text: { format: { type: 'text' } },
      tool_choice: 'auto',
      tools: [],
      top_logprobs: 0,
      top_p: 1,
      truncation: 'disabled',
      usage: null,
      user: null,
      metadata: {},
    },
  }));

  const particles = flushParticles(transmitter);
  const upstreamHandleParticle = particles.find(p => 'cg' in p && p.cg === 'set-upstream-handle');

  assert.ok(upstreamHandleParticle && 'handle' in upstreamHandleParticle);
  assert.equal(upstreamHandleParticle?.handle.responseId, 'resp_resume_1');
  assert.equal(upstreamHandleParticle?.handle.startingAfter, 7);
  assert.equal(typeof upstreamHandleParticle?.handle.expiresAt, 'number');
});

test('OpenAI Responses streaming parser advances startingAfter on later events', () => {
  const transmitter = new ChatGenerateTransmitter('OpenAI Responses');
  const parser = createOpenAIResponsesEventParser();

  const response = {
    object: 'response',
    id: 'resp_resume_2',
    created_at: 1742385600,
    status: 'in_progress',
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    model: 'gpt-5.4',
    output: [],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: null,
    prompt_cache_retention: null,
    reasoning: { effort: null, summary: null },
    safety_identifier: null,
    service_tier: 'default',
    store: true,
    temperature: 1,
    text: { format: { type: 'text' } },
    tool_choice: 'auto',
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: 'disabled',
    usage: null,
    user: null,
    metadata: {},
  };

  parser(transmitter, JSON.stringify({
    type: 'response.created',
    sequence_number: 7,
    response,
  }));
  parser(transmitter, JSON.stringify({
    type: 'keepalive',
    sequence_number: 8,
  }));

  const particles = flushParticles(transmitter);
  const upstreamHandleParticles = particles.filter(p => 'cg' in p && p.cg === 'set-upstream-handle');
  const lastUpstreamHandleParticle = upstreamHandleParticles.at(-1);

  assert.equal(upstreamHandleParticles.length >= 2, true);
  assert.equal(lastUpstreamHandleParticle?.handle.responseId, 'resp_resume_2');
  assert.equal(lastUpstreamHandleParticle?.handle.startingAfter, 8);
});
