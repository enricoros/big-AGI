import * as React from 'react';
import Head from 'next/head';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AppProps } from 'next/app';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider } from '@mui/joy';

import { createEmotionCache, theme } from '@/lib/theme';

import Script from 'next/script';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

import { MemberstackProvider } from '@memberstack/react';
const config = {
  publicKey: 'pk_sb_e96ed700497309964b0f',
};
import { useMemberstack } from '@memberstack/react';

function Dashboard() {
  const memberstack = useMemberstack();
  const [member, setMember] = React.useState(null);

  React.useEffect(() => {
    memberstack.getCurrentMember().then(({ data: member }) => setMember(member)).catc;
  }, []);

  if (!member) return null;

  return <div>Welcome, {member.auth.email}</div>;
}

export default function MyApp({ Component, emotionCache = clientSideEmotionCache, pageProps }: MyAppProps) {
  return (
    <>
      <MemberstackProvider config={config}>
        <CacheProvider value={emotionCache}>
          <Head>
            <meta name="viewport" content="initial-scale=1, width=device-width" />
            <Script
              data-memberstack-app="app_clcnm9ij300en0tlsa7azbd9e"
              src="https://static.memberstack.com/scripts/v1/memberstack.js"
              type="text/javascript"
            />
          </Head>
          <CssVarsProvider defaultMode="light" theme={theme}>
            {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
            <CssBaseline />
            <Component {...pageProps} />
          </CssVarsProvider>
        </CacheProvider>
        <VercelAnalytics debug={false} />
      </MemberstackProvider>
    </>
  );
}
