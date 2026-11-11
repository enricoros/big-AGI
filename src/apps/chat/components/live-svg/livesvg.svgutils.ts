/**
 * Live SVG Animator - SVG extraction, sanitization, size enforcement, and model auto-pick.
 *
 * The existing rasterizer (renderSVGToPNGBlob) needed a fixed-output-size argument (added there).
 */

import { llmsStoreState } from '~/common/stores/llms/store-llms';
import { LLM_IF_OAI_Vision, type DLLM } from '~/common/stores/llms/llms.types';
import { sanitizeSvgMarkup } from '~/common/util/svgSanitizeUtils';

import { LIVESVG_FRAME_SIZE } from './livesvg.types';


/**
 * Extract the first complete <svg>...</svg> block from free model text.
 * Returns null when no plausible SVG is present (caller may repair-retry).
 */
export function extractSvg(text: string): string | null {
  if (!text) return null;
  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : null;
}


/** Extract ALL complete <svg>...</svg> blocks, in order (for multi-frame-per-call responses). */
export function extractAllSvgs(text: string): string[] {
  if (!text) return [];
  return text.match(/<svg[\s\S]*?<\/svg>/gi) ?? [];
}


/** Strip active content (scripts, handlers, SMIL, non-fragment URLs) before live DOM injection / rasterization. */
export function sanitizeSvg(svg: string): string {
  return sanitizeSvgMarkup(svg);
}


/**
 * Force the root <svg> to be exactly LIVESVG_FRAME_SIZE square with a matching viewBox,
 * so both the live render and the rasterized PNG are a stable 512x512 (and viewBox-only
 * SVGs do not decode to 0x0 in the rasterizer).
 */
export function enforceSvg512(svg: string): string {
  const S = LIVESVG_FRAME_SIZE;
  return svg.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
    let a = attrs;
    a = a.replace(/\swidth\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    a = a.replace(/\sheight\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    if (!/viewBox\s*=/i.test(a))
      a += ` viewBox="0 0 ${S} ${S}"`;
    if (!/xmlns\s*=/i.test(a))
      a += ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg width="${S}" height="${S}"${a}>`;
  });
}


/**
 * Auto-pick the inference model: prefer Cerebras + Google Gemma (multimodal, fast ~1800 tok/s),
 * then any Cerebras vision model, then any configured vision model so the feature still works
 * without a Cerebras key. Returns null when no vision-capable model is configured.
 */
export function findLiveSvgLLM(): DLLM | null {
  const llms = llmsStoreState().llms.filter((l) => !l.hidden && l.interfaces.includes(LLM_IF_OAI_Vision));
  const isGemma = (l: DLLM) => l.initialParameters?.llmRef?.startsWith('gemma') || l.id.includes('gemma');
  return (
    llms.find((l) => l.vId === 'cerebras' && isGemma(l)) ||
    llms.find((l) => l.vId === 'cerebras') ||
    llms.find(isGemma) ||
    llms[0] ||
    null
  );
}
