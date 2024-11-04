import { Brand } from '../app.config';

// True if run in the browser
export const isBrowser = typeof window !== 'undefined';

// Safe (brittle) lower case user agent string - brittle, but we mostly use it for optional features
const _safeUA = isBrowser ? window.navigator?.userAgent.toLowerCase() || '' : '';


// Frontend Environment Classification
export const Is = {
  Desktop: !/mobile|android|iphone|ipad|ipod/.test(_safeUA),
  Browser: {
    Chrome: _safeUA.includes('chrome') || _safeUA.includes('crios'),
    get Safari() {
      return _safeUA.includes('safari') && !this.Chrome && !_safeUA.includes('chromium');
    },
    Firefox: _safeUA.includes('firefox') || _safeUA.includes('fxios'),
    Edge: _safeUA.includes('edg'),
    Opera: _safeUA.includes('opr') || _safeUA.includes('opera'),
  },
  OS: {
    iOS: /ip(hone|od|ad)/.test(_safeUA),
    Android: _safeUA.includes('android'),
    MacOS: /macintosh|macintel|macppc|mac68k/.test(_safeUA),
    Windows: _safeUA.includes('windows'),
    Linux: _safeUA.includes('linux'),
  },
  Deployment: {
    Localhost: clientHostName().includes('localhost:300'),
    VercelFromBackendOrSSR: !!process.env.VERCEL_ENV,
    VercelFromFrontend: !!process.env.NEXT_PUBLIC_VERCEL_URL,
  },
} as const;


// Frontend Language
export const BrowserLang = {
  get orUS() {
    return (isBrowser ? window.navigator.language : '') || 'en-US';
  },
  get notUS() {
    return this.orUS !== 'en-US';
  },
} as const;


/**
 * Returns 'true' if the application is being executed as a 'PWA' (e.g., installed, stand-alone)
 */
export function isPwa(): boolean {
  return isBrowser ? window.matchMedia('(display-mode: standalone)').matches : false;
}


/// Web Share ///

export function webSharePresent(): boolean {
  return isBrowser && !!navigator.share;
}

export function webShare(title: string, text: string, url: string, onShared?: () => void): void {
  if (isBrowser && navigator.share)
    navigator
      .share({ title, text, url })
      .then(() => onShared?.())
      .catch((error) => {
        console.error('Error sharing', error);
        alert('Sharing failed. This browser may not support sharing.');
      });
}


/// Client Host Names ///

export function clientHostName(): string {
  return isBrowser ? window.location.host : '';
}

export function clientUtmSource(campaign?: string): string {
  const host = clientHostName();
  if (!host) return '';
  return '?utm_source=' + host + '&utm_medium=' + Brand.Title.Base.toLowerCase() + (campaign ? `&utm_campaign=${campaign}` : '');
}


/// Delayed Idle Runner ///

/**
 * Schedules a callback to be executed during the browser's idle periods or after a specified timeout.
 *
 * @param callback - The callback function to execute.
 * @param timeout - The maximum time to wait before executing the callback, in milliseconds.
 * @returns A cleanup function that can be used to cancel the scheduled callback (e.g., on an unmount).
 */
export function runWhenIdle(callback: () => void, timeout: number): () => void {
  if (!isBrowser) {
    console.warn('runWhenIdle is only supported in browser environments.');
    // Return a no-op function for non-browser environments
    return () => {
    };
  }

  // Schedule the callback using either requestIdleCallback or setTimeout
  const usingIdleCallback = 'requestIdleCallback' in window;
  let handle = usingIdleCallback
    ? window.requestIdleCallback(callback, { timeout })
    : setTimeout(callback, timeout);

  // Return a cleanup function
  return () => {
    if (usingIdleCallback)
      window.cancelIdleCallback(handle as number);
    else
      clearTimeout(handle);
  };
}
