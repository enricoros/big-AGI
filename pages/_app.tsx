import * as React from 'react';
import Head from 'next/head';
import { MyAppProps } from 'next/app';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights as VercelSpeedInsights } from '@vercel/speed-insights/next';
import { useRouter } from 'next/navigation';

import { Brand } from '~/common/app.config';
import { apiQuery } from '~/common/util/trpc.client';

import 'katex/dist/katex.min.css';
import '~/common/styles/CodePrism.css';
import '~/common/styles/GithubMarkdown.css';
import '~/common/styles/NProgress.css';
import '~/common/styles/app.styles.css';

import { ProviderBackendAndNoSSR } from '~/common/providers/ProviderBackendAndNoSSR';
import { ProviderBootstrapLogic } from '~/common/providers/ProviderBootstrapLogic';
import { ProviderSingleTab } from '~/common/providers/ProviderSingleTab';
import { ProviderSnacks } from '~/common/providers/ProviderSnacks';
import { ProviderTRPCQueryClient } from '~/common/providers/ProviderTRPCQueryClient';
import { ProviderTheming } from '~/common/providers/ProviderTheming';

import { ClerkLoaded, ClerkProvider, useUser } from '@clerk/nextjs';
import { firestore } from 'src/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const MyApp = ({ Component, emotionCache, pageProps }: MyAppProps) => {
  return (
    <ClerkProvider>
      <Head>
        <title>{Brand.Title.Common}</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no" />
      </Head>

      <ProviderTheming emotionCache={emotionCache}>
        <ProviderSingleTab>
          <ProviderBootstrapLogic>
            <ProviderTRPCQueryClient>
              <ProviderSnacks>
                <ProviderBackendAndNoSSR>
                  <ClerkLoaded>
                    <Redirect />
                    <Component {...pageProps} />
                  </ClerkLoaded>
                </ProviderBackendAndNoSSR>
              </ProviderSnacks>
            </ProviderTRPCQueryClient>
          </ProviderBootstrapLogic>
        </ProviderSingleTab>
      </ProviderTheming>

      <VercelAnalytics debug={false} />
      <VercelSpeedInsights debug={false} sampleRate={1 / 10} />
    </ClerkProvider>
  );
};

const Redirect = () => {
  const { user } = useUser();
  const router = useRouter();

  const checkAndRedirect = React.useCallback(async () => {
    if (window.location.pathname === '/' || window.location.pathname === '/sign-in' || window.location.pathname === '/sign-up') {
      return;
    }
    if (!user?.primaryEmailAddress) {
      router.push('/');
      return;
    }

    const userEmail = user.primaryEmailAddress.emailAddress;
    const userCollectionRef = doc(firestore, 'users', userEmail);

    try {
      const docSnap = await getDoc(userCollectionRef);
      if (!docSnap.exists()) {
        // Collection does not exist, create it
        await setDoc(userCollectionRef, { authorized: false });
        router.push('/');
      } else {
        // Collection exists, check if authorized
        if (!docSnap.data().authorized) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Error checking user authorization:', error);
      // Handle any errors, e.g., redirect or show a message
    }
  }, [user, router]);

  React.useEffect(() => {
    checkAndRedirect();
  }, [user, router, checkAndRedirect]);

  return null;
};

// enables the React Query API invocation
export default apiQuery.withTRPC(MyApp);
