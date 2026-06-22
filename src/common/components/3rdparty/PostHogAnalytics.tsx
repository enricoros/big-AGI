import * as React from 'react';
import type { PostHog, Properties } from 'posthog-js';

import { isAbortErrorLike, isBenignDomMutationError } from '~/common/util/errorUtils';
import { isBrowser } from '~/common/util/pwaUtils';
import { Release } from '~/common/app.release';


export const hasPostHogAnalytics = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;


// global to survive route changes
let _posthog: undefined | PostHog | null = undefined; // undefined: not loaded, null: loading or opt-out, PostHog: loaded

/**
 * Known-benign exception substrings to drop from PostHog Error Tracking autocapture.
 *
 * SCOPE: noise only - request cancellations, extension/page-translator DOM interference,
 * and opaque cross-origin/extension errors that carry zero actionable signal. We deliberately
 * do NOT suppress IndexedDB/storage DOMExceptions here: those stay visible until the
 * storage-resilience work lands, so we don't go blind to real breakage.
 */
const SUPPRESSED_EXCEPTION_SUBSTRINGS = [
  // user/teardown-initiated request cancellations (never actionable - see isAbortErrorLike)
  'AbortError',
  'signal is aborted without reason',
  'The user aborted a request',
  // browser extensions / page translators mutating the DOM behind React's back (see isBenignDomMutationError)
  'Failed to execute \'removeChild\' on \'Node\'',
  'Failed to execute \'insertBefore\' on \'Node\'',
  // opaque cross-origin script errors (no stack, no message, no actionable info)
  'Script error.',
  // browser extensions reaching into React internals across origins
  '__reactFiber',
];

/**
 * `capture_exceptions: true` installs posthog-js's own global error/unhandledrejection
 * handlers, which bypass `posthogCaptureException()` (and thus our isAbortErrorLike /
 * isBenignDomMutationError filters). `before_send` is the only hook that intercepts those.
 *
 * We match on serialized exception text: client-side, posthog-js populates `$exception_list`
 * ({type,value} per exception); the `$exception_values`/`$exception_types` scalars are derived
 * server-side and are usually absent here - so we read `$exception_list` first, with the
 * derived fields as a fallback.
 */
function shouldSuppressPostHogCapture(captureResult: any): boolean {
  if (!captureResult || captureResult.event !== '$exception') return false;

  const properties = captureResult.properties || {};
  const parts: string[] = [];

  // primary (client-side): the per-exception type/value list
  if (Array.isArray(properties.$exception_list)) {
    for (const ex of properties.$exception_list) {
      if (ex?.type) parts.push(String(ex.type));
      if (ex?.value) parts.push(String(ex.value));
    }
  }

  // fallback (server-derived shapes, in case they are present)
  const exceptionTypes = properties.$exception_types;
  const exceptionValues = properties.$exception_values;
  if (Array.isArray(exceptionTypes)) parts.push(exceptionTypes.join(' '));
  else if (exceptionTypes) parts.push(String(exceptionTypes));
  if (Array.isArray(exceptionValues)) parts.push(exceptionValues.join(' '));
  else if (exceptionValues) parts.push(String(exceptionValues));
  if (properties.$exception_type) parts.push(String(properties.$exception_type));
  if (properties.$exception_message) parts.push(String(properties.$exception_message));

  const text = parts.join(' ');
  if (!text) return false;

  return SUPPRESSED_EXCEPTION_SUBSTRINGS.some(s => text.includes(s));
}


// noinspection JSUnusedGlobalSymbols - unused yet
export function posthogAnalyticsOptOut() {
  if (isBrowser) {
    localStorage.setItem('app-analytics-posthog-optout', 'true');
    _posthog?.opt_out_capturing();
  }
}

/**
 * True once posthog-js has dynamically loaded and `init()` ran - i.e. it consumed the
 * initial URL (UTMs, etc.). Stays false for opted-out users (init is never called).
 */
export function posthogIsLoaded(): boolean {
  return _posthog?.__loaded === true;
}

export function posthogCaptureEvent(eventName: string, properties?: Properties, options?: { sendInstantly?: boolean }) {
  if (isBrowser && hasPostHogAnalytics) {
    // For events before navigation (e.g., login button clicks), send immediately
    _posthog?.capture(eventName, properties, options?.sendInstantly ? { send_instantly: true } : undefined);
  }
}

export function posthogCaptureException(error: Error | unknown, additionalProperties?: Properties) {
  if (
    isBrowser && hasPostHogAnalytics && _posthog &&
    !isAbortErrorLike(error) && !isBenignDomMutationError(error)
  ) {
    _posthog.captureException(error, additionalProperties);
  }
}

/**
 * Posthog Identify - Login
 */
export function posthogUser(userId: string, userProperties?: Record<string, any>) {
  if (isBrowser && hasPostHogAnalytics) {
    _posthog?.identify(userId, {
      subscription_tier: userProperties?.subscriptionTier || 'free',
      tenant_id: userProperties?.tenantId,
      ...userProperties,
    });
  }
}

/**
 * Posthog Reset - Logout
 */
export function posthogReset() {
  if (isBrowser && hasPostHogAnalytics)
    _posthog?.reset();
}


/**
 * PostHog Analytics implementation - with dynamic loading
 * follows latest PostHog best practices: https://posthog.com/docs/libraries/next-js?tab=Pages+router
 *
 * This is an optional component in Big-AGI, available to anyone that wants to use PostHog.
 *
 * To enable it, you must set the 'NEXT_PUBLIC_POSTHOG_KEY' environment variable at build time.
 *
 * @see also `GoogleAnalytics.tsx`
 */
export function OptionalPostHogAnalytics() {

  // state
  // const [initialized, setInitialized] = React.useState(false);


  // [effect] PostHog > Initialize (if on) - the effect avoids hydration issues
  React.useEffect(() => {

    if (!hasPostHogAnalytics || !isBrowser || _posthog !== undefined) return;
    _posthog = null;

    // do not proceed with user opt-out
    const hasOptedOut = localStorage.getItem('app-analytics-posthog-optout') === 'true';

    // Dynamically load PostHog
    import('posthog-js')
      .then(({ posthog }) => {
        _posthog = posthog;

        if (hasOptedOut) {
          _posthog.opt_out_capturing();
          return;
        }

        // initialize
        _posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
          api_host: '/a/ph', // client analytics host - default: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
          ui_host: 'https://us.posthog.com',
          defaults: '2026-01-30',
          capture_exceptions: true, // captures exceptions using Error Tracking
          before_send: (captureResult) => shouldSuppressPostHogCapture(captureResult) ? null : captureResult,
          // capture_pageview: false, // we used to handle this manually, but changed to the 'defaults' option which captures pageviews automatically
          // capture_pageleave: true, // we used to track goodbyes, now included in 'defaults'
          person_profiles: 'identified_only',
          remote_config_refresh_interval_ms: 0, // no background refreshes. Flags only update on page load or manual `reloadFeatureFlags()` calls.
          disable_surveys: true, // disable surveys
          debug: Release.IsNodeDevBuild, // enable debug mode in development (was: `loaded: (ph) => if (Release.IsNodeDevBuild) ph.debug();`)
        });

        // add deployment context - see `next.config.mjs`
        const fBuild = Release.buildInfo('frontend');
        _posthog.register({
          app_tenant: Release.TenantSlug,
          app_build_hash: fBuild.gitSha || 'unknown',
          app_pkg_version: fBuild.pkgVersion || 'unknown',
          // app_deployment_type: fBuild.deploymentType || 'unknown', // unneeded
        });

        // trigger router hooks
        // setInitialized(true);
      })
      .catch(err => console.error('Failed to load PostHog:', err));
  }, []);


  // [effect] PostHog > PageViews
  // React.useEffect(() => {
  //   if (!hasPostHogAnalytics || !initialized || !_posthog) return;
  //
  //   const handleRouteChange = () => {
  //     // better representation of the next.js URL, compared to reading the window
  //     const url = window.location.origin + Router.asPath;
  //     _posthog?.capture('$pageview', { $current_url: url });
  //   };
  //
  //   // initial page view
  //   handleRouteChange();
  //
  //   // ongoing page views
  //   Router.events.on('routeChangeComplete', handleRouteChange);
  //   return () => Router.events.off('routeChangeComplete', handleRouteChange);
  // }, [initialized]);

  // nothing to render - this component is just for the side effects
  return null;
}
