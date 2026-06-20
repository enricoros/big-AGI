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

/**
 * Outcome of a resolve attempt. 'unresolved' (links present, but the redirect host no longer 302s -
 * typically because the links have aged out; confirmed to expire within ~8-58 days) is deliberately
 * distinct from 'failed' (the resolve request itself errored/timed out - transient, worth a retry).
 */
export type VertexLinksOutcome =
  | { status: 'resolved'; resolution: VertexLinksResolution }
  | { status: 'none' }        // no redirect links present in the fragments
  | { status: 'unresolved' }  // links present, but none could be resolved (likely expired)
  | { status: 'failed' };     // resolve request failed or timed out (transient)


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
  const outcome = await vertexLinksResolveFragments(fragments);
  // cast: the rewrite preserves each fragment's kind, only URL strings change
  return outcome.status === 'resolved' ? outcome.resolution.newFragments as TFragment[] : null;
}


/**
 * Resolves all Vertex AI grounding redirect links found in the given fragments, rewriting both
 * in-text markdown links and citation annotation URLs to their real destinations.
 *
 * Never throws. Reports its outcome via the discriminated VertexLinksOutcome - on anything other
 * than 'resolved' the caller proceeds with the original fragments (links that fail stay as-is and
 * remain detectable). Idempotent by construction: resolved links no longer match the redirect pattern.
 */
export async function vertexLinksResolveFragments(fragments: readonly DMessageFragment[], timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<VertexLinksOutcome> {

  const redirectUrls = Array.from(_collectRedirectUrls(fragments));
  if (!redirectUrls.length) return { status: 'none' };

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
    return { status: 'failed' };
  } finally {
    clearTimeout(timeout);
  }
  // links present but none came back resolved: the redirect host no longer 302s, typically expiry
  if (!resolvedMap.size) return { status: 'unresolved' };

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

  return { status: 'resolved', resolution: { newFragments, changedFragments } };
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
