/// <reference types="node" />

// Web search provider registry (issue #536): registration, selection with
// fallback, and the provider contract the search consumers rely on.
// Run: `npx tsx --test src/modules/search/search.provider.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { WebSearchProvider, WebSearchRequest, WebSearchResults } from './search.provider';
import { getActiveSearchProvider, getSearchProvider, registerSearchProvider } from './search.provider';
import { webSearchProviderGoogleCse } from '~/modules/google/search.provider.google';
import { useGoogleSearchStore } from '~/modules/google/store-module-google';
import { DEFAULT_SEARCH_PROVIDER_ID, useSearchStore } from './store-module-search';


// ---- provider fixture: a stand-in for the next backend (e.g. SearXNG) ----

const TEST_PROVIDER_ID = 'test-provider';

const testProvider: WebSearchProvider = {
  id: TEST_PROVIDER_ID,
  isConfigured: () => true,
  search: async (_request: WebSearchRequest): Promise<WebSearchResults> => ({
    pages: [{ title: 'Example', link: 'https://example.com/page', snippet: 'An example snippet' }],
  }),
};

registerSearchProvider(testProvider);

// restore shared state (google credentials store, selection) after each test
const googleKeys = { googleCloudApiKey: '', googleCSEId: '' };
const _afterEach = (fn: () => void) => async () => {
  try {
    await fn();
  } finally {
    useGoogleSearchStore.setState(googleKeys);
    useSearchStore.setState({ searchBackend: DEFAULT_SEARCH_PROVIDER_ID });
  }
};


describe('web search provider registry', () => {

  it('registers google-cse as the built-in default', _afterEach(() => {
    assert.equal(DEFAULT_SEARCH_PROVIDER_ID, 'google-cse');
    assert.equal(getSearchProvider('google-cse'), webSearchProviderGoogleCse);
    assert.equal(getActiveSearchProvider().id, 'google-cse');
  }));

  it('returns undefined for unknown providers', () => {
    assert.equal(getSearchProvider('no-such-backend'), undefined);
  });

  it('warns [DEV] on duplicate registration, keeping the latest provider', () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => { warnings.push(String(args[0])); };
    try {
      registerSearchProvider(webSearchProviderGoogleCse);
    } finally {
      console.warn = origWarn;
    }
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('[DEV]'), `not a [DEV] warning: ${warnings[0]}`);
    assert.ok(warnings[0].includes('google-cse'), `no id in warning: ${warnings[0]}`);
    assert.equal(getSearchProvider('google-cse'), webSearchProviderGoogleCse);
  });

  it('selects the configured backend, falling back to the default on unknown or stale selections', _afterEach(() => {
    useSearchStore.getState().setSearchBackend(TEST_PROVIDER_ID);
    assert.equal(getActiveSearchProvider().id, TEST_PROVIDER_ID);

    useSearchStore.getState().setSearchBackend('backend-removed-last-year');
    assert.equal(getActiveSearchProvider().id, DEFAULT_SEARCH_PROVIDER_ID);

    useSearchStore.getState().setSearchBackend('');
    assert.equal(getActiveSearchProvider().id, DEFAULT_SEARCH_PROVIDER_ID);
  }));

  it('accepts a new provider without changes to the consumer contract', async () => {
    useSearchStore.getState().setSearchBackend(TEST_PROVIDER_ID);
    const results = await getActiveSearchProvider().search({ query: 'q', items: 10 });
    assert.equal(results.pages.length, 1);
    const page = results.pages[0];
    // Search.API.BriefResult shape: { title, link, snippet }
    assert.equal(typeof page.title, 'string');
    assert.equal(typeof page.link, 'string');
    assert.equal(typeof page.snippet, 'string');
  });

});

describe('google-cse provider', () => {

  it('is unconfigured with no client keys and no server conf', _afterEach(() => {
    assert.equal(webSearchProviderGoogleCse.isConfigured(), false);
  }));

  it('is configured with valid client keys', _afterEach(() => {
    useGoogleSearchStore.setState({ googleCloudApiKey: 'A'.repeat(39), googleCSEId: 'C'.repeat(17) });
    assert.equal(webSearchProviderGoogleCse.isConfigured(), true);
  }));

  it('is unconfigured when either credential is missing or malformed', _afterEach(() => {
    useGoogleSearchStore.setState({ googleCloudApiKey: 'A'.repeat(39), googleCSEId: 'short' });
    assert.equal(webSearchProviderGoogleCse.isConfigured(), false);

    useGoogleSearchStore.setState({ googleCloudApiKey: '', googleCSEId: 'C'.repeat(17) });
    assert.equal(webSearchProviderGoogleCse.isConfigured(), false);
  }));

});
