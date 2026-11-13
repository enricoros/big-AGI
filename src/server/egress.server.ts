/**
 * Outbound-URL policy for client-supplied destinations (custom API hosts, browser endpoints).
 *
 * The server fetches whatever host a caller puts in `access.apiHost` / `access.wssEndpoint`, so those
 * values must not reach loopback, private, link-local or cloud-metadata addresses. Rules:
 * - scheme in the allowed set (http/https for API hosts, ws/wss for browser endpoints)
 * - API hosts are concatenated with a path: no userinfo, '?' or '#'
 * - hostname must not be an internal name (localhost, *.local, *.internal, single-label, ...)
 * - every DNS-resolved address must be public (literal IPs are checked directly)
 * - operators can exempt hosts via SERVER_ALLOWED_PRIVATE_HOSTS (comma-separated host or host:port, or '*')
 *
 * Limitation: the check resolves before the fetch, so a DNS-rebinding host could still flip between
 * the two lookups; redirects must be disabled by the caller (`redirect: 'error'`).
 */

import { TRPCError } from '@trpc/server';

import { env } from '~/server/env.server';


// configuration
const DOH_ENDPOINTS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'] as const;
const DOH_TIMEOUT_MS = 3000;
const DNS_CACHE_TTL_MS = 60 * 1000;
const DNS_CACHE_MAX = 500;


export type EgressUrlKind = 'api-host' | 'websocket';

/** Resolves a hostname to all its IPv4/IPv6 addresses; throws or returns [] when unresolvable. */
export type EgressDnsResolver = (hostname: string) => Promise<string[]>;


/**
 * Validates a client-supplied destination; throws a TRPCError BAD_REQUEST if not allowed.
 * @param rawUrl the value as sent by the client (a scheme-less host gets `defaultScheme`)
 */
export async function egressAssertClientUrlOrThrow(
  rawUrl: string,
  options: {
    kind: EgressUrlKind;
    label: string;
    defaultScheme?: 'http' | 'https';
    resolver?: EgressDnsResolver;
    allowedPrivateHosts?: string; // defaults to env.SERVER_ALLOWED_PRIVATE_HOSTS
  },
): Promise<URL> {
  const { kind, label } = options;
  const reject = (reason: string): never => {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `${label}: destination not allowed (${reason}).` });
  };

  // parse
  let input = rawUrl.trim();
  if (!input) reject('empty');
  if (kind === 'api-host' && !input.startsWith('http'))
    input = `${options.defaultScheme ?? 'https'}://${input}`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return reject('invalid URL');
  }

  // syntax
  const allowedSchemes = kind === 'api-host' ? ['http:', 'https:'] : ['ws:', 'wss:'];
  if (!allowedSchemes.includes(url.protocol))
    reject(`scheme must be ${allowedSchemes.map(s => s.slice(0, -1)).join(' or ')}`);
  if (kind === 'api-host') {
    if (url.username || url.password || input.includes('@')) reject('credentials in URL');
    if (input.includes('?') || input.includes('#')) reject('query or fragment in host');
  }
  if (input.includes('#')) reject('fragment in URL');

  // operator allowlist (still subject to the syntax rules above)
  if (egressIsHostAllowlisted(url, options.allowedPrivateHosts ?? env.SERVER_ALLOWED_PRIVATE_HOSTS))
    return url;

  // hostname / IP literal
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const literalIp = hostname.startsWith('[') ? hostname.slice(1, -1) : _isIPv4(hostname) ? hostname : null;
  if (literalIp) {
    if (egressIsBlockedIp(literalIp)) reject('private or reserved address');
    return url;
  }
  if (egressIsInternalHostname(hostname)) reject('internal hostname');

  // DNS: every address must be public
  let addresses: string[];
  try {
    addresses = await (options.resolver ?? egressResolveDoH)(hostname);
  } catch {
    return reject('hostname did not resolve');
  }
  if (!addresses.length) reject('hostname did not resolve');
  if (addresses.some(egressIsBlockedIp)) reject('resolves to a private or reserved address');

  return url;
}


// Allowlist

export function egressIsHostAllowlisted(url: URL, allowlist: string | undefined): boolean {
  if (!allowlist) return false;
  const entries = allowlist.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (entries.includes('*')) return true;
  const hostname = url.hostname.toLowerCase();
  const port = url.port || _defaultPort(url.protocol);
  return entries.includes(hostname) || entries.includes(`${hostname}:${port}`);
}

function _defaultPort(protocol: string): string {
  return protocol === 'https:' || protocol === 'wss:' ? '443' : '80';
}


// Hostnames

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.intranet', '.lan', '.home', '.corp', '.home.arpa', '.in-addr.arpa', '.ip6.arpa'] as const;

export function egressIsInternalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.')) return true; // localhost, docker/k8s service names, 'metadata', ...
  return INTERNAL_SUFFIXES.some(suffix => h.endsWith(suffix));
}


// IP ranges

const BLOCKED_IPV4_CIDRS: readonly [string, number][] = [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // carrier-grade NAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local, cloud metadata
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // TEST-NET-1
  ['192.88.99.0', 24],  // 6to4 relay anycast
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24],  // TEST-NET-3
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved, broadcast
];

/** True for loopback, private, link-local, metadata, reserved and unparsable addresses (IPv4 or IPv6). */
export function egressIsBlockedIp(ip: string): boolean {
  const v4 = _parseIPv4(ip);
  if (v4 !== null)
    return BLOCKED_IPV4_CIDRS.some(([base, bits]) => _inCidr4(v4, _parseIPv4(base)!, bits));

  const v6 = _parseIPv6(ip);
  if (!v6) return true; // fail closed

  const [h0, h1, h2, h3, h4, h5, h6, h7] = v6;
  const embeddedV4 = ((h6 << 16) >>> 0) + h7;
  const isBlockedV4 = (n: number) => BLOCKED_IPV4_CIDRS.some(([base, bits]) => _inCidr4(n, _parseIPv4(base)!, bits));

  // ::/96 (unspecified, loopback, IPv4-compatible) and ::ffff:0:0/96 (IPv4-mapped)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && (h5 === 0 || h5 === 0xffff))
    return h5 === 0 ? true : isBlockedV4(embeddedV4);
  // 64:ff9b::/96 NAT64, 64:ff9b:1::/48 local NAT64
  if (h0 === 0x64 && h1 === 0xff9b)
    return h2 === 1 || isBlockedV4(embeddedV4);
  // 2002::/16 6to4: embedded IPv4 in bits 16-47
  if (h0 === 0x2002)
    return isBlockedV4(((h1 << 16) >>> 0) + h2);
  // 2001::/32 Teredo, 2001:db8::/32 documentation
  if (h0 === 0x2001 && (h1 === 0 || h1 === 0xdb8)) return true;
  // 100::/64 discard
  if (h0 === 0x100 && h1 === 0 && h2 === 0 && h3 === 0) return true;
  // fc00::/7 unique-local, fe80::/10 link-local, fec0::/10 site-local, ff00::/8 multicast
  if ((h0 & 0xfe00) === 0xfc00 || (h0 & 0xffc0) === 0xfe80 || (h0 & 0xffc0) === 0xfec0 || (h0 & 0xff00) === 0xff00) return true;

  return false;
}

function _isIPv4(s: string): boolean {
  return _parseIPv4(s) !== null;
}

function _parseIPv4(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some(o => o > 255)) return null;
  return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function _inCidr4(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((ip & mask) >>> 0) === ((base & mask) >>> 0);
}

function _parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(':')) return null;

  // trailing dotted IPv4 -> 2 hex groups
  const lastColon = s.lastIndexOf(':');
  const maybeV4 = s.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    const v4 = _parseIPv4(maybeV4);
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const explicit = head.length + rest.length;
  if (parts.length === 1 ? explicit !== 8 : explicit > 7) return null;

  const groups = [...head, ...new Array<string>(8 - explicit).fill('0'), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}


// DNS-over-HTTPS resolver - for the Edge runtime, which has no `dns` module

const _dnsCache = new Map<string, { addresses: string[]; expires: number }>();

export const egressResolveDoH: EgressDnsResolver = async (hostname) => {
  const cached = _dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.addresses;

  const [a, aaaa] = await Promise.all([_dohQuery(hostname, 'A'), _dohQuery(hostname, 'AAAA')]);
  const addresses = [...a, ...aaaa];

  if (_dnsCache.size >= DNS_CACHE_MAX) _dnsCache.clear();
  _dnsCache.set(hostname, { addresses, expires: Date.now() + DNS_CACHE_TTL_MS });
  return addresses;
};

async function _dohQuery(hostname: string, type: 'A' | 'AAAA'): Promise<string[]> {
  const typeCode = type === 'A' ? 1 : 28;
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const json = await response.json() as { Status?: number; Answer?: { type?: number; data?: string }[] };
      if (json.Status === 3) return []; // NXDOMAIN
      if (json.Status !== 0) continue;
      return (json.Answer ?? []).filter(r => r.type === typeCode && typeof r.data === 'string').map(r => r.data!);
    } catch {
      // try the next endpoint
    }
  }
  throw new Error('DNS-over-HTTPS resolution failed');
}
