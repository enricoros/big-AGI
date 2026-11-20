/// <reference types="node" />

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createTRPCRouter } from '~/server/trpc/trpc.server';
import { googleSearchRouter } from '~/modules/google/search.router';
import { useGoogleSearchStore } from '~/modules/google/store-module-google';

import { callApiWebSearch } from './search.client';
import { contextSearchRouter } from './search.router';
import { useWebSearchStore } from './store-module-websearch';


const originalFetch = globalThis.fetch;
const originalGoogle = useGoogleSearchStore.getState();
const originalSearch = useWebSearchStore.getState();
const router = createTRPCRouter({ contextSearch: contextSearchRouter, googleSearch: googleSearchRouter });
const upstreams: { url: string, body?: object }[] = [];

beforeEach(() => {
  // No localStorage in this Node transport test; persistence is exercised in the browser.
  mock.method(console, 'warn', () => undefined);
  useWebSearchStore.setState({ providerId: 'google', contextApiKey: '', contextRestrictToDomain: '' });
  useGoogleSearchStore.setState({ googleCloudApiKey: 'google-test-key', googleCSEId: 'google-test-cse', restrictToDomain: 'google.example.com' });
  upstreams.length = 0;
  globalThis.fetch = async (url, init) => {
    const request = new Request(url, init);
    if (request.url.includes('/api/edge/'))
      return fetchRequestHandler({ endpoint: '/api/edge', req: request, router, createContext: async () => ({ hostName: 'localhost', reqSignal: request.signal }) });
    upstreams.push({ url: request.url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (request.url.startsWith('https://www.googleapis.com/customsearch/v1?'))
      return Response.json({ items: [{ title: 'Google source', link: 'https://google.example.com/source', snippet: 'Google snippet' }] });
    assert.equal(request.url, 'https://api.context.dev/v1/web/search');
    return Response.json({ results: [{ title: 'Context source', url: 'https://context.example.com/source', description: 'Context snippet', highlights: { code: 'SUCCESS', highlights: ['Context snippet'] } }] });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  useGoogleSearchStore.setState(originalGoogle);
  useWebSearchStore.setState(originalSearch);
  mock.restoreAll();
});


describe('standalone search from client settings through tRPC', () => {
  test('defaults to Google and preserves the existing credentials and domain filter', async () => {
    assert.equal(originalSearch.providerId, 'google');
    assert.deepEqual(await callApiWebSearch('default provider', 10), { pages: [
      { title: 'Google source', link: 'https://google.example.com/source', snippet: 'Google snippet' },
    ] });
    const url = new URL(upstreams[0].url);
    assert.equal(url.searchParams.get('key'), 'google-test-key');
    assert.equal(url.searchParams.get('cx'), 'google-test-cse');
    assert.equal(url.searchParams.get('siteSearch'), 'google.example.com');
    assert.equal(url.searchParams.get('num'), '10');
  });

  test('selects Context without sending Google credentials or changing Google settings', async (t) => {
    const logs: unknown[][] = [];
    t.mock.method(console, 'log', (...args: unknown[]) => logs.push(args));
    t.mock.method(console, 'error', (...args: unknown[]) => logs.push(args));
    useWebSearchStore.getState().setProviderId('context');
    useWebSearchStore.getState().setContextApiKey('context-client-secret');
    useWebSearchStore.getState().setContextRestrictToDomain('context.example.com');
    assert.deepEqual(await callApiWebSearch('selected provider', 3), { pages: [
      { title: 'Context source', link: 'https://context.example.com/source', snippet: 'Context snippet' },
    ] });
    assert.deepEqual(upstreams, [{ url: 'https://api.context.dev/v1/web/search', body: {
      query: 'selected provider', numResults: 3, highlightsOptions: { enabled: true, maxCharacters: 1000 },
      timeoutOpts: { milliseconds: 15_000, behavior: 'return-partial' }, includeDomains: ['context.example.com'],
    } }]);
    assert.equal(useGoogleSearchStore.getState().googleCloudApiKey, 'google-test-key');
    assert.equal(useGoogleSearchStore.getState().restrictToDomain, 'google.example.com');
    assert.ok(!JSON.stringify(logs).includes('context-client-secret'));
  });

  test('switches back to Google without losing Context settings', async () => {
    useWebSearchStore.setState({ providerId: 'context', contextApiKey: 'context-client-secret', contextRestrictToDomain: 'context.example.com' });
    await callApiWebSearch('context query', 10);
    useWebSearchStore.getState().setProviderId('google');
    await callApiWebSearch('google query', 10, 'override.example.com');
    assert.equal(new URL(upstreams[1].url).searchParams.get('siteSearch'), 'override.example.com');
    assert.equal(useWebSearchStore.getState().contextApiKey, 'context-client-secret');
    assert.equal(useWebSearchStore.getState().contextRestrictToDomain, 'context.example.com');
  });
});
