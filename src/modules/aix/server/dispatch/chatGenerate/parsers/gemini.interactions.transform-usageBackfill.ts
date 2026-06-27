import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { geminiAccess, GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParticleTransformFunction } from '../chatGenerate.dispatch';
import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';
import { geminiInteractionsUsageToTokenMetrics } from './gemini.interactions.parser';


/**
 * [2026-06-26, Interactions BUG] Gemini Interactions (Deep Research) token-usage backfill transform.
 * See Github #1143
 *
 * WHY: the LIVE `interaction.completed` SSE event is a deliberately reduced payload that OMITS the
 * `usage` block (verified empirically + documented as "empty outputs to reduce payload size"). Google
 * populates `usage` on the stored interaction resource a moment after completion, so a follow-up GET
 * (the same source the "Recover" button reads) returns the full token counts. Without this, a perfectly
 * successful Deep Research run lands with zero token/cost metrics (only the local runtime).
 *
 * WHAT: a 1:1 particle transform (see `anthropic.transform-fileInline.ts` for the pattern) that:
 *  1. captures the interaction id from the `set-upstream-handle` particle (Deep Research only),
 *  2. on the terminal `set-metrics` particle, IF token counts are missing, fires ONE GET of the stored
 *     interaction, maps its `usage` to token metrics, and MERGES them into the metrics particle
 *     (the live-measured timing in that same particle is preserved). `vTOutInner` is derived from the
 *     live `dtInner` + the freshly-fetched output tokens.
 *
 * SCOPE: wired ONLY on the first/original streaming POST dispatch - NOT on reattach/resume/recover
 * (those read the stored resource directly via GET/SSE-replay, which already carries `usage`).
 *
 * Runs on BOTH the server and the browser/CSF path: the Interactions GET is CORS-open (verified
 * 2026-06-26 - any Origin reflected; `x-goog-api-key` / `x-goog-api-client` / `content-type` all pass
 * preflight; the CSF `?key=` form too. Only `api-revision` stays rejected, which we never send here).
 * On CSF, `geminiAccess` builds the query-param form, so no custom request header is involved.
 *
 * Resilience: any fetch/parse error is caught by the executor's transform safety net, which passes the
 * original (timing-only) particle through unchanged - so a transient GET failure or a future CORS
 * regression degrades gracefully to runtime-only metrics.
 */
export function createGeminiInteractionsUsageBackfillTransform(access: GeminiAccessSchema): ChatGenerateParticleTransformFunction {

  let interactionId: string | null = null;
  let cachedTokenMetrics: Pick<AixWire_Particles.CGSelectMetrics, 'TIn' | 'TCacheRead' | 'TOut' | 'TOutR'> | null = null;
  let attempted = false;

  // NOT csfUnsafe: the Interactions GET is CORS-open (see header doc above), so this runs on CSF too -
  // browser->Google direct, no server round-trip. A future CORS regression is caught by the safety net.
  return async (particle) => {

    // only interested in control ops
    if (!('cg' in particle)) return particle;

    // capture the Deep Research interaction id - Antigravity never emits a handle, so it self-excludes
    if (particle.cg === 'set-upstream-handle') {
      if (particle.handle.uht === 'vnd.gem.interactions')
        interactionId = particle.handle.runId;
      return particle;
    }

    // enrich the terminal metrics particle with backfilled token counts
    if (particle.cg !== 'set-metrics') return particle;

    const m = particle.metrics;

    // already have tokens (e.g. a future live event, or non-DR path) -> nothing to backfill
    if (m.TIn !== undefined || m.TOut !== undefined) return particle;
    if (!interactionId) return particle;

    // one-shot GET of the stored interaction (the field-mask API rejects subsets, so this pulls the
    // full resource and we keep only `usage` - there is no lighter retrieval today)
    if (!cachedTokenMetrics && !attempted) {
      attempted = true;
      const { url, headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.getPath(interactionId), false);
      const resource = await fetchJsonOrTRPCThrow<{ usage?: Parameters<typeof geminiInteractionsUsageToTokenMetrics>[0] }>({ url, headers, name: 'Aix.Gemini.Interactions.usageBackfill', throwWithoutName: true });
      cachedTokenMetrics = geminiInteractionsUsageToTokenMetrics(resource?.usage);
    }
    if (!cachedTokenMetrics) return particle;

    // merge tokens into the live timing; derive velocity from the live inner-time + fetched output
    const merged: AixWire_Particles.CGSelectMetrics = { ...m, ...cachedTokenMetrics };
    if (merged.dtInner && merged.TOut)
      merged.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * merged.TOut / merged.dtInner) / 100;
    return { cg: 'set-metrics', metrics: merged };
  };
}
