import * as React from 'react';
import type { PostHog } from 'posthog-js';
import Router from 'next/router';

import { isBrowser } from '~/common/util/pwaUtils';
import { Release } from '~/common/app.release';


export const hasPostHogAnalytics = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;


// global to survive route changes
let _posthog: undefined | PostHog | null = undefined; // underined: not loaded, null: loading or opt-out, PostHog: loaded


// unused yet
export function posthogAnalyticsOptOut() {
  if (isBrowser) {
    localStorage.setItem('app-analytics-posthog-optout', 'true');
    _posthog?.opt_out_capturing();
  }
}

// unused yet
export function posthogCaptureEvent(eventName: string, properties: Record<string, any>) {
  if (isBrowser && hasPostHogAnalytics) {
    _posthog?.capture(eventName, properties);
  }
}


// unused yet
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
  const [initialized, setInitialized] = React.useState(false);


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
          api_host: '/a/ph', // default: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
          ui_host: 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false, // handle this manually
          capture_pageleave: true, // track goodbyes
          disable_surveys: true, // disable surveys
          loaded: (ph) => {
            if (Release.IsNodeDevBuild) ph.debug();
          },
        });

        // add deployment context - see `next.config.mjs`
        const fBuild = Release.buildInfo('frontend');
        _posthog.register({
          app_tenant: Release.TenantSlug,
          app_build_hash: fBuild.gitSha || 'unknown',
          app_pkg_version: fBuild.pkgVersion || 'unknown',
          app_deployment_type: fBuild.deploymentType || 'unknown',
        });

        // trigger router hooks
        setInitialized(true);
      })
      .catch(err => console.error('Failed to load PostHog:', err));
  }, []);


  // [effect] PostHog > PageViews
  React.useEffect(() => {
    if (!hasPostHogAnalytics || !initialized || !_posthog) return;

    const handleRouteChange = () => {
      // better representation of the next.js URL, compared to reading the window
      const url = window.location.origin + Router.asPath;
      _posthog?.capture('$pageview', { $current_url: url });
    };

    // initial page view
    handleRouteChange();

    // ongoing page views
    Router.events.on('routeChangeComplete', handleRouteChange);
    return () => Router.events.off('routeChangeComplete', handleRouteChange);
  }, [initialized]);

  // nothing to render - this component is just for the side effects
  return null;
}
