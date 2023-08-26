import * as React from 'react';
import Head from 'next/head';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AppProps } from 'next/app';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { apiQuery } from '~/modules/trpc/trpc.client';

import 'katex/dist/katex.min.css';
import '~/common/styles/CodePrism.css'
import '~/common/styles/GithubMarkdown.css';
import { Brand } from '~/common/brand';
import { createEmotionCache, theme } from '~/common/theme';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

function MyApp({ Component, emotionCache = clientSideEmotionCache, pageProps }: MyAppProps) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  }));
  return <>
    <CacheProvider value={emotionCache}>
      <Head>
        <title>{Brand.Title.Common}</title>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no' />
      </Head>
      {/* Rect-query provider */}
      <QueryClientProvider client={queryClient}>
        <CssVarsProvider defaultMode='light' theme={theme}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          <Component {...pageProps} />
        </CssVarsProvider>
      </QueryClientProvider>
    </CacheProvider>
    <VercelAnalytics debug={false} />
  </>;
}

// enables the react-query api invocation
export default apiQuery.withTRPC(MyApp);