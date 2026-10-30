import localFont from 'next/font/local';

/*
 * Inter and JetBrains Mono, self-hosted from the Google Fonts files in this folder - see README.md to update them.
 *
 * One call per subset file, all declared into the same family: the browser downloads a file only when the page
 * shows a character in its unicode-range, and preloads only Latin. Call order follows Google's CSS, where the last
 * declared face wins on overlapping ranges. next/font requires literal arguments, so the ranges repeat per family.
 * The size-adjusted fallback faces are pinned in app.fonts.css, so every call sets adjustFontFallback: false.
 *
 * next/font CSS is side-effect free: production builds drop the @font-face of a call whose result is never read,
 * so the exported family strings read every call (they equal the Latin call's: same family, then its fallbacks).
 */

function _joinFamilies(...fonts: { style: { fontFamily: string } }[]): string {
  return [...new Set(fonts.flatMap(({ style }) => style.fontFamily.split(', ')))].join(', ');
}


// Inter - variable, 400-700

const _interCyrillicExt = localFont({
  src: './inter/cyrillic-ext.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' }],
});
const _interCyrillic = localFont({
  src: './inter/cyrillic.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const _interGreekExt = localFont({
  src: './inter/greek-ext.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+1F00-1FFF' }],
});
const _interGreek = localFont({
  src: './inter/greek.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF' }],
});
const _interVietnamese = localFont({
  src: './inter/vietnamese.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
});
const _interLatinExt = localFont({
  src: './inter/latin-ext.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
});
// Latin: preloaded
const _interLatin = localFont({
  src: './inter/latin.woff2', weight: '400 700', adjustFontFallback: false,
  fallback: ['\'Inter Fallback\'', 'Helvetica', 'Arial', 'sans-serif'],
  declarations: [{ prop: 'font-family', value: 'Inter' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});


// JetBrains Mono - variable, 400-700 (no greek-ext subset)

const _jetBrainsMonoCyrillicExt = localFont({
  src: './jetbrains-mono/cyrillic-ext.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' }],
});
const _jetBrainsMonoCyrillic = localFont({
  src: './jetbrains-mono/cyrillic.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const _jetBrainsMonoGreek = localFont({
  src: './jetbrains-mono/greek.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF' }],
});
const _jetBrainsMonoVietnamese = localFont({
  src: './jetbrains-mono/vietnamese.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
});
const _jetBrainsMonoLatinExt = localFont({
  src: './jetbrains-mono/latin-ext.woff2', weight: '400 700', preload: false, adjustFontFallback: false,
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
});
// Latin: preloaded
const _jetBrainsMonoLatin = localFont({
  src: './jetbrains-mono/latin.woff2', weight: '400 700', adjustFontFallback: false,
  fallback: ['\'JetBrains Mono Fallback\'', 'monospace'],
  declarations: [{ prop: 'font-family', value: 'JetBrains Mono' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});


export const fontFamilyInterCss = _joinFamilies(_interLatin, _interLatinExt, _interVietnamese, _interGreek, _interGreekExt, _interCyrillic, _interCyrillicExt);
export const fontFamilyJetBrainsMonoCss = _joinFamilies(_jetBrainsMonoLatin, _jetBrainsMonoLatinExt, _jetBrainsMonoVietnamese, _jetBrainsMonoGreek, _jetBrainsMonoCyrillic, _jetBrainsMonoCyrillicExt);
