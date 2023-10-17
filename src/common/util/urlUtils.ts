/**
 * Return the base URL for the current environment.
 *  - browser: '' (relative url)
 *  - SSR: vercel url
 *  - dev SSR: localhost
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

/**
 * Return the origin for the current environment.
 *  - http/https://...
 */
export function getOriginUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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