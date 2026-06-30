/**
 * Live SVG Animator - SVG extraction, sanitization, size enforcement, and model auto-pick.
 *
 * These are the small gaps the inventory surfaced: no SVG sanitizer exists in the repo, and the
 * existing rasterizer (renderSVGToPNGBlob) needed a fixed-output-size argument (added there).
 */

import { llmsStoreState } from '~/common/stores/llms/store-llms';
import { LLM_IF_OAI_Vision, type DLLM } from '~/common/stores/llms/llms.types';

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


/**
 * Strip dangerous constructs before live DOM injection / rasterization.
 * No DOMPurify in this repo; we do a conservative string-level scrub:
 * remove <script>, <foreignObject>, event handlers, and external/script URLs.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    // drop script and foreignObject blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    // drop inline event handlers (onload, onclick, ...)
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // neutralize javascript: and external http(s) references in href/xlink:href/src/url()
    .replace(/((?:xlink:)?href|src)\s*=\s*("|')\s*(?:javascript:|https?:|\/\/)[^"']*\2/gi, '$1=$2#$2')
    .replace(/url\(\s*(?:javascript:|https?:|\/\/)[^)]*\)/gi, 'none');
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
