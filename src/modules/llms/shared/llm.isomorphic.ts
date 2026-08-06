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
 * True when the configured host points at the real OpenAI API (empty = use default = native, or explicitly api.openai.com).
 * False for OpenAI-compatible proxies configured via `oaiHost` (MiniMax, ChutesAI, Fireworks, Novita, self-hosted, ...).
 */
export function llmsIsNativeOpenAIHost(oaiHost: string | undefined): boolean {
  return !oaiHost || llmsHostnameMatches(oaiHost, 'api.openai.com');
}
