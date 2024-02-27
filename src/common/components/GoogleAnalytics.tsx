import * as React from 'react';
import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google';


export const hasGoogleAnalytics = !!process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export function getGA4MeasurementId(): string | null {
  return process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null;
}

/**
 * Note: we are using this third-party component from Vercel which is very experimental
 * and has just been launched weeks back (at the time of writing this code). There could
 * be issues.
 *
 * Note: this causes a 2.8kb increase in the bundle size.
 */
export function OptionalGoogleAnalytics() {
  const gaId = getGA4MeasurementId();
  return gaId ? <NextGoogleAnalytics gaId={gaId} /> : null;
}