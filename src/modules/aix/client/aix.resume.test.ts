import assert from 'node:assert/strict';
import test from 'node:test';

import { aixSupportsUpstreamReattach } from './aix.resume';


test('aixSupportsUpstreamReattach allows default OpenAI access and official OpenAI hosts', () => {
  assert.equal(aixSupportsUpstreamReattach({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  } as any), true);

  assert.equal(aixSupportsUpstreamReattach({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: 'https://api.openai.com',
    heliKey: '',
  } as any), true);
});

test('aixSupportsUpstreamReattach rejects custom OpenAI-compatible proxy hosts', () => {
  assert.equal(aixSupportsUpstreamReattach({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: 'https://proxy.example.invalid',
    heliKey: '',
  } as any), false);
});

test('aixSupportsUpstreamReattach rejects non-openai dialects', () => {
  assert.equal(aixSupportsUpstreamReattach({
    dialect: 'openrouter',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  } as any), false);
});
