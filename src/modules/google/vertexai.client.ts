// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Client-side orchestration to resolve Gemini/Vertex AI grounding redirect links.
//
// The server only reads destinations (the redirect host sends no CORS headers, so a browser cannot). This module asks in
// rounds for what is still unknown, remembers the answers for the session, and writes destinations into the citations,
// never into the text the model produced: Gemini signs text parts (thoughtSignature on Argon's last text part, measured
// 2026-11-04) and a signed part must replay byte-identical (#1270).

import { apiAsync } from '~/common/util/trpc.client';

import type { DMessageFragmentId, DVoidFragmentModelAnnotations } from '~/common/stores/chat/chat.fragments';
import type { Immutable } from '~/common/types/immutable.types';

import type { VertexLinkResolution } from './vertexai.types';
import { VERTEX_GROUNDING_REDIRECT_PREFIX } from './vertexai.types';


// configuration
const MAX_URLS_PER_CALL = 32; // half the server limit (64): two calls in parallel keep each invocation's queue short
const ROUNDS = [ // each round asks only for what is still unknown; a generation awaits them all, the chip runs them again on click
  { delayMs: 0, deadlineMs: 3000 },
  { delayMs: 1000, deadlineMs: 4000 },
  { delayMs: 3000, deadlineMs: 4000 },
] as const;
const CALL_MARGIN_MS = 1500; // past the server deadline; the server has answered with partials by then, so this only covers a lost connection
const EXPIRED_LINK_RECHECK_MS = 10 * 60 * 1000; // an expired link is not asked again before this


// answers outlive the message: shared by the live search tooltips, the completion pass and the chip
const _sessionCache = new Map<string, { destination: string } | { expiredUntil: number }>();

interface _ResolveOptions {
  maxRounds?: number;
  signal?: AbortSignal; // cancels the server calls, e.g. a superseded display query
}

interface _LinksResolution {
  resolved: Map<string, string>;  // redirect url -> destination
  expired: Set<string>;           // no redirect anymore
  unknown: Set<string>;           // no answer within the rounds
}


export const vertexAILinks = {

  /** Redirect links in the citations fragments without a destination yet. */
  unresolvedUrls(citations: Immutable<DVoidFragmentModelAnnotations[]>) {
    const urls = new Set<string>();
    for (const { part } of citations)
      for (const { url, resolvedUrl } of part.annotations)
        if (!resolvedUrl && url.startsWith(VERTEX_GROUNDING_REDIRECT_PREFIX))
          urls.add(url);
    return urls;
  },

  /**
   * Resolves the redirect links of citations fragments: one set of rounds for all their unknown links, then each fragment
   * that gained destinations is rebuilt under its fId, the text untouched. `replacements` holds the rebuilt fragments only.
   */
  async resolveCitations(citations: readonly DVoidFragmentModelAnnotations[], options: _ResolveOptions = {}): Promise<{ replacements: Map<DMessageFragmentId, DVoidFragmentModelAnnotations>, resolution: _LinksResolution }> {
    const resolution = await vertexAILinks.resolveUrls(vertexAILinks.unresolvedUrls(citations), options);
    const replacements = new Map<DMessageFragmentId, DVoidFragmentModelAnnotations>();
    for (const fragment of citations) {
      const replacement = _applyResolutionsToCitationsFragment(fragment, resolution.resolved);
      if (replacement !== fragment) replacements.set(fragment.fId, replacement);
    }
    return { replacements, resolution };
  },

  /**
   * Resolves redirect links in rounds: each round asks the server only for what is still unknown, with one deadline per
   * call, and stops when a round makes no progress, a systemic failure another round would repeat.
   * Never throws. Destinations the session already knows come back without a round.
   */
  async resolveUrls(redirectUrls: Iterable<string>, options: _ResolveOptions = {}): Promise<_LinksResolution> {
    const now = Date.now();

    // initialize from the cache
    const resolution: _LinksResolution = { resolved: new Map(), expired: new Set(), unknown: new Set() };
    for (const url of redirectUrls) {
      const cached = _sessionCache.get(url);
      if (cached && 'destination' in cached) resolution.resolved.set(url, cached.destination);
      else if (cached && cached.expiredUntil > now) resolution.expired.add(url);
      else resolution.unknown.add(url);
    }

    for (const { delayMs, deadlineMs } of ROUNDS.slice(0, options.maxRounds ?? ROUNDS.length)) {
      if (!resolution.unknown.size || options.signal?.aborted) break;
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));

      let progressed = false;
      for (const answer of await _askServerBatched([...resolution.unknown], MAX_URLS_PER_CALL, deadlineMs, options.signal)) {
        if (answer.outcome === 'resolved') {
          resolution.resolved.set(answer.url, answer.resolved);
          _sessionCache.set(answer.url, { destination: answer.resolved });
        } else if (answer.outcome === 'dead') {
          resolution.expired.add(answer.url);
          _sessionCache.set(answer.url, { expiredUntil: Date.now() + EXPIRED_LINK_RECHECK_MS });
        } else
          continue;
        resolution.unknown.delete(answer.url);
        progressed = true;
      }
      if (!progressed) break;
    }

    return resolution;
  },

};


function _applyResolutionsToCitationsFragment(fragment: Immutable<DVoidFragmentModelAnnotations>, resolvedMap: _LinksResolution['resolved']): Immutable<DVoidFragmentModelAnnotations> {
  let changed = false;
  const annotations = fragment.part.annotations.map(citation => {
    const destination = resolvedMap.get(citation.url);
    if (!destination || citation.resolvedUrl === destination) return citation;
    changed = true;
    return { ...citation, resolvedUrl: destination };
  });
  return changed ? { ...fragment, part: { ...fragment.part, annotations } } : fragment;
}

async function _askServerBatched(urls: readonly string[], chunkSize: number, deadlineMs: number, signal?: AbortSignal): Promise<VertexLinkResolution[]> {
  // join the signal with a timeout
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, deadlineMs + CALL_MARGIN_MS);
  signal?.addEventListener('abort', abort, { once: true });

  try {
    // create chunks
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += chunkSize)
      chunks.push(urls.slice(i, i + chunkSize));

    // parallelize chunks
    const calls = await Promise.allSettled(chunks.map(chunk =>
      apiAsync.googleSearch.resolveGroundingRedirects.mutate({ urls: chunk, deadlineMs }, { signal: controller.signal }),
    ));

    return calls.flatMap(call => call.status === 'fulfilled' ? call.value.resolutions : [] /* a lost chunk stays unknown */);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
