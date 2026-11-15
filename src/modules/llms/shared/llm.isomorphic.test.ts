/// <reference types="node" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { llmsServerKeyForHost } from './llm.isomorphic';

const KEY = 'server-key';
const GROQ = 'https://api.groq.com/openai';

test('llmsServerKeyForHost: no client host uses the server key', () => {
  assert.equal(llmsServerKeyForHost('', KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost(undefined, KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost('', undefined, GROQ), '');
});

test('llmsServerKeyForHost: exact server host (normalized) uses the server key', () => {
  assert.equal(llmsServerKeyForHost(GROQ, KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost('https://api.groq.com/openai/', KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost('api.groq.com/openai', KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost('https://API.groq.com/openai', KEY, GROQ), KEY);
  assert.equal(llmsServerKeyForHost('https://api.anthropic.com', KEY, 'api.anthropic.com'), KEY);
  assert.equal(llmsServerKeyForHost('https://api.kimi.com/coding', KEY, 'https://api.moonshot.ai', 'https://api.kimi.com/coding'), KEY);
});

test('llmsServerKeyForHost: other hosts get no server key', () => {
  assert.equal(llmsServerKeyForHost('https://evil.example.com/openai', KEY, GROQ), '');
  assert.equal(llmsServerKeyForHost('https://api.groq.com.evil.com/openai', KEY, GROQ), '');
  assert.equal(llmsServerKeyForHost('http://api.groq.com/openai', KEY, GROQ), '');
});

test('llmsServerKeyForHost: same origin but different path, query or fragment gets no server key', () => {
  for (const host of [
    'https://api.groq.com',
    'https://api.groq.com/openai/v1/files',
    'https://api.groq.com/openai/v1/files?',
    'https://api.groq.com/openai?x=1',
    'https://api.groq.com/openai#',
    'https://api.groq.com/openai/../files',
    'https://api.groq.com/openai/%2e%2e/files',
    'https://api.groq.com/openai\\..\\files',
    'https://user:pass@api.groq.com/openai',
    'https://api.groq.com/openai //x',
    'https://api.groq.com/openai//',
  ])
    assert.equal(llmsServerKeyForHost(host, KEY, GROQ), '', host);
});
