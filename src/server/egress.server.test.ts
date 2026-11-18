/// <reference types="node" />

// Outbound-URL policy for client-supplied hosts. Offline: DNS is injected.
// Run: `NODE_ENV=development npx tsx --test src/server/egress.server.test.ts`

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { egressAssertClientUrlOrThrow, egressIsBlockedIp, egressIsInternalHostname } from './egress.server';


const publicDns = async () => ['93.184.216.34'];
const privateDns = async () => ['93.184.216.34', '10.0.0.5'];

const allowed = async (url: string, extra: Partial<Parameters<typeof egressAssertClientUrlOrThrow>[1]> = {}): Promise<void> => {
  await egressAssertClientUrlOrThrow(url, { kind: 'api-host', label: 'Test', resolver: publicDns, allowedPrivateHosts: '', ...extra });
};

const blocked = (url: string, extra: Partial<Parameters<typeof egressAssertClientUrlOrThrow>[1]> = {}) =>
  assert.rejects(allowed(url, extra), /destination not allowed/, url);


describe('egress: IP ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '64:ff9b::a00:1', '2002:a00:1::', '2001:db8::1', 'not-an-ip'])
    it(`blocks ${ip}`, () => assert.equal(egressIsBlockedIp(ip), true));
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808'])
    it(`allows ${ip}`, () => assert.equal(egressIsBlockedIp(ip), false));
});

describe('egress: hostnames', () => {
  for (const h of ['localhost', 'api.localhost', 'printer.local', 'metadata.google.internal', 'localai', 'router.home.arpa'])
    it(`internal ${h}`, () => assert.equal(egressIsInternalHostname(h), true));
  it('public api.inworld.ai', () => assert.equal(egressIsInternalHostname('api.inworld.ai'), false));
});

describe('egress: api-host', () => {
  it('allows a public host, scheme-less', () => allowed('api.inworld.ai'));
  it('allows a public https URL with path', () => allowed('https://proxy.example.com/v1'));
  it('blocks the metadata IP', () => blocked('http://169.254.169.254/latest/meta-data/?'));
  it('blocks integer-encoded loopback', () => blocked('http://2130706433/'));
  it('blocks hex-encoded loopback', () => blocked('http://0x7f.0.0.1/'));
  it('blocks IPv6 loopback', () => blocked('http://[::1]:8080'));
  it('blocks IPv4-mapped IPv6', () => blocked('http://[::ffff:169.254.169.254]/'));
  it('blocks localhost', () => blocked('http://localhost:8080'));
  it('blocks a host resolving to a private IP', () => blocked('https://rebind.example.com', { resolver: privateDns }));
  it('blocks an unresolvable host', () => blocked('https://nx.example.com', { resolver: async () => [] }));
  it('blocks a resolver failure', () => blocked('https://err.example.com', { resolver: async () => { throw new Error('x'); } }));
  it('blocks non-http schemes', () => blocked('file:///etc/passwd'));
  it('blocks httpx: lookalike', () => blocked('httpx://example.com'));
  it('blocks userinfo', () => blocked('https://user:pw@example.com'));
  it('blocks query', () => blocked('https://example.com/?'));
  it('blocks fragment', () => blocked('https://example.com/#'));
  it('allowlist: host:port', () => allowed('http://localhost:8080', { allowedPrivateHosts: 'localhost:8080' }));
  it('allowlist: wrong port still blocked', () => blocked('http://localhost:9000', { allowedPrivateHosts: 'localhost:8080' }));
  it('allowlist: bare host', () => allowed('localai:8080', { defaultScheme: 'http', allowedPrivateHosts: 'localai' }));
  it('allowlist: wildcard', () => allowed('http://10.0.0.5:9200', { allowedPrivateHosts: '*' }));
  it('allowlist does not bypass syntax rules', () => blocked('http://localhost:8080/?', { allowedPrivateHosts: '*' }));
});

describe('egress: websocket', () => {
  const ws = { kind: 'websocket' as const };
  it('allows a public wss endpoint with auth and token', () => allowed('wss://user:pw@chrome.example.com?token=abc', ws));
  it('blocks internal CDP', () => blocked('ws://10.0.0.5:9222', ws));
  it('blocks http scheme', () => blocked('http://chrome.example.com', ws));
  it('allowlisted local browser', () => allowed('ws://127.0.0.1:9222', { ...ws, allowedPrivateHosts: '127.0.0.1:9222' }));
});
