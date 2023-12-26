import * as React from 'react';
import Head from 'next/head';
import { MyAppProps } from 'next/app';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

import { Brand } from '~/common/app.config';
import { apiQuery } from '~/common/util/trpc.client';

import 'katex/dist/katex.min.css';
import '~/common/styles/CodePrism.css';
import '~/common/styles/GithubMarkdown.css';

import { OptimaLayout } from '~/common/layout/optima/OptimaLayout';
import { PlainLayout } from '~/common/layout/plain/PlainLayout';
import { ProviderBackendAndNoSSR } from '~/common/state/ProviderBackendAndNoSSR';
import { ProviderSingleTab } from '~/common/state/ProviderSingleTab';
import { ProviderSnacks } from '~/common/state/ProviderSnacks';
import { ProviderTRPCQueryClient } from '~/common/state/ProviderTRPCQueryClient';
import { ProviderTheming } from '~/common/state/ProviderTheming';


const MyApp = ({ Component, emotionCache, pageProps }: MyAppProps) => {

  // [dynamic page-level layouting] based on the the layoutOptions.type property of the Component
  if (!Component.layoutOptions)
    throw new Error('Component.layoutOptions is not defined');
  const { layoutOptions } = Component;
  const LayoutComponent = layoutOptions.type === 'optima'
    ? OptimaLayout
    : PlainLayout /* default / fallback */;

  return <>

    <Head>
      <title>{Brand.Title.Common}</title>
      <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no' />
    </Head>

    <ProviderTheming emotionCache={emotionCache}>
      <ProviderSingleTab>
        <ProviderTRPCQueryClient>
          <ProviderSnacks>
            <ProviderBackendAndNoSSR>
              <LayoutComponent {...layoutOptions}>
                <Component {...pageProps} />
              </LayoutComponent>
            </ProviderBackendAndNoSSR>
          </ProviderSnacks>
        </ProviderTRPCQueryClient>
      </ProviderSingleTab>
    </ProviderTheming>

    <VercelAnalytics debug={false} />

  </>;
};

// enables the React Query API invocation
export default apiQuery.withTRPC(MyApp);