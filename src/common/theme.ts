import createCache from '@emotion/cache';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { extendTheme } from '@mui/joy';
import { keyframes } from '@emotion/react';


// CSS utils
export const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
export const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };

// Dimensions
export const settingsGap = 2;
export const settingsCol1Width = 150;


// Theme & Fonts

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['monospace'],
});

export const theme = extendTheme({
  fontFamily: {
    body: inter.style.fontFamily,
    code: jetBrainsMono.style.fontFamily,
  },
  colorSchemes: {
    light: {
      palette: {
        neutral: {
          plainColor: 'var(--joy-palette-neutral-800)',     // increase contrast a bit - Menu text
          solidBg: 'var(--joy-palette-neutral-700)',        // AppBar: background (#32383E)
          solidHoverBg: 'var(--joy-palette-neutral-800)',   // AppBar: buttons background on hover
        },
        text: {
          icon: 'var(--joy-palette-neutral-700)',           // <IconButton color='neutral' /> icon color
          secondary: 'var(--joy-palette-neutral-800)',      // increase contrast a bit
          // tertiary: 'var(--joy-palette-neutral-700)',
        },
        background: {
          // popup | surface > level1 > level2 > level3 > body
          body: 'var(--joy-palette-neutral-400, #9FA6AD)',  // Body: background
          popup: '#fff',
        },
        // common: {
        //   white: '#fff',
        // },
      },
    },
    dark: {
      palette: {
        text: {
          // do not increase contrast - text.primary would scream at you
          // secondary: 'var(--joy-palette-neutral-100, #EAEEF6)',
          // tertiary: 'var(--joy-palette-neutral-400, #9FA6AD)',
        },
        background: {
          surface: 'var(--joy-palette-neutral-900, #131318)',
          level1: 'var(--joy-palette-common-black, #09090D)',
          level2: 'var(--joy-palette-neutral-800, #25252D)',
          // popup: 'var(--joy-palette-common-black, #09090D)',
        },
      },
    },
  },
});

export const bodyFontClassName = inter.className;

export const cssRainbowColorKeyframes = keyframes`
  100%, 0% {
    color: rgb(255, 0, 0);
  }
  8% {
    color: rgb(204, 102, 0);
  }
  16% {
    color: rgb(128, 128, 0);
  }
  25% {
    color: rgb(77, 153, 0);
  }
  33% {
    color: rgb(0, 179, 0);
  }
  41% {
    color: rgb(0, 153, 82);
  }
  50% {
    color: rgb(0, 128, 128);
  }
  58% {
    color: rgb(0, 102, 204);
  }
  66% {
    color: rgb(0, 0, 255);
  }
  75% {
    color: rgb(127, 0, 255);
  }
  83% {
    color: rgb(153, 0, 153);
  }
  91% {
    color: rgb(204, 0, 102);
  }`;

export const cssScaleKeyframes = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }`;


// Emotion Cache (with insertion point on the SSR pass)

const isBrowser = typeof document !== 'undefined';

export function createEmotionCache() {
  let insertionPoint;

  if (isBrowser) {
    // On the client side, _document.tsx has a meta tag with the name "emotion-insertion-point" at the top of the <head>.
    // This assures that MUI styles are loaded first, and allows allows developers to easily override MUI styles with other solutions like CSS modules.
    const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
      'meta[name="emotion-insertion-point"]',
    );
    insertionPoint = emotionInsertionPoint ?? undefined;
  }

  return createCache({ key: 'mui-style', insertionPoint });
}

// MISC

// For next April Fools' week
// export const foolsMode = new Date().getMonth() === 3 && new Date().getDate() <= 7;
