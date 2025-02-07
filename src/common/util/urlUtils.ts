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
 * Add https if missing, and remove trailing slash if present and the path starts with a slash.
 */
export function fixupHost(host: string, apiPath: string): string {
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}

/**
 * Extracts URLs from a text string.
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/\S+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Creates a Blob Object URL (that can be opened in a new tab with window.open, for instance)
 */
export function createBlobURLFromData(base64Data: string, mimeType: string) {
  const byteArray = base64ToUint8Array(base64Data);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function base64ToUint8Array(base64Data: string) {
  const binaryString = atob(base64Data);
  return Uint8Array.from(binaryString, char => char.charCodeAt(0));
}

export function base64ToArrayBuffer(base64Data: string) {
  return base64ToUint8Array(base64Data).buffer;
}


/**
 * Creates a Blob Object URL (that can be opened in a new tab with window.open, for instance) from a Data URL
 */
export function createBlobURLFromDataURL(dataURL: string) {
  if (!dataURL.startsWith('data:')) {
    console.error('createBlobURLFromDataURL: Invalid data URL', dataURL);
    return null;
  }
  const mimeType = dataURL.slice(5, dataURL.indexOf(';'));
  const base64Data = dataURL.slice(dataURL.indexOf(',') + 1);
  if (!mimeType || !base64Data) {
    console.error('createBlobURLFromDataURL: Invalid data URL', dataURL);
    return null;
  }
  return createBlobURLFromData(base64Data, mimeType);
}
