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
        {/*<filter id='agi-roughpaper'>*/}
        {/*  <feTurbulence type='fractalNoise' baseFrequency='0.04' result='noise' numOctaves='5' />*/}
        {/*  <feDiffuseLighting in='noise' lightingColor='#fff' surfaceScale='2'>*/}
        {/*    <feDistantLight azimuth='45' elevation='60' />*/}
        {/*  </feDiffuseLighting>*/}
        {/*</filter>*/}

        {/*<filter id='agi-futuristic-glow'>*/}
        {/*  <feGaussianBlur in='SourceGraphic' stdDeviation='4' result='blur' />*/}
        {/*  <feColorMatrix in='blur' mode='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 40 -7' result='glow' />*/}
        {/*  <feBlend in='SourceGraphic' in2='glow' mode='multiply' />*/}
        {/*</filter>*/}

        {/*<filter id='agi-holographic'>*/}
        {/*  <feTurbulence type='fractalNoise' baseFrequency='0.01' numOctaves='7' result='noise' />*/}
        {/*  <feDisplacementMap in='SourceGraphic' in2='noise' scale='50' xChannelSelector='R' yChannelSelector='G' />*/}
        {/*</filter>*/}

        {/*<filter id='agi-ai-texture'>*/}
        {/*  <feTurbulence type='fractalNoise' baseFrequency='1' numOctaves='1' />*/}
        {/*  <feColorMatrix type='saturate' values='0.2' />*/}
        {/*  <feBlend in='SourceGraphic' mode='multiply' />*/}
        {/*</filter>*/}
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