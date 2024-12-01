import createCache from '@emotion/cache';

import { Inter, JetBrains_Mono } from 'next/font/google';
import { extendTheme } from '@mui/joy';

import { animationEnterModal } from '~/common/util/animUtils';


// Definitions
export type UIComplexityMode = 'minimal' | 'pro' | 'extra';
export type ContentScaling = 'xs' | 'sm' | 'md';


// CSS utils
export const hideOnMobile = { display: { xs: 'none', md: 'flex' } };


// Theme & Fonts

const font = Inter({
  weight: [ /* '300', sm */ '400' /* (undefined, default) */, '500' /* md */, '600' /* lg */, '700' /* xl */],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
});
export const themeFontFamilyCss = font.style.fontFamily;

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['monospace'],
});
export const themeCodeFontFamilyCss = jetBrainsMono.style.fontFamily;


export const createAppTheme = (uiComplexityMinimal: boolean) => extendTheme({
  fontFamily: {
    body: themeFontFamilyCss,
    display: themeFontFamilyCss,
    code: themeCodeFontFamilyCss,
  },
  colorSchemes: {
    light: {
      palette: {
        neutral: {
          plainColor: 'var(--joy-palette-neutral-800)',     // [700 -> 800] Dropdown menu: increase text contrast a bit
          solidBg: 'var(--joy-palette-neutral-700)',        // [500 -> 700] PageBar background & Button[solid]
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

    // JoyMenuItem: {
    //   styleOverrides: {
    //     root: {
    //       '--Icon-fontSize': '1rem', // smaller menu(s) icon - default is 1.25rem ('xl', 20px)
    //     },
    //   },
    // },

    JoyModal: {
      styleOverrides: {
        backdrop: !uiComplexityMinimal ? undefined : {
          backdropFilter: 'none',
          // backdropFilter: 'blur(2px)',
        },
        root: uiComplexityMinimal ? undefined : {
          '& .agi-animate-enter': {
            animation: `${animationEnterModal} 0.2s`,
          },
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
            // '--Switch-trackWidth': '36px',
            // '--Switch-trackHeight': '22px',
            // '--Switch-thumbSize': '17px',
            '--Switch-thumbSize': '16px',
          }),
        }),
      },
    },
  },
});

export const themeBgApp = 'background.level1';
export const themeBgAppDarker = 'background.level2';
export const themeBgAppChatComposer = 'background.surface';

export const lineHeightChatTextMd = 1.75;
export const lineHeightTextareaMd = 1.75;

export const themeZIndexBeamView = 10;
export const themeZIndexPageBar = 25;
export const themeZIndexDesktopDrawer = 26;
export const themeZIndexDesktopPanel = 27;
export const themeZIndexDesktopNav = 30;
export const themeZIndexChatBubble = 50;
export const themeZIndexOverMobileDrawer = 1301;


// Dynamic UI Sizing

export function adjustContentScaling(scaling: ContentScaling, offset?: number) {
  if (!offset) return scaling;
  const scalingArray = ['xs', 'sm', 'md'];
  const scalingIndex = scalingArray.indexOf(scaling);
  const newScalingIndex = Math.max(0, Math.min(scalingArray.length - 1, scalingIndex + offset));
  return scalingArray[newScalingIndex] as ContentScaling;
}

interface ContentScalingOptions {
  // BlocksRenderer
  blockCodeFontSize: string;
  blockCodeMarginY: number;
  blockFontSize: string;
  blockImageGap: number;
  blockLineHeight: string | number;
  // ChatMessage
  chatMessagePadding: number;
  fragmentButtonFontSize: string;
  // ChatDrawer
  chatDrawerItemSx: { '--ListItem-minHeight': string, fontSize: string };
  chatDrawerItemFolderSx: { '--ListItem-minHeight': string, fontSize: string };
}

export const themeScalingMap: Record<ContentScaling, ContentScalingOptions> = {
  xs: {
    blockCodeFontSize: '0.75rem',
    blockCodeMarginY: 0.5,
    blockFontSize: 'xs',
    blockImageGap: 1,
    blockLineHeight: 1.666667,
    chatMessagePadding: 1,
    fragmentButtonFontSize: 'xs',
    chatDrawerItemSx: { '--ListItem-minHeight': '2.25rem', fontSize: 'sm' },          // 36px
    chatDrawerItemFolderSx: { '--ListItem-minHeight': '2.5rem', fontSize: 'sm' },     // 40px
  },
  sm: {
    blockCodeFontSize: '0.75rem',
    blockCodeMarginY: 1,
    blockFontSize: 'sm',
    blockImageGap: 1.5,
    blockLineHeight: 1.714286,
    chatMessagePadding: 1.5,
    fragmentButtonFontSize: 'sm',
    chatDrawerItemSx: { '--ListItem-minHeight': '2.25rem', fontSize: 'sm' },
    chatDrawerItemFolderSx: { '--ListItem-minHeight': '2.5rem', fontSize: 'sm' },
  },
  md: {
    blockCodeFontSize: '0.875rem',
    blockCodeMarginY: 1.5,
    blockFontSize: 'md',
    blockImageGap: 2,
    blockLineHeight: 1.75,
    chatMessagePadding: 2,
    fragmentButtonFontSize: 'sm',
    chatDrawerItemSx: { '--ListItem-minHeight': '2.5rem', fontSize: 'md' },           // 40px
    chatDrawerItemFolderSx: { '--ListItem-minHeight': '2.75rem', fontSize: 'md' },    // 44px
  },
  // lg: {
  //   chatDrawerFoldersLineHeight: '3rem',
  // },
};


// Emotion Cache (with insertion point on the SSR pass)

const isBrowser = typeof document !== 'undefined';

export function createEmotionCache() {
  let insertionPoint: HTMLElement | undefined;

  if (isBrowser) {
    // On the client side, _document.tsx has a meta tag with the name "emotion-insertion-point" at the top of the <head>.
    // This assures that MUI styles are loaded first, and allows allows developers to easily override MUI styles with other solutions like CSS modules.
    const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
      'meta[name="emotion-insertion-point"]',
    );
    insertionPoint = emotionInsertionPoint ?? undefined;
  }

  return createCache({ key: 'mui-style', insertionPoint: insertionPoint });
}

// MISC

// For next April Fools' week
// export const foolsMode = new Date().getMonth() === 3 && new Date().getDate() <= 7;
