import * as React from 'react';

import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider } from '@mui/joy';

import { appTheme, createEmotionCache } from '~/common/app.theme';


// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


/**
 * As part of the theming, we define global SVG filters here. This will add
 * texture and tactileness to the design. They should be in the appTheme file,
 * but I did not want to have react components in that file.
 */
const _GlobalSVGFiltersMemo = React.memo(function GlobalSVGFilters() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id='filter-roughpaper'>
          <feTurbulence type='fractalNoise' baseFrequency='0.04' result='noise' numOctaves='5' />
          <feDiffuseLighting in='noise' lightingColor='#fff' surfaceScale='2'>
            <feDistantLight azimuth='45' elevation='60' />
          </feDiffuseLighting>
        </filter>
        {/* Add more filters here as needed */}
      </defs>
    </svg>
  );
});


export const ProviderTheming = (props: { emotionCache?: EmotionCache, children: React.ReactNode }) =>
  <CacheProvider value={props.emotionCache || clientSideEmotionCache}>
    <CssVarsProvider defaultMode='light' theme={appTheme}>
      <CssBaseline />
      <_GlobalSVGFiltersMemo />
      {props.children}
    </CssVarsProvider>
  </CacheProvider>;