import * as React from 'react';
import Head from 'next/head';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AppProps } from 'next/app';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider } from '@mui/joy';

import { createEmotionCache, theme } from '@/lib/theme';

import type { LayoutProps } from '@vercel/examples-ui/layout';
import { getLayout } from '@vercel/examples-ui';
import '@vercel/examples-ui/globals.css';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

export default function MyApp({ Component, emotionCache = clientSideEmotionCache, pageProps }: MyAppProps) {
  const Layout = getLayout<LayoutProps>(Component);
  return (
    <>
      <Layout title="Password Protected" path="edge-middleware/basic-auth-password">
        <CacheProvider value={emotionCache}>
          <Head>
            <meta name="viewport" content="initial-scale=1, width=device-width" />
          </Head>
          <CssVarsProvider defaultMode="light" theme={theme}>
            {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
            <CssBaseline />
            <Component {...pageProps} />
          </CssVarsProvider>
        </CacheProvider>
        <VercelAnalytics debug={false} />
      </Layout>
    </>
  );
}
