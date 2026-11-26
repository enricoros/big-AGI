import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listVoicesElevenLabs } from '~/modules/speex/protocols/rpc/synthesize-elevenlabs';
import { listVoicesInworld } from '~/modules/speex/protocols/rpc/synthesize-inworld';
import { synthesizeOpenAIProtocol } from '~/modules/speex/protocols/rpc/synthesize-openai';
import { transcribeDeepgram } from '~/modules/asrx/protocols/batch/transcribe-deepgram';
import { transcribeOpenAI } from '~/modules/asrx/protocols/batch/transcribe-openai';

import { anthropicAccess } from '../server/anthropic/anthropic.access';
import { geminiAccess } from '../server/gemini/gemini.access';
import { ollamaAccess } from '../server/ollama/ollama.access';
import { DEEPSEEK_API_PATHS, OPENAI_API_PATHS, openAIAccess, type OpenAIDialects } from '../server/openai/openai.access';

import { llmsApiUrl, llmsDeepseekWire } from './llm.isomorphic';


// A host the user can set, to the URL requested.
// - 'llmsApiUrl' states the rule on the function, one test per branch
// - 'every request to a settable host' calls each consumer once with a host that ends in a version: a consumer that
//   joins host and path on its own fails its row
// - 'DeepSeek' is the one vendor with two wires on one host: which wire a host gets, and the route of the second
// The expected URLs are the vendors' own routes, not what the code returns.

describe('llmsApiUrl', () => {

  test('a host without a version takes the path as it is: no host stored before this rule changes', () => {
    for (const [host, apiPath] of [
      ['https://api.openai.com', '/v1/chat/completions'],
      ['https://api.groq.com/openai', '/v1/models'],
      ['https://openrouter.ai/api', '/v1/key'],
      ['https://api.z.ai/api/paas', '/v4/chat/completions'],
      ['https://api.perplexity.ai', '/chat/completions'],
      ['https://generativelanguage.googleapis.com', '/v1beta/models'],
      ['http://localhost:11434', '/api/tags'],
      ['http://localhost:1234', '/api/v1/models'],
      ['https://gateway.ai.cloudflare.com/v1/acct/gw/openai', '/chat/completions'], // a version inside the host path is not at its end
      ['https://v2', '/v1/models'], // a hostname, not a version
    ])
      assert.equal(llmsApiUrl(host, apiPath), host + apiPath);
  });

  test('a host that ends in a version is the base URL: a versioned path takes the host version', () => {
    assert.equal(llmsApiUrl('https://api.sarvam.ai/v2', '/v1/models'), 'https://api.sarvam.ai/v2/models'); // /v2/v1/models is a 404
    assert.equal(llmsApiUrl('https://api.openai.com/v1', '/v1/responses'), 'https://api.openai.com/v1/responses');
    assert.equal(llmsApiUrl('https://api.z.ai/api/paas/v4', '/v4/chat/completions'), 'https://api.z.ai/api/paas/v4/chat/completions');
    assert.equal(llmsApiUrl('https://generativelanguage.googleapis.com/v1beta', '/v1beta/models'), 'https://generativelanguage.googleapis.com/v1beta/models');
  });

  test('a path from the server root drops the host version', () => {
    assert.equal(llmsApiUrl('http://localhost:11434/v1', '/api/tags'), 'http://localhost:11434/api/tags');
    assert.equal(llmsApiUrl('http://localhost:1234/v1', '/api/v1/models'), 'http://localhost:1234/api/v1/models');
    assert.equal(llmsApiUrl('http://localhost:8080/v1', '/models/available'), 'http://localhost:8080/models/available');
    assert.equal(llmsApiUrl('https://generativelanguage.googleapis.com/v1beta', '/upload/v1beta/files'), 'https://generativelanguage.googleapis.com/upload/v1beta/files');
  });

});


/** The first URL a consumer requests; the network is answered here, and the canned answer may fail the consumer after that */
async function requestedUrl(consume: () => Promise<unknown>): Promise<string> {
  const realFetch = globalThis.fetch;
  let url = '';
  globalThis.fetch = async (input) => {
    if (!url) url = String(input);
    return Response.json({});
  };
  try {
    await consume();
  } catch {
    // only the URL is asserted
  } finally {
    globalThis.fetch = realFetch;
  }
  return url;
}

describe('every request to a settable host', () => {

  test('OpenAI-compatible dialects: chat on a host that ends in /v1 has one version', () => {
    const dialects: OpenAIDialects[] = ['alibaba', 'cohere', 'deepseek', 'groq', 'lmstudio', 'localai', 'metaai', 'mistral', 'modular', 'moonshot', 'nvidianim', 'openai', 'openrouter', 'sakanaai', 'togetherai', 'zai'];
    for (const dialect of dialects)
      assert.equal(openAIAccess({ dialect, oaiKey: 'k', oaiOrg: '', oaiHost: 'https://host.example/v1' }, 'model', OPENAI_API_PATHS.chatCompletions).url, 'https://host.example/v1/chat/completions', dialect);
    // Perplexity's chat route has no version: it hangs off the server root
    assert.equal(openAIAccess({ dialect: 'perplexity', oaiKey: 'k', oaiOrg: '', oaiHost: 'https://host.example/v1' }, 'model', OPENAI_API_PATHS.chatCompletions).url, 'https://host.example/chat/completions');
  });

  test('OpenAI-compatible routes off the server root: LocalAI gallery, LM Studio models', () => {
    assert.equal(openAIAccess({ dialect: 'localai', oaiKey: '', oaiOrg: '', oaiHost: 'http://localhost:8080/v1' }, null, '/models/available').url, 'http://localhost:8080/models/available');
    assert.equal(openAIAccess({ dialect: 'lmstudio', oaiKey: '', oaiOrg: '', oaiHost: 'http://localhost:1234/v1' }, null, '/api/v1/models').url, 'http://localhost:1234/api/v1/models');
  });

  test('Anthropic, Gemini, Ollama', () => {
    assert.equal(anthropicAccess({ dialect: 'anthropic', anthropicKey: 'k', anthropicHost: 'https://api.anthropic.com/v1' } as Parameters<typeof anthropicAccess>[0], '/v1/messages').url, 'https://api.anthropic.com/v1/messages');
    assert.equal(geminiAccess({ dialect: 'gemini', geminiKey: 'k', geminiHost: 'https://proxy.example/v1beta' } as Parameters<typeof geminiAccess>[0], null, '/v1beta/models', false).url, 'https://proxy.example/v1beta/models');
    assert.equal(ollamaAccess({ dialect: 'ollama', ollamaHost: 'http://localhost:11434/v1' }, '/api/tags').url, 'http://localhost:11434/api/tags');
    assert.equal(ollamaAccess({ dialect: 'ollama', ollamaHost: 'http://localhost:11434/v1' }, OPENAI_API_PATHS.chatCompletions).url, 'http://localhost:11434/v1/chat/completions');
  });

  test('text-to-speech and transcription', async () => {
    const speech = (dialect: 'openai' | 'localai', apiHost: string) => requestedUrl(async () => {
      for await (const _particle of synthesizeOpenAIProtocol({ access: { dialect, apiKey: 'k', apiHost }, text: 'hi', voice: { dialect }, streaming: false } as Parameters<typeof synthesizeOpenAIProtocol>[0])) { /* drain */ }
    });
    assert.equal(await speech('openai', 'https://api.openai.com/v1'), 'https://api.openai.com/v1/audio/speech');
    assert.equal(await speech('openai', 'https://api.sarvam.ai/v2'), 'https://api.sarvam.ai/v2/audio/speech'); // Sarvam serves it; /v2/v1/audio/speech is a 404
    assert.equal(await speech('localai', 'http://localhost:8080/v1'), 'http://localhost:8080/v1/audio/speech');

    assert.equal(await requestedUrl(() => transcribeOpenAI({ access: { dialect: 'openai', apiKey: 'k', apiHost: 'https://api.openai.com/v1' }, profile: { dialect: 'openai' }, audio: new Uint8Array([0]), mimeType: 'audio/mpeg' } as Parameters<typeof transcribeOpenAI>[0])),
      'https://api.openai.com/v1/audio/transcriptions');
    assert.match(await requestedUrl(() => transcribeDeepgram({ access: { dialect: 'deepgram', apiKey: 'k', apiHost: 'https://api.deepgram.com/v1' }, profile: { dialect: 'deepgram' }, audio: new Uint8Array([0]), mimeType: 'audio/mpeg' } as Parameters<typeof transcribeDeepgram>[0])),
      /^https:\/\/api\.deepgram\.com\/v1\/listen\?/);

    assert.equal(await requestedUrl(() => listVoicesElevenLabs({ dialect: 'elevenlabs', apiKey: 'k', apiHost: 'https://api.elevenlabs.io/v1' })), 'https://api.elevenlabs.io/v1/voices');
    // Inworld's routes carry the version inside the path: they hang off the server root
    assert.equal(await requestedUrl(() => listVoicesInworld({ dialect: 'inworld', apiKey: 'k', apiHost: 'https://api.inworld.ai/v1' })), 'https://api.inworld.ai/voices/v1/voices');
  });

});


describe('DeepSeek: the wire, and the Messages route', () => {

  test('Auto is Messages on DeepSeek\'s own host at any path, Chat Completions on any other host; a set protocol wins', () => {
    for (const host of [undefined, '', 'https://api.deepseek.com', 'api.deepseek.com', 'https://api.deepseek.com/beta', 'https://api.deepseek.com/anthropic'])
      assert.equal(llmsDeepseekWire(undefined, host), 'messages', String(host));
    for (const host of ['https://proxy.example', 'https://proxy.example/v1', 'http://localhost:8080', 'https://api.deepseek.com.evil.example'])
      assert.equal(llmsDeepseekWire(undefined, host), 'chat-completions', host);
    assert.equal(llmsDeepseekWire('chat-completions', ''), 'chat-completions'); // the way back, on the official host
    assert.equal(llmsDeepseekWire('messages', 'https://proxy.example'), 'messages'); // a proxy that serves the route
  });

  test('the Messages route hangs off the server root, whatever base path the host carries', () => {
    const url = (oaiHost: string) => openAIAccess({ dialect: 'deepseek', oaiKey: 'k', oaiOrg: '', oaiHost }, 'model', DEEPSEEK_API_PATHS.messages).url;
    // '/beta' is DeepSeek's Chat Completions beta base and '/anthropic' its base URL for Anthropic SDKs: host + route would 404 on both
    for (const host of ['', 'https://api.deepseek.com', 'https://api.deepseek.com/beta', 'https://api.deepseek.com/v1', 'https://api.deepseek.com/anthropic'])
      assert.equal(url(host), 'https://api.deepseek.com/anthropic/v1/messages', host);
    for (const host of ['https://proxy.example', 'https://proxy.example/v1', 'https://proxy.example/anthropic', 'https://proxy.example/anthropic/'])
      assert.equal(url(host), 'https://proxy.example/anthropic/v1/messages', host);
  });

});
