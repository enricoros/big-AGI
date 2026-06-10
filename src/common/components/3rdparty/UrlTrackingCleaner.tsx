import * as React from 'react';

import { hasGoogleAnalytics } from './GoogleAnalytics';
import { hasPostHogAnalytics, posthogIsLoaded } from './PostHogAnalytics';


/**
 * Removes parameters from the address bar, once per page load.
 * This serves no purpose, but dependding on the incoming link, we may have those in the
 * params and don't need them.
 */

// Google linker + click ids, UTMs, and the ad-platform click ids we may receive via www links
const TRACKING_PARAMS = [
  '_gl',                                             // gtag cross-domain linker payload
  'gclid', 'gclsrc', 'gbraid', 'wbraid', 'dclid',    // Google Ads / DoubleClick click ids
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'msclkid',                               // Meta / Microsoft click ids
] as const;

const MIN_SETTLE_MS = 2_000; // let analytics libraries finish their initial captures
const MAX_WAIT_MS = 8_000;   // blocked/failed loaders won't ever consume - clean anyway
const POLL_MS = 500;


function _urlHasTrackingParams(): boolean {
  const searchParams = new URLSearchParams(window.location.search);
  return TRACKING_PARAMS.some(param => searchParams.has(param));
}

export function OptionalUrlTrackingCleaner() {

  React.useEffect(() => {

    // fast path: nothing to clean on this load
    if (!_urlHasTrackingParams()) return;

    const startTime = Date.now();
    const intervalId = window.setInterval(() => {

      // readiness: each library loaded (or not enabled at all), or we hit the hard timeout
      const elapsed = Date.now() - startTime;
      const gtagReady = !hasGoogleAnalytics || !!(window as any).google_tag_manager;
      const posthogReady = !hasPostHogAnalytics || posthogIsLoaded();
      if (elapsed < MIN_SETTLE_MS || (!(gtagReady && posthogReady) && elapsed < MAX_WAIT_MS))
        return;

      window.clearInterval(intervalId);

      try {
        if (!_urlHasTrackingParams()) return; // re-check: URL may have changed
        const cleanUrl = new URL(window.location.href);
        TRACKING_PARAMS.forEach(param => cleanUrl.searchParams.delete(param));
        window.history.replaceState(window.history.state, '', cleanUrl.toString());
      } catch {
        // cosmetic feature - never let it break the app
      }

    }, POLL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return null;
}
