import * as React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { MyAppProps } from 'next/app';
import type { BeforeSend as VercelAnalyticsBeforeSend } from '@vercel/analytics/next';

import { Brand } from '~/common/app.config';
import { apiQuery } from '~/common/util/trpc.client';


// [server-client-safe] dynamic imports to avoid webpack bundling issues with next/navigation
const VercelAnalytics = dynamic(() => import('@vercel/analytics/next').then(mod => mod.Analytics), { ssr: false });
// const VercelSpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then(mod => mod.SpeedInsights), { ssr: false });

// [privacy] page addresses are sent without their fragment: what a page keeps after the '#' stays in the browser
const vercelAnalyticsWithoutFragment: VercelAnalyticsBeforeSend = (event) => ({ ...event, url: event.url.split('#')[0] });


import 'katex/dist/katex.min.css';
import '~/common/styles/CodePrism.css';
import '~/common/styles/GithubMarkdown.css';
import '~/common/styles/NProgress.css';
import '~/common/styles/agi.effects.css';
import '~/common/styles/app.styles.css';
import '~/common/styles/fonts/app.fonts.css';

import { ErrorBoundary } from '~/common/components/ErrorBoundary';
import { Is } from '~/common/util/pwaUtils';
import { OverlaysInsert } from '~/common/layout/overlays/OverlaysInsert';
import { ProviderBackendCapabilities } from '~/common/providers/ProviderBackendCapabilities';
import { ProviderBootstrapLogic } from '~/common/providers/ProviderBootstrapLogic';
import { ProviderSingleTab } from '~/common/providers/single-tab/ProviderSingleTab';
import { ProviderTheming } from '~/common/providers/ProviderTheming';
import { SnackbarInsert } from '~/common/components/snackbar/SnackbarInsert';
import { hasGoogleAnalytics, OptionalGoogleAnalytics } from '~/common/components/3rdparty/GoogleAnalytics';
import { hasPostHogAnalytics, OptionalPostHogAnalytics } from '~/common/components/3rdparty/PostHogAnalytics';
import { OptionalUrlTrackingCleaner } from '~/common/components/3rdparty/UrlTrackingCleaner';


/**
 * Modifiers of the page component hierarchy.
 * From the outer components (affect all) to the inner components (affect the page).
 */
interface PageRequirements {
  noSingleTab: boolean; // the page opens next to a running app: pair with noBootstrap, which maintains the app's storage
  noBootstrap: boolean;
}

const PAGES_CONF: Record<string, Partial<PageRequirements>> = {} as const;


const Big_AGI_App = ({ Component, emotionCache, pageProps, router }: MyAppProps) => {

  // We are using a nextjs per-page layout pattern to bring the (Optima) layout creation to a shared place
  // This reduces the flicker and the time switching between apps, and seems to not have impact on
  // the build. This is a good trade-off for now.
  const withLayout = Component.getLayout ?? ((page: any) => page);


  // build the page tree (wrapping of providers) based on the page requirements
  const { noSingleTab, noBootstrap }: Partial<PageRequirements> = PAGES_CONF[router.pathname] ?? {};

  let page = <>
    <SnackbarInsert />
    {withLayout(<Component {...pageProps} />)}
    <OverlaysInsert />
  </>;

  if (!noBootstrap)
    page = <ProviderBootstrapLogic>{page}</ProviderBootstrapLogic>;

  // Error Boundary - always have it
  page = <ErrorBoundary outer>{page}</ErrorBoundary>;

  // Backend capabilities & SSR boundary - always have it
  page = <ProviderBackendCapabilities>{page}</ProviderBackendCapabilities>;

  if (!noSingleTab)
    page = <ProviderSingleTab>{page}</ProviderSingleTab>;


  return <>

    <Head>
      <title>{Brand.Title.Common}</title>
      <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no' />
    </Head>

    <ProviderTheming emotionCache={emotionCache}>
      {page}
    </ProviderTheming>

    {hasGoogleAnalytics && <OptionalGoogleAnalytics />}
    {hasPostHogAnalytics && <OptionalPostHogAnalytics />}
    <OptionalUrlTrackingCleaner />

    {Is.Deployment.VercelFromFrontend && <VercelAnalytics debug={false} beforeSend={vercelAnalyticsWithoutFragment} />}
    {/*{Is.Deployment.VercelFromFrontend && <VercelSpeedInsights debug={false} sampleRate={1 / 2} />}*/}

  </>;
};

// Initializes React Query and tRPC, and enables the tRPC React Query hooks (apiQuery).
export default apiQuery.withTRPC(Big_AGI_App);