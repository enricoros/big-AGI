import * as React from 'react';
import Script from 'next/script';

import { Release } from '~/common/app.release';


export const hasGoogleAnalytics = !!process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export function getGA4MeasurementId(): string | null {
  return process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null;
}

export function sendGAEvent(..._args: Object[]) {
  if (currDataLayerName === undefined)
    return console.warn('[DEV] GA has not been initialized yet');

  if (window[currDataLayerName])
    window[currDataLayerName]?.push(arguments);
  else
    console.warn('[DEV] GA dataLayer does not exist');
}


//
// Google Analytics implementation
// Taken from Vercel: https://github.com/vercel/next.js/blob/b996171654f8ae25b7409dc7a0f27d5217abf35e/packages/third-parties/src/google/ga.tsx
//

// defined during the first render
let currDataLayerName: 'dataLayer' | undefined = undefined;

declare global {
  // noinspection JSUnusedGlobalSymbols
  interface Window {
    dataLayer?: Object[];
  }
}


/**
 * This has been adapted from Vercel, with:
 * - removal of the performance.mark and useEffect
 * - removal of custom dataLayer name
 * - add user_properties: https://developers.google.com/analytics/devguides/collection/ga4/reference/config#user_properties
 */
function NextGoogleAnalytics(props: {
  gaId: string
  debugMode?: boolean
  nonce?: string
}) {
  const { gaId, debugMode, nonce } = props;

  if (currDataLayerName === undefined)
    currDataLayerName = 'dataLayer';

  const fBuild = Release.buildInfo('frontend');

  return (
    <>
      <Script
        id='_next-ga-init'
        dangerouslySetInnerHTML={{
          __html: `
          window['${currDataLayerName}'] = window['${currDataLayerName}'] || [];
          function gtag(){window['${currDataLayerName}'].push(arguments);}
          gtag('js', new Date());

          gtag('config', '${gaId}', {
            ${debugMode ? ' \'debug_mode\': true,' : ''}
            'user_properties': {
              'app_tenant': '${Release.TenantSlug}',
              'app_build_hash': '${fBuild.gitSha || 'unknown'}',
              'app_pkg_version': '${fBuild.pkgVersion || 'unknown'}',
              'app_deployment_type': '${fBuild.deploymentType || 'unknown'}'
            }
          });`,
        }}
        nonce={nonce}
      />
      <Script
        id='_next-ga'
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        nonce={nonce}
      />
    </>
  );
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