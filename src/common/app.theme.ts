import createCache, { StylisElement, StylisPlugin } from '@emotion/cache';

import { extendTheme, PaletteRange } from '@mui/joy';

import { animationEnterBelow, animationOpacityFadeIn } from '~/common/util/animUtils';
import { fontFamilyInterCss, fontFamilyJetBrainsMonoCss } from '~/common/styles/fonts/app.fonts';
import { joyWindowManagerDefaults } from '~/common/components/dnd-window/joyWindowManager';


// TypeScript module augmentation for the custom 'accent' (brand lime) palette
declare module '@mui/joy/styles' {
  // noinspection JSUnusedGlobalSymbols
  interface ColorPalettePropOverrides {
    accent: true; // enables color='accent' on all Joy UI components
  }

  // noinspection JSUnusedGlobalSymbols
  interface Palette {
    accent: PaletteRange;
  }
}


// Definitions
export type UIComplexityMode = 'minimal' | 'pro' | 'extra';
export type ContentScaling = 'xs' | 'sm' | 'md';


// CSS utils
export const hideOnMobile = { display: { xs: 'none', md: 'flex' } };


// Theme & Fonts - weights 400 (default), 500 (md), 600 (lg), 700 (xl); 300 (sm) is not loaded

export const themeFontFamilyCss = fontFamilyInterCss;
export const themeCodeFontFamilyCss = fontFamilyJetBrainsMonoCss;

/**
 * Hotter lime for 'New'/'Beta' badges - intentionally brighter than the 400 brand anchor
 * so tiny chips pop; pairs with black text and bold weight. Mirrors the website's
 * RankingsSection chipNew - keep the two in sync.
 */
export const brandLimeExtraBadge = '#d4ff3a';


/**
 * Brand 'accent' (lime) color scale, shared by both color schemes.
 * OKLCH ramp (2026-07-08): brand #d5ec31 at 400, hue ~117 -> 120.5 olive drift, chroma
 * peaking at the anchor, deep darks. Job steps: 100 light soft bg, 400 solid bg (both
 * schemes), 500 hover, 600 active + light borders, 700 light-mode text (5.05:1 AA on
 * white), 900 dark-mode deep surface.
 * This is the source of truth for the brand lime - update website/src/theme.ts to match.
 * Channels auto-derive mainChannel <- 500 (light) / 400 (dark), lightChannel <- 200,
 * darkChannel <- 700; the light scheme OVERRIDES mainChannel to 700 (see palette) since
 * Typography/Link render a variant-less color= as rgba(mainChannel / 1).
 */
const _accentLimeScale = {
  50: '#f7fde2',
  100: '#eff9c7',  // light softBg
  200: '#e6f5a3',
  300: '#ddf175',
  400: '#d5ec31',  // lime - THE primary brand accent (solid bg in both schemes)
  500: '#c4db28',  // hover
  600: '#a7bd1e',  // active, light-mode borders
  700: '#667600',  // light-mode text (5.05:1 on white)
  800: '#435000',
  900: '#242c03',  // dark-mode deep soft surface
} as const;

/** Brand lime (accent 400) as a hex string, for where a CSS variable cannot reach (canvas fills, hex-alpha suffixes); elsewhere use the Joy 'accent' palette */
export const brandLime = _accentLimeScale[400];


export const createAppTheme = (uiComplexityMinimal: boolean) => extendTheme({
  fontFamily: {
    body: themeFontFamilyCss,
    display: themeFontFamilyCss,
    code: themeCodeFontFamilyCss,
  },
  // NOTE: the standalone /dev/inspect/*.html dev tools hand-mirror these neutral/background hex tokens
  // (they intentionally have zero app imports). If you change the palette below, update those pages' CSS to match.
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
          backdrop: 'rgba(var(--joy-palette-neutral-darkChannel, 11 13 14) / 0.3333)', // was: 0.25
          // Former
          // body: 'var(--joy-palette-neutral-400, #9FA6AD)',
        },
        // 'accent': brand lime - light: step-based tints (softBg 100 family), olive 700
        // text, brand 400 solid; disabled tokens follow Joy defaults for uniformity
        accent: {
          ..._accentLimeScale,
          // Typography/Link render variant-less color= as rgba(mainChannel / 1); auto
          // derivation would pick 500 (an unreadable light lime on white) - pin to 700
          mainChannel: '102 118 0',
          // solid: the brand CTA - lime surface, black text (~16:1)
          solidColor: '#000',
          solidBg: 'var(--joy-palette-accent-400)',
          solidHoverBg: 'var(--joy-palette-accent-500)',
          solidActiveBg: 'var(--joy-palette-accent-600)',
          solidDisabledColor: 'var(--joy-palette-neutral-400)',
          solidDisabledBg: 'var(--joy-palette-neutral-100)',
          // soft: pale-lime step tints, deep-olive text (800: one notch darker than the
          // 700 text step, for contrast on the tinted bg)
          softColor: 'var(--joy-palette-accent-800)',
          softBg: 'var(--joy-palette-accent-100)',
          softHoverBg: 'var(--joy-palette-accent-200)',
          softActiveBg: 'var(--joy-palette-accent-300)',
          softDisabledColor: 'var(--joy-palette-neutral-400)',
          softDisabledBg: 'var(--joy-palette-neutral-50)',
          // outlined: olive text, mid-lime border
          outlinedColor: 'var(--joy-palette-accent-700)',
          outlinedBorder: 'var(--joy-palette-accent-600)',
          outlinedHoverBg: 'var(--joy-palette-accent-100)',
          outlinedActiveBg: 'var(--joy-palette-accent-200)',
          outlinedDisabledColor: 'var(--joy-palette-neutral-400)',
          outlinedDisabledBorder: 'var(--joy-palette-neutral-200)',
          // plain
          plainColor: 'var(--joy-palette-accent-700)',
          plainHoverBg: 'var(--joy-palette-accent-100)',
          plainActiveBg: 'var(--joy-palette-accent-200)',
          plainDisabledColor: 'var(--joy-palette-neutral-400)',
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
        // 'accent': brand lime - dark: the lime-on-black look - vivid 400 text everywhere
        // (mainChannel auto-derives from 400, correct as-is), translucent lime glows for
        // soft/hover (alt: an opaque accent-900 softBg reads calmer on large alerts/sheets)
        accent: {
          ..._accentLimeScale,
          // solid: the brand CTA - lime surface, black text
          solidColor: '#000',
          solidBg: 'var(--joy-palette-accent-400)',
          solidHoverBg: 'var(--joy-palette-accent-500)',
          solidActiveBg: 'var(--joy-palette-accent-600)',
          solidDisabledColor: 'var(--joy-palette-neutral-500)',
          solidDisabledBg: 'var(--joy-palette-neutral-800)',
          // soft: translucent lime glow (channel token: dark mainChannel derives from 400,
          // the brand), vivid lime text
          softColor: 'var(--joy-palette-accent-400)',
          softBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.08)',
          softHoverBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.28)',
          softActiveBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.36)',
          softDisabledColor: 'var(--joy-palette-neutral-500)',
          softDisabledBg: 'transparent',
          // outlined: vivid lime text, mid-lime border
          outlinedColor: 'var(--joy-palette-accent-400)',
          outlinedBorder: 'var(--joy-palette-accent-600)',
          outlinedHoverBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.08)',
          outlinedActiveBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.16)',
          outlinedDisabledColor: 'var(--joy-palette-neutral-500)',
          outlinedDisabledBorder: 'var(--joy-palette-neutral-700)',
          // plain
          plainColor: 'var(--joy-palette-accent-400)',
          plainHoverBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.08)',
          plainActiveBg: 'rgba(var(--joy-palette-accent-mainChannel, 213 236 49) / 0.16)',
          plainDisabledColor: 'var(--joy-palette-neutral-500)',
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
     * Badge
     * - add a 'color-feature' color, to be used with the FeatureBadge component
     */
    JoyBadge: {
      styleOverrides: {
        badge: ({ ownerState }) =>
          // HACK: we set this to 'color-feature' to force the theming to our liking
          (ownerState.color as any) !== 'color-feature' ? undefined : ({
            backgroundColor: '#0288D1',
          }),
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
      defaultProps: joyWindowManagerDefaults,
      styleOverrides: {
        backdrop: uiComplexityMinimal ? {
          backdropFilter: 'none', // always un-blur on minimal
          // and no animation either, to keep it simple
        } : {
          animation: `${animationOpacityFadeIn} 0.16s ease-out`,
        },
      },
    },
    JoyDrawer: {
      defaultProps: joyWindowManagerDefaults,
    },
    JoyModalDialog: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: {
            '--Card-padding': '1rem',
          },
          ...(!uiComplexityMinimal && {
            '& .agi-animate-enter': {
              animation: `${animationEnterBelow} 0.16s ease-out`,
            },
          }),
        }),
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

export const themeMinWidthChatPane = '18rem'; // chat list + chat/beam wrapper floor (was the panel's minSize=20%); below it the message list overflows and the scroll box pans horizontally
export const lineHeightChatTextMd = 1.75;
export const lineHeightTextareaMd = 1.75;

export const themeZIndexBeamView = 10;
export const themeZIndexPageBar = 25;
export const themeZIndexDesktopDrawer = 26;
export const themeZIndexDesktopPanel = 27;
export const themeZIndexDesktopNav = 30;
export const themeZIndexChatBubble = 50;
export const themeZIndexDragOverlay = 60;
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
  // OptimaPanelGroup
  optimaPanelGroupSize: 'sm' | 'md';
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
    optimaPanelGroupSize: 'sm',
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
    optimaPanelGroupSize: 'sm',
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
    optimaPanelGroupSize: 'md',
  },
  // lg: {
  //   chatDrawerFoldersLineHeight: '3rem',
  // },
};


// Emotion Cache (with insertion point on the SSR pass)

const isBrowser = typeof document !== 'undefined';

const emotionStylisPlugins: StylisPlugin[] = [

  /**
   * 1. not the stock prefixer plugin (bloating): only the -webkit- prefixes the browser floor still needs -
   * backdrop-filter until Safari 18, mask-image until Chrome 120, user-select on every Safari.
   * Also covers Joy's own styles, e.g. the Modal backdrop blur and userSelect: 'none' on Button.
   */
  // prefixer,
  function prefixFloorDeclarations(element: StylisElement) {
    if (element.type === 'decl' && (element.props === 'backdrop-filter' || element.props === 'mask-image' || element.props === 'user-select'))
      element.return = `-webkit-${element.value}${element.value}`; // a declaration's value is the whole 'prop:value;'
  },

  /**
   * 2. add a function to remove wide-matching CSS rules from Joy UI.
   * Culprit: https://github.com/mui/material-ui/blob/a705e1f15075b2deb59263868bfa7b1d9f84cdd4/packages/mui-joy/src/Checkbox/Checkbox.tsx#L59
   * These '~ *' rules are slow and cause a lot of reflows.
   *
   * To validate, search the Elements tab for JoyCheckbox-root, and see if there's the '~ *' rule.
   */
  function removeSlowCSS(element: StylisElement /*, index, children, callback*/) {
    if (
      element.type === 'rule' // only operate on rules
      && element.value.endsWith('~*')  // where the selector is broad reaching
      && Array.isArray(element.children)  // and there are children (rules)
    ) {
      // console.log('✓ Filtering out problematic selector:', element);
      element.return = ' ';  // removes the selector (empirical)
      element.children = []; // removes the rule (empirical)
    }
  },

];


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

  return createCache({ key: 'mui-style', insertionPoint: insertionPoint, stylisPlugins: emotionStylisPlugins });
}

// MISC

// For next April Fools' week
// export const foolsMode = new Date().getMonth() === 3 && new Date().getDate() <= 7;
