/// <reference types="node" />

// Client-set LLM hosts vs the outbound policy. Offline: literal IPs and loopback names only.
// Run: `NODE_ENV=development npx tsx --test src/modules/llms/server/llm.server.egress.test.ts`

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { llmsAssertClientHostOrThrow } from './llm.server.egress';


const ollama = (ollamaHost: string) => llmsAssertClientHostOrThrow({ dialect: 'ollama', ollamaHost });
const oai = (dialect: 'lmstudio' | 'localai' | 'openai', oaiHost: string) => llmsAssertClientHostOrThrow({ dialect, oaiKey: 'k', oaiOrg: '', oaiHost });
const anthropic = (anthropicHost: string) => llmsAssertClientHostOrThrow({ dialect: 'anthropic', anthropicKey: 'k', anthropicHost });
const rejected = (p: Promise<void>, label: string) => assert.rejects(p, /destination not allowed/, label);


describe('llmsAssertClientHostOrThrow', () => {

  it('allows an empty host (server endpoint)', async () => {
    await ollama('');
    await oai('openai', '');
    await anthropic('');
  });

  it('allows the local dialect defaults with no configuration', async () => {
    await ollama('http://127.0.0.1:11434');
    await ollama('http://localhost:11434');
    await ollama('localhost:11434');
    await oai('lmstudio', 'http://localhost:1234');
    await oai('lmstudio', 'http://127.0.0.1:1234/v1');
    await oai('localai', 'http://127.0.0.1:8080');
  });

  it('rejects other loopback ports and private, link-local and metadata hosts', async () => {
    await rejected(ollama('http://127.0.0.1:6379'), 'loopback other port');
    await rejected(ollama('http://10.0.0.5:11434'), 'private');
    await rejected(oai('lmstudio', 'http://localhost:11434'), 'other dialect default');
    await rejected(oai('openai', 'http://169.254.169.254'), 'metadata');
    await rejected(oai('localai', 'http://[::ffff:127.0.0.1]:9000'), 'mapped loopback');
    await rejected(anthropic('http://192.168.1.1'), 'private');
    await rejected(anthropic('http://localhost:8080'), 'localhost');
  });

  it('rejects non-http(s) schemes', async () => {
    await assert.rejects(ollama('file:///etc/passwd'));
    await assert.rejects(oai('openai', 'gopher://example.com'));
  });

});
