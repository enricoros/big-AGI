// noinspection JSUnresolvedReference

import { isBrowser, isVercelFromBackendOrSSR } from './pwaUtils';

/**
 * Return the base URL for the current environment.
 *  - browser: '' (relative url)
 *  - SSR: vercel url
 *  - dev SSR: localhost
 */
export function getBaseUrl(): string {
  if (isBrowser) return ''; // browser should use relative url
  if (isVercelFromBackendOrSSR) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

/**
 * Return the origin for the current environment.
 *  - http/https://...
 */
export function getOriginUrl(): string {
  if (isBrowser) return window.location.origin;
  if (isVercelFromBackendOrSSR) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}


/**
 * If the string is a valid URL, return it. Otherwise, return null.
 */
export function asValidURL(textString: string | null): string | null {
  if (!textString) return null;
  const urlRegex = /^(https?:\/\/\S+)$/g;
  const trimmedTextString = textString.trim();
  const urlMatch = urlRegex.exec(trimmedTextString);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Add https if missing, and remove trailing slash if present and the path starts with a slash.
 */
export function fixupHost(host: string, apiPath: string): string {
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}