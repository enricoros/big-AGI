import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatGenerateTransmitter } from '../ChatGenerateTransmitter';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './anthropic.parser';
import { createOpenAIResponseParserNS } from './openai.responses.parser';


function flushParticles(transmitter: ChatGenerateTransmitter) {
  return Array.from(transmitter.flushParticles());
}

function pushAnthropicEvent(
  parser: ReturnType<typeof createAnthropicMessageParser>,
  transmitter: ChatGenerateTransmitter,
  eventName: string,
  payload: object,
) {
  parser(transmitter, JSON.stringify(payload), eventName);
}

test('OpenAI Responses persists hosted web searches as tool invocation/response particles', () => {
  const transmitter = new ChatGenerateTransmitter('OpenAI Responses');
  const parser = createOpenAIResponseParserNS();

  parser(transmitter, JSON.stringify({
    object: 'response',
    id: 'resp_1',
    created_at: 1742385600,
    status: 'completed',
    incomplete_details: null,
    error: null,
    model: 'gpt-5.4',
    output: [{
      type: 'web_search_call',
      id: 'ws_1',
      status: 'completed',
      action: {
        type: 'search',
        query: 'canary islands saas',
        sources: [{
          type: 'url',
          url: 'https://example.com/report',
          title: 'Example Report',
          snippet: 'Signals about digital adoption.',
        }],
      },
    }],
    usage: null,
  }));

  const particles = flushParticles(transmitter);

  assert.ok(particles.some(p => 'p' in p && p.p === 'fci' && p.id === 'ws_1' && p.name === 'web_search'));
  assert.ok(particles.some(p =>
    'p' in p
    && p.p === 'fcr'
    && p.id === 'ws_1'
    && p.name === 'web_search'
    && p.environment === 'upstream'
    && p.error === false
    && p.result.includes('Query: canary islands saas')
    && p.result.includes('https://example.com/report'),
  ));
});

test('Anthropic persists hosted web searches as tool invocation/response particles', () => {
  const transmitter = new ChatGenerateTransmitter('Anthropic');
  const parser = createAnthropicMessageParserNS();

  parser(transmitter, JSON.stringify({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-5',
    content: [
      {
        type: 'server_tool_use',
        id: 'srvtool_1',
        name: 'web_search',
        input: {
          query: 'canary islands saas',
        },
      },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'srvtool_1',
        content: [{
          type: 'web_search_result',
          encrypted_content: 'opaque',
          title: 'Official Report',
          url: 'https://example.com/official',
          page_age: '7 days',
        }],
      },
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 12,
      output_tokens: 34,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      server_tool_use: {
        web_fetch_requests: 0,
        web_search_requests: 1,
      },
      service_tier: null,
      inference_geo: null,
    },
    context_management: null,
    container: null,
  }));

  const particles = flushParticles(transmitter);

  assert.ok(particles.some(p => 'p' in p && p.p === 'fci' && p.id === 'srvtool_1' && p.name === 'web_search'));
  assert.ok(particles.some(p =>
    'p' in p
    && p.p === 'fcr'
    && p.id === 'srvtool_1'
    && p.name === 'web_search'
    && p.environment === 'upstream'
    && p.error === false
    && p.result.includes('Official Report')
    && p.result.includes('https://example.com/official'),
  ));
});

test('Anthropic streaming persists a tool_use verdict after thinking deltas', () => {
  const transmitter = new ChatGenerateTransmitter('Anthropic');
  const parser = createAnthropicMessageParser();

  pushAnthropicEvent(parser, transmitter, 'message_start', {
    type: 'message_start',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-6',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0 },
    },
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'thinking', thinking: '', signature: 'sig_1' },
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'thinking_delta', thinking: 'I should vote now.' },
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_stop', {
    type: 'content_block_stop',
    index: 0,
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_start', {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'Accept', input: {} },
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_stop', {
    type: 'content_block_stop',
    index: 1,
  });
  pushAnthropicEvent(parser, transmitter, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 9 },
  });
  pushAnthropicEvent(parser, transmitter, 'message_stop', {
    type: 'message_stop',
  });

  const particles = flushParticles(transmitter);

  assert.ok(particles.some(p => 'p' in p && p.p === 'fci' && p.id === 'toolu_1' && p.name === 'Accept'));
  assert.ok(particles.some(p => 'p' in p && p.p === '_fci' && p._args === '{}'));
});

test('Anthropic streaming persists a tool_use verdict even if content_block_stop is missing', () => {
  const transmitter = new ChatGenerateTransmitter('Anthropic');
  const parser = createAnthropicMessageParser();

  pushAnthropicEvent(parser, transmitter, 'message_start', {
    type: 'message_start',
    message: {
      id: 'msg_2',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-6',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0 },
    },
  });
  pushAnthropicEvent(parser, transmitter, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'toolu_2', name: 'Accept', input: {} },
  });
  pushAnthropicEvent(parser, transmitter, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 4 },
  });
  pushAnthropicEvent(parser, transmitter, 'message_stop', {
    type: 'message_stop',
  });

  const particles = flushParticles(transmitter);

  assert.ok(particles.some(p => 'p' in p && p.p === 'fci' && p.id === 'toolu_2' && p.name === 'Accept'));
  assert.ok(particles.some(p => 'p' in p && p.p === '_fci' && p._args === '{}'));
});
