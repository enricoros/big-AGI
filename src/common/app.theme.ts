import createCache from '@emotion/cache';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { extendTheme } from '@mui/joy';
import { keyframes } from '@emotion/react';


// CSS utils
export const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
// export const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };

// Dimensions
export const formLabelStartWidth = 150;


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

export const appTheme = extendTheme({
  fontFamily: {
    body: inter.style.fontFamily,
    code: jetBrainsMono.style.fontFamily,
  },
  colorSchemes: {
    light: {
      palette: {
        neutral: {
          plainColor: 'var(--joy-palette-neutral-800)',     // [700 -> 800] Dropdown menu: increase text contrast a bit
          solidBg: 'var(--joy-palette-neutral-700)',        // [500 -> 700] AppBar background & Button[solid]
          solidHoverBg: 'var(--joy-palette-neutral-800)',   // [600 -> 800] Buttons[solid]:hover
        },
        // primary [800] > secondary [700 -> 800] > tertiary [600] > icon [500 -> 700]
        text: {
          icon: 'var(--joy-palette-neutral-700)',           // <IconButton color='neutral' /> icon color
          secondary: 'var(--joy-palette-neutral-800)',      // increase contrast a bit
          // tertiary: 'var(--joy-palette-neutral-700)',       // increase contrast a bit
        },
        // popup [white] > surface [50] > level1 [100] > level2 [200] > level3 [300 -> unused] > body [white -> 300]
        background: {
          // New
          surface: 'var(--joy-palette-neutral-50, #FBFCFE)',
          level1: 'var(--joy-palette-neutral-100, #F0F4F8)',
          level2: 'var(--joy-palette-neutral-200, #DDE7EE)',
          body: 'var(--joy-palette-neutral-300, #CDD7E1)',
          // Former
          // body: 'var(--joy-palette-neutral-400, #9FA6AD)',
        },
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
          // New
          popup: '#24292c', // 3: #32383E, 1: #171A1C, 2: #25282B
          surface: 'var(--joy-palette-neutral-800, #171A1C)',
          level1: 'var(--joy-palette-neutral-900, #0B0D0E)',
          level2: 'var(--joy-palette-neutral-800, #171A1C)',
          body: '#060807',
          // Former: popup > surface [900] > level 1 [black], level 2 [800] > body [black]
        },
      },
    },
  },
  components: {
    /**
     * Input
     *  - remove the box-shadow: https://github.com/mui/material-ui/commit/8d4728df8a66d710660af96ac7ff3f86d2d26382
     */
    JoyInput: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },

    /**
     * Select
     * - remove the box-shadow: https://github.com/mui/material-ui/commit/8d4728df8a66d710660af96ac7ff3f86d2d26382
     * */
    JoySelect: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },

    /**
     * Switch: increase the size of the thumb, to a default iconButton
     * NOTE: do not use anything else than 'md' size
     */
    JoySwitch: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.size === 'md' && {
            '--Switch-trackWidth': '40px',
            '--Switch-trackHeight': '24px',
            '--Switch-thumbSize': '18px',
          }),
        }),
      },
    },
  },
});

export const themeBgApp = 'background.level1';
export const themeBgAppDarker = 'background.level2';
export const themeBgAppChatComposer = 'background.surface';

export const lineHeightChatText = 1.75;
export const lineHeightTextarea = 1.75;

export const themeZIndexPageBar = 25;
export const themeZIndexDesktopDrawer = 26;
export const themeZIndexDesktopNav = 27;

export const themeBreakpoints = appTheme.breakpoints.values;

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
