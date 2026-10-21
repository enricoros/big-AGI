// Shared LLM helpers; work and safe to bundle on both server and client
// This file is pure: no server env, no trpc client, just string/URL manipulation

/**
 * Add https if missing, and remove trailing slash if present and the path starts with a slash.
 */
export function llmsFixupHost(host: string, apiPath: string): string {
  if (!host)
    return '';
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}

/**
 * Safely check if a host URL's hostname matches the expected hostname.
 * Prevents DNS spoofing where hosts like "api.openai.com.evil.com" pass naive `.includes()` checks.
 */
export function llmsHostnameMatches(hostUrl: string | undefined, expectedHostname: string): boolean {
  if (!hostUrl)
    return false;
  try {
    const url = new URL(hostUrl.startsWith('http') ? hostUrl : `https://${hostUrl}`);
    return url.hostname === expectedHostname;
  } catch {
    return false;
  }
}

/**
 * The server key, only for requests to the server's own endpoint: no client host, or a client host equal to one of
 * `serverHosts` (the env host, else the vendor default) after normalization - same origin AND same path, no query,
 * fragment or credentials. The request URL is `clientHost + apiPath`, so matching the origin alone would let a caller
 * steer the deployment's key to any path on the vendor API; a client-set host elsewhere must bring its own key.
 */
export function llmsServerKeyForHost(clientHost: string | null | undefined, serverKey: string | undefined, ...serverHosts: string[]): string {
  if (!serverKey) return '';
  if (!clientHost) return serverKey;
  const clientBase = _hostNormalizedBase(clientHost);
  return clientBase && serverHosts.some(host => _hostNormalizedBase(host) === clientBase) ? serverKey : '';
}

/** `origin + path` (one trailing slash dropped, as llmsFixupHost does), or null for anything that could alter the request URL. */
function _hostNormalizedBase(host: string): string | null {
  // only printable ASCII, and no '?', '#', '@', '\\', '%': those would change how `host + apiPath` resolves
  if (/[^\x21-\x7e]|[?#@\\%]/.test(host)) return null;
  try {
    const url = new URL(host.startsWith('http') ? host : `https://${host}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    return url.origin + path;
  } catch {
    return null;
  }
}

/**
 * True when the configured host points at the real OpenAI API (empty = use default = native, or explicitly api.openai.com).
 * False for OpenAI-compatible proxies configured via `oaiHost` (MiniMax, ChutesAI, Fireworks, Novita, self-hosted, ...).
 */
export function llmsIsNativeOpenAIHost(oaiHost: string | undefined): boolean {
  return !oaiHost || llmsHostnameMatches(oaiHost, 'api.openai.com');
}

/**
 * True when the configured host points at the real Gemini API (empty = use default = native).
 * False for Gemini-compatible proxies configured via `geminiHost`.
 */
export function llmsIsNativeGeminiHost(geminiHost: string | undefined): boolean {
  return !geminiHost || llmsHostnameMatches(geminiHost, 'generativelanguage.googleapis.com');
}
