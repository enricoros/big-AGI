import { Brand } from '../app.config';

// assume these won't change during the application lifetime
export const isBrowser = typeof window !== 'undefined';

// this sort of detection is brittle, but we use it for very optional features
const safeUA = isBrowser ? window.navigator?.userAgent || '' : '';
export const isIPhoneUser = /iPhone|iPod/.test(safeUA);
export const isMacUser = /Macintosh|MacIntel|MacPPC|Mac68K|iPad/.test(safeUA);
export const isChromeDesktop = safeUA.includes('Chrome') && !safeUA.includes('Mobile');
export const isFirefox = safeUA.includes('Firefox');

// frontend language
const browserLang = isBrowser ? window.navigator.language : '';
export const browserLangOrUS = browserLang || 'en-US';
export const browserLangNotUS = browserLangOrUS !== 'en-US';

// deployment environment
export const isVercelFromBackendOrSSR = !!process.env.VERCEL_ENV;
export const isVercelFromFrontend = !!process.env.NEXT_PUBLIC_VERCEL_URL;

/**
 * Returns 'true' if the application is been executed as a 'pwa' (e.g. installed, stand-alone)
 */
export function isPwa(): boolean {
  return isBrowser ? window.matchMedia('(display-mode: standalone)').matches : false;
}

export function webSharePresent(): boolean {
  return isBrowser && !!navigator.share;
}

export function webShare(title: string, text: string, url: string, onShared?: () => void): void {
  if (isBrowser && navigator.share)
    navigator.share({ title, text, url })
      .then(() => onShared?.())
      .catch((error) => {
        console.error('Error sharing', error);
        alert('Sharing failed. This browser may not support sharing.');
      });
}

export function clientHostName(): string {
  return isBrowser ? window.location.host : '';
}

export function clientUtmSource(campaign?: string): string {
  const host = clientHostName();
  if (!host)
    return '';
  return '?utm_source=' + host + '&utm_medium=' + Brand.Title.Base.toLowerCase() + (campaign ? `&utm_campaign=${campaign}` : '');
}


/**
 * Schedules a callback to be executed during the browser's idle periods or after a specified timeout.
 *
 * @param callback - The callback function to execute.
 * @param timeout - The maximum time to wait before executing the callback, in milliseconds.
 * @returns A cleanup function that can be used to cancel the scheduled callback (e.g. on an unmount).
 */
export function runWhenIdle(callback: () => void, timeout: number): () => void {
  if (!isBrowser) {
    console.warn('runWhenIdle is only supported in browser environments.');
    // Return a no-op function for non-browser environments
    return () => {
    };
  }

  // schedule the callback using either requestIdleCallback or setTimeout
  const usingIdleCallback = 'requestIdleCallback' in window;
  let handle = usingIdleCallback
    ? window.requestIdleCallback(callback, { timeout })
    : setTimeout(callback, timeout);

  // Return a cleanup function
  return () => {
    if (usingIdleCallback)
      window.cancelIdleCallback(handle as unknown as number);
    else
      clearTimeout(handle);
  };
}