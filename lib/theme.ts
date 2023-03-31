import createCache from '@emotion/cache';
import { keyframes } from '@emotion/react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { extendTheme } from '@mui/joy';


// Theme & Fonts

export const foolsMode = new Date().getMonth() === 3 && new Date().getDate() <= 7;

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
        primary: {
          // 50: '#bfc6d9', // softBg
          // 100: '#a5b1cf', // plainHoverBg
          // 100: '#f0f4ff', // plainHoverBg
          100: '#f0f8ff', // aliceblue
          // 200: '#6984c9',
          // 300: '#4970d1',
          // 400: '#2157de',
          // 500: '#0D46D7', // solidBg [Button.solid]
          // 600: '#1b47b5', // solidHoverBg [IconButton.plain (fg)]
          // 700: '#264594',
          // 800: '#2f3f69',
          // 900: '#2f384d',
        },
        neutral: {
          solidBg: 'var(--joy-palette-neutral-700, #434356)',
          solidHoverBg: 'var(--joy-palette-neutral-800, #25252D)',
          // 50: '#F7F7F8',
          // 100: '#EBEBEF',
          // 200: '#D8D8DF',
          // 300: '#B9B9C6',
          // 400: '#8F8FA3',
          // 500: '#73738C',
          // 600: '#5A5A72', // solidBg [Button.solid]
          // 700: '#434356', // solidHoverBg
          // 800: '#25252D',
          // 900: '#131318',
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