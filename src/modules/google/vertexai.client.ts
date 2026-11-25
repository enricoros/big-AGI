// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Resolves Gemini/Vertex AI grounding redirect links through the server, the only side that can read the redirects (the
// host sends no CORS headers), and rewrites them in place in text parts and citations.

import type { MaybePromise } from '~/common/types/useful.types';
import { apiAsync } from '~/common/util/trpc.client';
import { delayOrAbort } from '~/common/util/abortUtils';

import { createPlaceholderVoidFragment, DMessageFragment, DMessageVoidFragment, isTextContentFragment, isVoidAnnotationsFragment, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';

import type { VertexLinkResolution, VertexLinkUnresolved } from './vertexai.types';
import { VERTEX_GROUNDING_REDIRECT_PREFIX, VERTEX_GROUNDING_REDIRECT_REGEX } from './vertexai.types';


// configuration: the vendor answers a link in about 0.2s; what fails is the way there and back (a dropped server fetch, an
// answer reaching the browser past the call cutoff), and both clear on a later round
const MAX_URLS_PER_CALL = 16; // a quarter of the server limit: more calls in parallel, shorter connection queue per call
const SERVER_DEADLINE_MS = 2000; // the server answers by then, 'unknown' for the links still waiting
const CALL_CUTOFF_MS = 8000; // a call without an answer by then is lost; in production a burst's answer took 4.2s from arrival
const RETRY_DELAYS_MS = [1000, 5000]; // before each round for the links still unknown, the last one repeating
const RESOLVE_BUDGET_MS = 60_000; // no round starts that could end later: one round trip when all answer (#1270)

const _sessionDestinations = new Map<string, string>(); // shared by the live tooltips, the completion pass and the chip


/** Unique redirect links in text parts and citations. */
export function vertexLinksInFragments(fragments: readonly DMessageFragment[]) {
  const urls = new Set<string>();
  for (const fragment of fragments) {
    if (isTextContentFragment(fragment)) {
      for (const [url] of fragment.part.text.matchAll(VERTEX_GROUNDING_REDIRECT_REGEX))
        urls.add(url);
    } else if (isVoidAnnotationsFragment(fragment)) {
      for (const { url } of fragment.part.annotations)
        if (url.startsWith(VERTEX_GROUNDING_REDIRECT_PREFIX))
          urls.add(url);
    }
  }
  return urls;
}

/**
 * Resolves the redirect links of the fragments and returns the fragments it rewrote, under their fIds. Rewritten text loses
 * its vendor state, as an edit does: signatures cover the original. A rewritten citation keeps its redirect in vndGemVertexUrl.
 * Idempotent: a rewritten link no longer matches; a link that fails stays as it was, for the chip to retry.
 * While links are retried, onProgress gets a placeholder to show after the fragments: one fId across rounds, the count updated.
 */
export async function vertexLinksResolveFragments(fragments: readonly DMessageFragment[], signal?: AbortSignal, onProgress?: (placeholder: DMessageVoidFragment) => MaybePromise<void>) {
  let placeholder: DMessageVoidFragment | undefined;
  const onRetry = onProgress && ((pendingCount: number) => {
    const next = createPlaceholderVoidFragment(`Resolving ${pendingCount} Vertex AI link${pendingCount !== 1 ? 's' : ''}...`);
    return onProgress(placeholder = placeholder ? { ...next, fId: placeholder.fId } : next);
  });
  const { destinations, unresolved } = await vertexLinksResolveUrls(vertexLinksInFragments(fragments), signal, onRetry);
  const rewritten = !destinations.size ? [] : fragments.flatMap(fragment => _rewriteFragment(fragment, destinations) ?? []);
  return { rewritten, unresolved };
}

/**
 * Resolves redirect links in rounds, each asking again for the links still unknown, for up to a minute. Throws only what onRetry
 * throws; logs why links stay unresolved. onRetry is awaited before each retry round with the count still unknown: never called
 * when the first round answers every link.
 */
export async function vertexLinksResolveUrls(urls: Iterable<string>, signal?: AbortSignal, onRetry?: (pendingCount: number) => MaybePromise<void>) {
  const destinations = new Map<string, string>();
  const unresolved = new Map<string, VertexLinkUnresolved>();
  for (const url of urls) {
    const destination = _sessionDestinations.get(url);
    if (destination) destinations.set(url, destination);
    else unresolved.set(url, { url, outcome: 'unknown', reason: 'not asked' });
  }

  const startMs = Date.now();
  for (let round = 0; ; round++) {
    const pending = [...unresolved.values()].filter(({ outcome }) => outcome === 'unknown').map(({ url }) => url);
    const delayMs = !round ? 0 : RETRY_DELAYS_MS[Math.min(round, RETRY_DELAYS_MS.length) - 1];
    if (!pending.length || Date.now() - startMs + delayMs + CALL_CUTOFF_MS > RESOLVE_BUDGET_MS) break;
    if (round && !signal?.aborted) await onRetry?.(pending.length);
    if (await delayOrAbort(delayMs, signal) === 'aborted') break;
    for (const answer of await _askServer(pending, signal)) {
      if (answer.outcome !== 'resolved') {
        unresolved.set(answer.url, answer);
        continue;
      }
      destinations.set(answer.url, answer.resolved);
      _sessionDestinations.set(answer.url, answer.resolved);
      unresolved.delete(answer.url);
    }
  }

  if (unresolved.size && !signal?.aborted)
    console.warn(`[Vertex AI links] ${unresolved.size} of ${destinations.size + unresolved.size} unresolved:`, [...unresolved.values()]);
  return { destinations, unresolved };
}


function _rewriteFragment(fragment: DMessageFragment, destinations: ReadonlyMap<string, string>) {
  if (isTextContentFragment(fragment)) {
    const text = fragment.part.text.replace(VERTEX_GROUNDING_REDIRECT_REGEX, url => destinations.get(url) ?? url);
    return text === fragment.part.text ? null : updateFragmentWithEditedText(fragment, text);
  }
  if (isVoidAnnotationsFragment(fragment) && fragment.part.annotations.some(({ url }) => destinations.has(url)))
    return {
      ...fragment,
      part: {
        ...fragment.part,
        annotations: fragment.part.annotations.map(citation => {
          const destination = destinations.get(citation.url);
          return !destination ? citation : { ...citation, url: destination, vndGemVertexUrl: citation.url };
        }),
      },
    };
  return null;
}

/** Asks in parallel chunks under one cutoff. Every url gets an answer: a failed call answers 'unknown' for its chunk, with why. */
async function _askServer(urls: string[], signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, CALL_CUTOFF_MS);
  signal?.addEventListener('abort', abort);
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += MAX_URLS_PER_CALL)
      chunks.push(urls.slice(i, i + MAX_URLS_PER_CALL));
    const answers = await Promise.all(chunks.map(chunk =>
      apiAsync.googleSearch.resolveGroundingRedirects.mutate({ urls: chunk, deadlineMs: SERVER_DEADLINE_MS }, { signal: controller.signal })
        .then(({ resolutions }) => resolutions)
        .catch((error): VertexLinkResolution[] => chunk.map(url => ({
          url, outcome: 'unknown',
          reason: signal?.aborted ? 'aborted' : controller.signal.aborted ? 'no answer in time' : `call failed: ${error}`,
        }))),
    ));
    return answers.flat();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
