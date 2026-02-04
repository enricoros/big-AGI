// /**
//  * AUTO-GENERATED — do not edit the symbol definitions or VI entries manually.
//  * Source of truth: individual vendor icon files in src/common/components/icons/vendors/
//  *
//  * Regenerate: npm run gen:icon-sprites
//  * Regenerate: node tools/develop/gen-icon-sprites/generate-llm-sprites.mjs
//  */
// import * as React from 'react';
//
// import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';
//
//
// // Symbol IDs for each vendor — generated from the vendor registry
// const VI: Record<ModelVendorId, string> = {
// /* __GENERATED_VI_ENTRIES__ */
// } as const;
//
//
// // Joy fontSize tokens -> CSS
// const _FS: Record<string, string> = {
//   inherit: 'inherit', xs: '1rem', sm: '1.25rem', md: '1.5rem', lg: '1.875rem',
//   xl: '2.25rem', xl2: '3rem', xl3: '4rem', xl4: '6rem',
// };
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
//  * Lightweight vendor icon that references the sprite via `<use href>`.
//  * Near-zero rendering cost per instance — no Emotion/styled-components overhead.
//  *
//  * Supports a minimal subset of Joy's `sx` prop: `fontSize`, `ml`/`mr`/`mt`/`mb`/`mx`/`my`/`m`, `color`.
//  */
// export function VendorIconLw({ vendorId, sx, className }: {
//   vendorId: ModelVendorId | undefined;
//   sx?: Record<string, unknown>;
//   className?: string;
// }) {
//   const symbolId = vendorId ? VI[vendorId] : undefined;
//   if (!symbolId) return null;
//
//   // Build style: base + sx overrides
//   let style = _lwBaseSx;
//   if (sx) {
//     const s: React.CSSProperties = { ..._lwBaseSx };
//     if (sx.fontSize !== undefined)
//       s.fontSize = typeof sx.fontSize === 'number' ? `${sx.fontSize}px` : (_FS[sx.fontSize as string] ?? sx.fontSize) as string;
//     if (sx.ml !== undefined) s.marginLeft = _sp(sx.ml);
//     if (sx.mr !== undefined) s.marginRight = _sp(sx.mr);
//     if (sx.mt !== undefined) s.marginTop = _sp(sx.mt);
//     if (sx.mb !== undefined) s.marginBottom = _sp(sx.mb);
//     if (sx.mx !== undefined) { const v = _sp(sx.mx); s.marginLeft = v; s.marginRight = v; }
//     if (sx.my !== undefined) { const v = _sp(sx.my); s.marginTop = v; s.marginBottom = v; }
//     if (sx.m !== undefined) s.margin = _sp(sx.m);
//     if (sx.color) s.color = sx.color as string;
//     style = s;
//   }
//
//   return (
//     <svg xmlns='http://www.w3.org/2000/svg' focusable={false} aria-hidden style={style} className={className}>
//       <use href={`#${symbolId}`} width='100%' height='100%' />
//     </svg>
//   );
// }
//
// const _lwBaseSx: React.CSSProperties = {
//   width: '1em',
//   height: '1em',
//   display: 'inline-block',
//   flexShrink: 0,
//   userSelect: 'none',
// };
//
// function _sp(v: unknown): string | undefined {
//   if (typeof v === 'number') return `${v * 8}px`;
//   return v as string;
// }
