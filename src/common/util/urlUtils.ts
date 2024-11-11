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
