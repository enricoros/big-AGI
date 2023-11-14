import * as React from 'react';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider } from '@mui/joy';

import { appTheme, createEmotionCache } from '~/common/app.theme';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


export const ProviderTheming = (props: { emotionCache?: EmotionCache, children: React.ReactNode }) =>
  <CacheProvider value={props.emotionCache || clientSideEmotionCache}>
    <CssVarsProvider defaultMode='light' theme={appTheme}>
      <CssBaseline />
      {props.children}
    </CssVarsProvider>
  </CacheProvider>;