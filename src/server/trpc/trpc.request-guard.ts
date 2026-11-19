/**
 * Host/Origin guard for the tRPC endpoints, against DNS rebinding and cross-origin calls.
 *
 * DNS rebinding: a page on a public name (e.g. http://rebind.attacker.example:3000) re-points its DNS to 127.0.0.1
 * or a LAN IP, and the browser then treats the local server as same-origin, sending its Host name and reading responses.
 * The server cannot resolve names on the edge, so a public DNS name in Host is trusted only when the browser attests
 * a secure context (TLS binds the name to this server, which rebinding cannot forge):
 * - `Origin` with https (sent on every POST, i.e. all mutations)
 * - `Sec-Fetch-Site` present (browsers send Sec-Fetch-* only to https or localhost, never to http on a public name)
 *
 * Trusted without proof, as public DNS cannot serve them: IP literals, single-label names (localhost, docker service
 * names), and the reserved local suffixes below. Other names (http on a public DNS name, non-browser clients on a public
 * name) need `HTTP_ALLOWED_HOSTS`.
 */

import { env } from '~/server/env.server';


const LOCAL_ONLY_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan'] as const;


export type TRPCRequestGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };


export function trpcRequestGuard(headers: Headers): TRPCRequestGuardResult {
  const host = headers.get('host')?.trim().toLowerCase() || '';
  const hostname = _hostnameOf(host);
  if (!hostname)
    return { allowed: false, reason: 'missing or invalid Host header' };

  // cross-origin: the Origin must be this server, as addressed by the browser (Host) or by a fronting proxy;
  // a port-less Host matches by name, as proxies forwarding nginx's `$host` drop the public port
  const origin = headers.get('origin')?.trim().toLowerCase() || '';
  if (origin) {
    const originUrl = _parseOrigin(origin);
    const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0].trim().toLowerCase() || '';
    const sameOrigin = !!originUrl && (
      originUrl.host === host
      || originUrl.host === forwardedHost
      || (host === hostname && originUrl.hostname === hostname)
    );
    if (!sameOrigin)
      return { allowed: false, reason: `cross-origin request from ${origin}` };
  }

  // DNS rebinding: names that public DNS cannot serve, operator-listed names, or a browser-attested secure context
  if (_isLocalOnlyHostname(hostname) || _isOperatorAllowedHostname(hostname))
    return { allowed: true };
  if (origin.startsWith('https://') || headers.has('sec-fetch-site'))
    return { allowed: true };

  return {
    allowed: false,
    reason: `untrusted Host '${hostname}' over plain http (possible DNS rebinding). Serve over https, or add the name to HTTP_ALLOWED_HOSTS`,
  };
}


function _hostnameOf(host: string): string | null {
  if (!host) return null;
  try {
    const url = new URL(`http://${host}`);
    // reject anything beyond host[:port], e.g. userinfo or paths smuggled into the header
    if (url.host !== host && `${url.host}:80` !== host) return null;
    return url.hostname.replace(/\.$/, '');
  } catch {
    return null;
  }
}

function _parseOrigin(origin: string): URL | null {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url : null;
  } catch {
    return null; // includes the opaque 'null' origin (sandboxed iframes, etc.)
  }
}

function _isLocalOnlyHostname(hostname: string): boolean {
  if (hostname.startsWith('[')) return true; // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true; // IPv4 literal (URL normalizes other forms)
  if (!hostname.includes('.')) return true; // single label, including 'localhost'
  return LOCAL_ONLY_SUFFIXES.some(suffix => hostname.endsWith(suffix));
}

function _isOperatorAllowedHostname(hostname: string): boolean {
  const allowed = env.HTTP_ALLOWED_HOSTS;
  if (!allowed) return false;
  return allowed.split(',').some(entry => {
    const name = entry.trim().toLowerCase().replace(/\.$/, '');
    return name === '*' || name === hostname || (name.startsWith('*.') && hostname.endsWith(name.slice(1)));
  });
}
