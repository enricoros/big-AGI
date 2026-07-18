import { Brand } from '../app.config';

// True if run in the browser
export const isBrowser = typeof window !== 'undefined';

// Safe (brittle) lower case user agent string - brittle, but we mostly use it for optional features
const _safeUA = isBrowser ? window.navigator?.userAgent.toLowerCase() || '' : '';


// Frontend Environment Classification
export const Is = {
  Desktop: !/mobile|android|iphone|ipad|ipod/.test(_safeUA),
  Browser: {
    Brave: isBrowser && !!(navigator as any).brave,
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
    // NOTE: Vercel auto-exposes NEXT_PUBLIC_VERCEL_URL on hosted prod/preview builds (framework env vars), so keying off
    // it would also work - but we use our own NEXT_PUBLIC_DEPLOYMENT_TYPE (set in next.config.ts from VERCEL_ENV): it's
    // explicit, self-controlled, and already the canonical deploy signal (see app.release buildInfo). Resolves to
    // 'vercel-<env>' on the hosted build, 'local'/custom on self-host. Used to avoid showing Vercel-specific copy (e.g.
    // the 413 "edge network" limit) on self-hosted deployments sitting behind nginx/other reverse proxies.
    VercelFromFrontend: (process.env.NEXT_PUBLIC_DEPLOYMENT_TYPE ?? '').startsWith('vercel'),
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

/**
 * Generates a human-readable device name with improved accuracy.
 * Handles browser precedence correctly, considers PWA status.
 *
 * Examples: "Windows Edge", "iPhone Safari", "Android Chrome (App)"
 */
export function generateDeviceName(): string {
  if (!isBrowser) return 'Server';

  // Get platform information
  let platform: string;

  // Check specific mobile devices first
  if (Is.OS.iOS) {
    if (_safeUA.includes('ipad')) platform = 'iPad';
    else if (_safeUA.includes('ipod')) platform = 'iPod';
    else platform = 'iPhone';
  }
  // Then check for Android
  else if (Is.OS.Android) {
    platform = 'Android';
  }
  // Then desktop OSes
  else if (Is.OS.Windows) {
    platform = 'Windows';
  } else if (Is.OS.MacOS) {
    platform = 'Mac';
  } else if (Is.OS.Linux) {
    platform = 'Linux';
  }
  // Fallback to form factor if OS detection fails
  else {
    platform = Is.Desktop ? 'Desktop' : 'Mobile';
  }

  // Get browser with correct precedence (order matters!)
  let browser: string;
  if (Is.Browser.Edge) browser = 'Edge';
  else if (Is.Browser.Opera) browser = 'Opera';
  else if (Is.Browser.Firefox) browser = 'Firefox';
  else if (Is.Browser.Chrome) browser = 'Chrome';
  else if (Is.Browser.Safari) browser = 'Safari';
  else browser = 'Browser';

  // Check for PWA status
  const isPwaInstalled = isPwa();
  const pwaIndicator = isPwaInstalled ? ' (App)' : '';

  // Format the name based on platform and browser
  return `${platform} ${browser}${pwaIndicator}`;
}


/**
 * Pure UA device classifier - works on ANY UA string (e.g. other devices' server-observed UAs);
 * the module-level `Is` above covers only the local browser.
 *
 * Conservative by design ("no risk"): each axis is asserted only on unambiguous tokens, else
 * 'unknown'. Accepted bounded ambiguity: desktop-mode iPads (the default since iPadOS 13) send a
 * Macintosh UA and classify as macos/computer - by decision, we don't chase iPads. Desktop vs
 * laptop is NOT derivable from any signal (UA, client hints, anything) - hence one 'computer'.
 */
export function classifyUA(userAgent: string | null | undefined): UADeviceClass {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return { os: 'unknown', form: 'unknown' };

  const os: UADeviceOS =
    /ip(hone|od|ad)/.test(ua) ? 'ios'
      : ua.includes('android') ? 'android'
        : ua.includes('windows') ? 'windows'
          : /macintosh|mac os x/.test(ua) ? 'macos'
            : (ua.includes('cros') || ua.includes('linux')) ? 'linux' // ChromeOS folded into linux
              : 'unknown';

  const form: UAFormFactor =
    /ipad|tablet/.test(ua) ? 'tablet'
      : os === 'android' ? (ua.includes('mobile') ? 'phone' : 'tablet') // Android convention: no 'mobile' token = tablet
        : /iphone|ipod|mobile/.test(ua) ? 'phone'
          : (os === 'windows' || os === 'macos' || os === 'linux') ? 'computer'
            : 'unknown';

  return { os, form };
}

export interface UADeviceClass {
  os: UADeviceOS;
  form: UAFormFactor;
}

export type UADeviceOS = 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'unknown';
export type UAFormFactor = 'phone' | 'tablet' | 'computer' | 'unknown';


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
