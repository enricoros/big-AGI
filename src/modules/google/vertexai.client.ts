// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Resolves Gemini/Vertex AI grounding redirect links through the server, the only side that can read the redirects (the
// host sends no CORS headers), and rewrites them in place in text parts and citations.

import { apiAsync } from '~/common/util/trpc.client';
import { delayOrAbort } from '~/common/util/abortUtils';

import { DMessageFragment, isTextContentFragment, isVoidAnnotationsFragment, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';

import type { VertexLinkResolution, VertexLinkUnresolved } from './vertexai.types';
import { VERTEX_GROUNDING_REDIRECT_PREFIX, VERTEX_GROUNDING_REDIRECT_REGEX } from './vertexai.types';


// configuration: a complete link answers in 0.2s or not at all, so a fresh attempt recovers it, not a longer wait
const MAX_URLS_PER_CALL = 16; // a quarter of the server limit: more calls in parallel, shorter connection queue per call
const ROUNDS = [ // each round asks again for the links still unknown; about 7s at worst, one round trip when all answer
  { delayMs: 0, deadlineMs: 2000 },
  { delayMs: 250, deadlineMs: 2000 },
  { delayMs: 1000, deadlineMs: 2000 },
];
const CALL_MARGIN_MS = 1000; // past the server deadline, for a lost call

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
 */
export async function vertexLinksResolveFragments(fragments: readonly DMessageFragment[], signal?: AbortSignal) {
  const { destinations, unresolved } = await vertexLinksResolveUrls(vertexLinksInFragments(fragments), signal);
  const rewritten = !destinations.size ? [] : fragments.flatMap(fragment => _rewriteFragment(fragment, destinations) ?? []);
  return { rewritten, unresolved };
}

/** Resolves redirect links in rounds, each asking again for the links still unknown. Never throws; logs why links stay unresolved. */
export async function vertexLinksResolveUrls(urls: Iterable<string>, signal?: AbortSignal) {
  const destinations = new Map<string, string>();
  const unresolved = new Map<string, VertexLinkUnresolved>();
  for (const url of urls) {
    const destination = _sessionDestinations.get(url);
    if (destination) destinations.set(url, destination);
    else unresolved.set(url, { url, outcome: 'unknown', reason: 'not asked' });
  }

  for (const { delayMs, deadlineMs } of ROUNDS) {
    const pending = [...unresolved.values()].filter(({ outcome }) => outcome === 'unknown').map(({ url }) => url);
    if (!pending.length || await delayOrAbort(delayMs, signal) === 'aborted') break;
    for (const answer of await _askServer(pending, deadlineMs, signal)) {
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

/** Asks in parallel chunks under one deadline. Every url gets an answer: a failed call answers 'unknown' for its chunk, with why. */
async function _askServer(urls: string[], deadlineMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, deadlineMs + CALL_MARGIN_MS);
  signal?.addEventListener('abort', abort);
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += MAX_URLS_PER_CALL)
      chunks.push(urls.slice(i, i + MAX_URLS_PER_CALL));
    const answers = await Promise.all(chunks.map(chunk =>
      apiAsync.googleSearch.resolveGroundingRedirects.mutate({ urls: chunk, deadlineMs }, { signal: controller.signal })
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
