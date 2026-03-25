import test from 'node:test';
import assert from 'node:assert/strict';

import { OPENAI_API_PATHS, openAIAccess } from './openai.access';


test('openAIAccess drops legacy dummy keys for custom OpenAI-compatible hosts', () => {
  const { headers, url } = openAIAccess({
    dialect: 'openai',
    clientSideFetch: false,
    oaiKey: '!',
    oaiOrg: '',
    oaiHost: 'https://cliproxy.aviatests.com',
    heliKey: '',
  }, null, OPENAI_API_PATHS.models);

  assert.equal(url, 'https://cliproxy.aviatests.com/v1/models');
  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
  });
});

test('openAIAccess still requires a real key for the default OpenAI host', () => {
  assert.throws(() => openAIAccess({
    dialect: 'openai',
    clientSideFetch: false,
    oaiKey: '!',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }, null, OPENAI_API_PATHS.models), /Missing OpenAI API Key/);
});
