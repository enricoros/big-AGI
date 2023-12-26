import type { EmotionCache } from '@emotion/react';


// export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
//   // require .layoutOptions on the page component
//   layoutOptions: LayoutOptions;
// };

// Extend the AppProps type with the custom page component type
declare module 'next/app' {
  import { AppProps } from 'next/app';

  type MyAppProps = AppProps & {
    // Component: NextPageWithLayout;
    emotionCache?: EmotionCache;
  };
}