// /**
//  * AUTO-GENERATED — do not edit the symbol definitions or VI entries manually.
//  * Source of truth: individual vendor icon files in src/modules/llms/components/
//  *
//  * Regenerate: npm run gen:icon-sprites
//  */
// import * as React from 'react';
//
// import type { ModelVendorId } from '../vendors/vendors.registry';
//
// import { PhRobot } from '~/common/components/icons/phosphor/PhRobot';
//
// // Symbol IDs for each vendor — generated from the vendor registry
// const VI: Record<ModelVendorId, string> = {
// /* __GENERATED_VI_ENTRIES__ */
// } as const;
//
//
// /**
//  * Memoized SVG sprite with all vendor icon `<symbol>` definitions.
//  * Mount once in the app root (ProviderTheming) — all `<use href="#vi-...">` references resolve from here.
//  *
//  * Joy's SvgIcon sets CSS `fill: currentColor` which overrides `fill='none'` props. To match,
//  * all `<g>` wrappers use `fill='currentColor'`. Paths with explicit `fill='none'` still override.
//  */
// export const VendorIconSpriteMemo = React.memo(function VendorIconSprite() {
//   return (
//     <svg xmlns='http://www.w3.org/2000/svg' style={_spriteContainerSx}>
//       <defs>
// {/* __GENERATED_SYMBOLS__ */}
//       </defs>
//     </svg>
//   );
// });
//
// const _spriteContainerSx: React.CSSProperties = { position: 'absolute', width: 0, height: 0, overflow: 'hidden' };
//
//
// /**
//  * Lightweight vendor icon using SVG sprite `<use href>`.
//  * Near-zero per-instance cost — no Emotion/styled-components.
//  *
//  * Uses Joy's CSS custom properties (--Icon-fontSize, --Icon-margin, --Icon-color)
//  * so parent components (ListItemDecorator, etc.) control sizing automatically.
//  * Accepts optional `sx` with `fontSize` override for explicit sizing.
//  */
// export function LLMVendorIconSprite({ vendorId /*, sx, className*/ }: {
//   vendorId: ModelVendorId | undefined;
//   // sx?: { fontSize?: number | string; ml?: number | string; color?: string };
//   // className?: string;
// }) {
//   const symbolId = vendorId ? VI[vendorId] : undefined;
//   if (!symbolId)
//     return <PhRobot />;
//
//   // Compute style only when sx overrides are present
//   // let style: React.CSSProperties = _lwBaseSx;
//   // if (sx) {
//   //   const s: React.CSSProperties = { ..._lwBaseSx };
//   //   if (sx.fontSize !== undefined) s.fontSize = typeof sx.fontSize === 'number' ? sx.fontSize : sx.fontSize;
//   //   if (sx.ml !== undefined) s.marginLeft = typeof sx.ml === 'number' ? sx.ml * 8 : sx.ml;
//   //   if (sx.color !== undefined) s.color = sx.color;
//   //   style = s;
//   // }
//
//   // was: <svg xmlns='http://www.w3.org/2000/svg' focusable={false} aria-hidden style={style} className={className}>
//   // was:   <use href={`#${symbolId}`} width='100%' height='100%' />
//   // was: </svg>
//   return (
//     <svg xmlns='http://www.w3.org/2000/svg' aria-hidden className='agi-vendor-icon-sprite'>
//       <use href={`#${symbolId}`} />
//     </svg>
//   );
// }
//
// // Matches Joy's SvgIcon base styles — uses the same CSS custom properties
// // const _lwBaseSx: React.CSSProperties = {
// //   width: '1em',
// //   height: '1em',
// //   display: 'inline-block',
// //   fill: 'currentColor',
// //   flexShrink: 0,
// //   userSelect: 'none',
// //   margin: 'var(--Icon-margin)',
// //   fontSize: 'var(--Icon-fontSize, 1.5rem)',
// //   color: 'var(--Icon-color)',
// // } as const;
