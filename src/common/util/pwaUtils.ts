import { Brand } from '../app.config';

// assume these won't change during the application lifetime
export const isBrowser = typeof window !== 'undefined';

// this sort of detection is brittle, but we use it for very optional features
const safeUA = isBrowser ? window.navigator?.userAgent || '' : '';
export const isIPhoneUser = /iPhone|iPod/.test(safeUA);
export const isMacUser = /Macintosh|MacIntel|MacPPC|Mac68K/.test(safeUA);
export const isChromeDesktop = safeUA.indexOf('Chrome') > -1 && safeUA.indexOf('Mobile') === -1;
export const isFirefox = safeUA.indexOf('Firefox') > -1;


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
      .catch((error) => console.log('Error sharing', error));
}

function clientHostName(): string {
  return isBrowser ? window.location.host : '';
}

export function clientUtmSource(campaign?: string): string {
  const host = clientHostName();
  if (!host)
    return '';
  return '?utm_source=' + host + '&utm_medium=' + Brand.Title.Base.toLowerCase() + (campaign ? `&utm_campaign=${campaign}` : '');
}