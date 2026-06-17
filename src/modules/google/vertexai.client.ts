// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Client-side orchestration to resolve Gemini/Vertex AI grounding redirect links inside message fragments.

import { apiAsync } from '~/common/util/trpc.client';

import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { getVndGeminiVertexLinks } from '~/common/stores/store-ai';
import { isTextContentFragment, isVoidAnnotationsFragment } from '~/common/stores/chat/chat.fragments';

import { VERTEX_GROUNDING_REDIRECT_PREFIX, VERTEX_GROUNDING_REDIRECT_REGEX } from './vertexai.types';


// configuration
const MAX_URLS_PER_CALL = 64; // mirrors the server-side input limit
const DEFAULT_TIMEOUT_MS = 5000; // generation pipelines (chat, Beam) are never blocked longer than this


export interface VertexLinksResolution {
  /** Same array shape as the input; changed fragments are new objects with the same fId. */
  newFragments: DMessageFragment[];
  /** Only the fragments that changed, for per-fragment store replacement. */
  changedFragments: { fragmentId: DMessageFragmentId; newFragment: DMessageFragment }[];
}


/** Counts the unique unresolved redirect links in a message's fragments (text parts + citation annotations). */
export function vertexLinksCountInFragments(fragments: readonly DMessageFragment[]): number {
  return _collectRedirectUrls(fragments).size;
}


/**
 * Policy-gated auto-resolution for the generation pipelines (chat, Beam rays, Beam merges, reattach):
 * no-op unless the 'Vertex AI Links' policy is 'resolve'.
 * Returns the rewritten fragments array, or null to keep the originals.
 */
export async function vertexLinksAutoResolveFragments<TFragment extends DMessageFragment>(fragments: readonly TFragment[]): Promise<TFragment[] | null> {
  if (getVndGeminiVertexLinks() !== 'resolve') return null;
  const resolution = await vertexLinksResolveFragments(fragments);
  // cast: the rewrite preserves each fragment's kind, only URL strings change
  return resolution ? resolution.newFragments as TFragment[] : null;
}


/**
 * Resolves all Vertex AI grounding redirect links found in the given fragments, rewriting both
 * in-text markdown links and citation annotation URLs to their real destinations.
 *
 * Never throws. Returns null when there is nothing to do or the resolution failed/timed out -
 * callers proceed with the original fragments (links that fail stay as-is and remain detectable).
 * Idempotent by construction: resolved links no longer match the redirect pattern.
 */
export async function vertexLinksResolveFragments(fragments: readonly DMessageFragment[], timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<VertexLinksResolution | null> {

  const redirectUrls = Array.from(_collectRedirectUrls(fragments));
  if (!redirectUrls.length) return null;

  // batch-resolve on the server - the redirect host sends no CORS headers, so the browser cannot follow the 302s itself
  const resolvedMap = new Map<string, string>();
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < redirectUrls.length; i += MAX_URLS_PER_CALL)
      chunks.push(redirectUrls.slice(i, i + MAX_URLS_PER_CALL));
    const responses = await Promise.all(chunks.map(urls =>
      apiAsync.googleSearch.resolveGroundingRedirects.mutate({ urls }, { signal: timeoutController.signal }),
    ));
    for (const { resolutions } of responses)
      for (const { url, resolved } of resolutions)
        if (resolved)
          resolvedMap.set(url, resolved);
  } catch (error) {
    console.warn('[DEV] vertexLinksResolveFragments: resolution failed', { error });
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!resolvedMap.size) return null;

  // rewrite the fragments - new objects (same fId) only where something changed
  const changedFragments: VertexLinksResolution['changedFragments'] = [];
  const newFragments = fragments.map((fragment): DMessageFragment => {

    // in-text markdown links: swap each redirect URL for its destination, leaving labels and the rest of the text intact
    if (isTextContentFragment(fragment)) {
      const newText = fragment.part.text.replace(VERTEX_GROUNDING_REDIRECT_REGEX, (url) => resolvedMap.get(url) || url);
      if (newText === fragment.part.text) return fragment;
      const newFragment: DMessageFragment = { ...fragment, part: { ...fragment.part, text: newText } };
      changedFragments.push({ fragmentId: fragment.fId, newFragment });
      return newFragment;
    }

    // citation annotations: swap the url, keep title/refNumber/ranges
    if (isVoidAnnotationsFragment(fragment)) {
      let anyChanged = false;
      const annotations = fragment.part.annotations.map(annotation => {
        const resolved = resolvedMap.get(annotation.url);
        if (!resolved) return annotation;
        anyChanged = true;
        return { ...annotation, url: resolved };
      });
      if (!anyChanged) return fragment;
      const newFragment: DMessageFragment = { ...fragment, part: { ...fragment.part, annotations } };
      changedFragments.push({ fragmentId: fragment.fId, newFragment });
      return newFragment;
    }

    return fragment;
  });

  return { newFragments, changedFragments };
}


function _collectRedirectUrls(fragments: readonly DMessageFragment[]): Set<string> {
  const urls = new Set<string>();
  for (const fragment of fragments) {
    if (isTextContentFragment(fragment)) {
      // fast-path the common (no-link) case: a literal substring check before the regex walk
      if (!fragment.part.text.includes('vertexaisearch')) continue;
      for (const match of fragment.part.text.matchAll(VERTEX_GROUNDING_REDIRECT_REGEX))
        urls.add(match[0]);
    } else if (isVoidAnnotationsFragment(fragment)) {
      for (const annotation of fragment.part.annotations)
        if (annotation.url.startsWith(VERTEX_GROUNDING_REDIRECT_PREFIX))
          urls.add(annotation.url);
    }
  }
  return urls;
}
