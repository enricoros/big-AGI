import type { EmotionCache } from '@emotion/react';


// export type GetLayout = (page: ReactElement) => ReactNode;

// Extend the NextPage type with an optional getLayout function
// type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
//   getLayout?: GetLayout;
// };

// Extend the AppProps type with the custom page component type
declare module 'next/app' {
  import { AppProps } from 'next/app';

  type MyAppProps = AppProps & {
    // Component: NextPageWithLayout;
    emotionCache?: EmotionCache;
  };
}