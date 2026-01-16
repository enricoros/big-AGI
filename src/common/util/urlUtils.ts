// noinspection JSUnresolvedReference

import { Is, isBrowser } from './pwaUtils';

/**
 * Return the base URL for the current environment.
 *  - browser: '' (relative url)
 *  - SSR: vercel url
 *  - dev SSR: localhost
 */
export function getBaseUrl(): string {
  if (isBrowser) return ''; // browser should use relative url
  if (Is.Deployment.VercelFromBackendOrSSR) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  // NOTE: untested with https://localhost:3000
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

/**
 * Return the origin for the current environment.
 *  - http/https://...
 */
export function getOriginUrl(): string {
  if (isBrowser) return window.location.origin;
  if (Is.Deployment.VercelFromBackendOrSSR) return `https://${process.env.VERCEL_URL}`;
  // NOTE: untested with https://localhost:3000
  return `http://localhost:${process.env.PORT ?? 3000}`;
}


/**
 * Returns the domain of a website
 * */
export function urlExtractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Simplifies a URL to its origin and path (removes query and hash)
 */
export function urlPrettyHref(href: string, removeHttps: boolean, removeTrailingSlash: boolean): string {
  try {
    const url = new URL(href);
    let cleaner = decodeURIComponent(url.origin + url.pathname);
    if (removeHttps) cleaner = cleaner.replace(/^https?:\/\//, '');
    if (removeTrailingSlash) cleaner = cleaner.replace(/\/$/, '');
    return cleaner;
  } catch {
    return href;
  }
}


/**
 * Checks if a URL hostname points to a local/private network address.
 * Matches: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x, ::1, etc.
 */
export function isLocalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // localhost
    if (hostname === 'localhost') return true;

    // IPv6 loopback
    if (hostname === '::1' || hostname === '[::1]') return true;

    // IPv4 patterns
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 127.x.x.x (loopback)
      if (a === 127) return true;
      // 10.x.x.x (private class A)
      if (a === 10) return true;
      // 172.16.x.x - 172.31.x.x (private class B)
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.x.x (private class C)
      if (a === 192 && b === 168) return true;
    }

    return false;
  } catch {
    return false;
  }
}


/**
 * If the string is a valid URL, return it. Otherwise, return null.
 */
export function asValidURL(textString: string | null, relaxProtocol: boolean = false /*, strictMode: boolean = false*/): string | null {

  // basic input validation
  if (!textString) return null;
  const trimmed = textString.trim();
  if (!trimmed) return null;

  try {
    // relax protocol to https if missing
    let urlString = trimmed;
    if (relaxProtocol && !/^https?:\/\//i.test(trimmed) && trimmed.includes('.'))
      urlString = 'https://' + trimmed;

    // throw if URL is invalid
    const url = new URL(urlString);

    // protocol must be http(s)
    if (!['http:', 'https:'].includes(url.protocol))
      return null;

    // strict mode: extra validations
    /*if (strictMode) {

      // no IP addresses in strict mode
      if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname))
        return null;

      // no credentials in strict mode
      if (url.username || url.password)
        return null;
    }*/

    // Return the normalized URL
    return url.toString();

  } catch (e) {
    return null;
  }
}

/**
 * Extracts URLs from a text string.
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/\S+)/g;
  return text.match(urlRegex) || [];
}



// added for future in-app routing
// export namespace SearchParams {
//
//   /** Checks if a search parameter exists */
//   export function hasParam(key: string): boolean {
//     return _parse().has(key);
//   }
//
//   /** Gets a search parameter by key */
//   export function getParam(key: string, defaultValue = ''): string {
//     const value = _parse().get(key);
//     return value !== null ? value : defaultValue;
//   }
//
//   /** Updates or adds a search parameter */
//   export function updateParam(key: string, value: string): void {
//     const searchParams = _parse();
//     searchParams.set(key, value);
//     _update(searchParams);
//   }
//
//   /** Removes a search parameter */
//   export function removeParam(key: string): void {
//     const searchParams = _parse();
//     searchParams.delete(key);
//     _update(searchParams);
//   }
//
//
//   function _parse(): URLSearchParams {
//     if (!isBrowser) return new URLSearchParams();
//
//     try {
//       return new URL(window.location.href).searchParams;
//     } catch (error) {
//       console.error('[DEV] SearchParams: error parsing URL:', error);
//       return new URLSearchParams();
//     }
//   }
//
//   /** Updates the URL with the provided search parameters */
//   function _update(searchParams: URLSearchParams): void {
//     if (!isBrowser) return;
//
//     try {
//       window.history.replaceState(
//         {},
//         '',
//         `${window.location.pathname}?${searchParams.toString()}`,
//       );
//     } catch (error) {
//       console.error('[DEV] SearchParams: error updating URL:', error);
//     }
//   }
// }
