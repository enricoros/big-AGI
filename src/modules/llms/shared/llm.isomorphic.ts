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
 * The server key, only for requests to the server's own endpoint: no client host, or a client host with the same origin as
 * one of `serverHosts` (the env host, else the vendor default). A client-set host elsewhere owns the whole request and must
 * bring its own key - otherwise any caller could point the host at its own server and receive the deployment's key.
 */
export function llmsServerKeyForHost(clientHost: string | null | undefined, serverKey: string | undefined, ...serverHosts: string[]): string {
  if (!serverKey) return '';
  if (!clientHost) return serverKey;
  const clientOrigin = _hostOrigin(clientHost);
  return clientOrigin && serverHosts.some(host => _hostOrigin(host) === clientOrigin) ? serverKey : '';
}

function _hostOrigin(host: string): string | null {
  try {
    return new URL(host.startsWith('http') ? host : `https://${host}`).origin;
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
