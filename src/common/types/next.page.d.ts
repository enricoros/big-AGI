import type { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';
import type { EmotionCache } from '@emotion/react';


export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  // definition of the per-page layout function, as per:
  // https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts#per-page-layouts
  getLayout?: (page: ReactElement) => ReactNode;
}

// Extend the AppProps type with the custom page component type
declare module 'next/app' {
  import { AppProps } from 'next/app';

  type MyAppProps = AppProps & {
    Component: NextPageWithLayout
    emotionCache?: EmotionCache;
  };
}
