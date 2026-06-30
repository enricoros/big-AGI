/**
 * Live SVG Animator - the forever-loop controller.
 *
 * Reuses the inventoried building blocks:
 * - inference: aixChatGenerateContent_DMessage_orThrow (programmatic, multimodal)
 * - multimodal: inline_image wire part (raw base64 via convert_Blob_To_Base64)
 * - read-back: messageFragmentsReduceText
 * - raster: renderSVGToPNGBlob(..., fixedOutputSize)
 *
 * One step: drain steers -> build context -> single inference -> extract <svg> (repair up to 2x)
 * -> enforce 512 + sanitize -> rasterize 512x512 PNG -> push bounded frame. Loops until Stop.
 */

import { aixChatGenerateContent_DMessage_orThrow, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';
import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';

import { LLM_IF_OAI_Vision, type DLLMId } from '~/common/stores/llms/llms.types';
import type { DMetricsChatGenerate_Md } from '~/common/stores/metrics/metrics.chatgenerate';
import { llmsStoreState } from '~/common/stores/llms/store-llms';
import { convert_Blob_To_Base64 } from '~/common/util/blobUtils';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { renderSVGToPNGBlob } from '~/common/util/imageUtils';

import { LIVESVG_FRAME_SIZE, LIVESVG_MAX_IMAGES, LIVESVG_PNG_SIZE, LIVESVG_REPAIR_ATTEMPTS, type HistoryItem } from './livesvg.types';
import { enforceSvg512, extractAllSvgs, extractSvg, sanitizeSvg } from './livesvg.svgutils';
import { liveSvgActions } from './store-livesvg';


type ChatMessage = AixAPIChatGenerate_Request['chatSequence'][number];

function buildSystemPrompt(framesPerCall: number): string {
  const single = framesPerCall <= 1;
  return `You are a real-time SVG animation engine. Each turn, you emit the NEXT ${single ? 'frame' : `${framesPerCall} frames`} of an ongoing animation.

Hard rules:
- Output ONLY ${single ? 'one complete, valid SVG document' : `exactly ${framesPerCall} complete, valid SVG documents, in chronological order (one per frame), back-to-back with nothing between them`}. No markdown, no code fences, no commentary.
- Each SVG MUST be exactly ${LIVESVG_FRAME_SIZE}x${LIVESVG_FRAME_SIZE}: include width="${LIVESVG_FRAME_SIZE}" height="${LIVESVG_FRAME_SIZE}" and viewBox="0 0 ${LIVESVG_FRAME_SIZE} ${LIVESVG_FRAME_SIZE}".
- Advance the motion by about 0.5 seconds${single ? ' from the previous frame' : ' per frame (each frame ~0.5s after the one before it)'}: a clearly visible step that keeps motion smooth. Preserve the identity, position continuity, palette, and style of existing elements.
- Honor every [live] spoken direction for this and all future frames.
- The transcript is the animation so far; a <system-information>removed N frames here</system-information> note means N earlier frames elapsed and were dropped - treat it as elapsed time, never a reset.
- Self-contained only: no <script>, no <foreignObject>, no event handlers, no external URLs or images. Use shapes, paths, gradients, and inline styles.`;
}


/** Merge consecutive same-role messages so the wire sequence always alternates user/model. */
function coalesceRoles(seq: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of seq) {
    const last = out[out.length - 1];
    if (last && last.role === m.role)
      last.parts = [...last.parts, ...m.parts] as typeof last.parts;
    else
      out.push({ role: m.role, parts: [...m.parts] } as ChatMessage);
  }
  return out;
}


function buildRequest(prompt: string, plan: string, history: HistoryItem[], attachImages: boolean, framesPerCall: number): AixAPIChatGenerate_Request {
  const seq: ChatMessage[] = [];

  // leading brief: prompt + plan
  const frameCount = history.reduce((n, h) => n + (h.kind === 'frame' ? 1 : 0), 0);
  const intro: string[] = [`Animation brief: ${prompt || '(none)'}`];
  if (plan) intro.push(`Plan: ${plan}`);
  intro.push(frameCount ? 'The animation so far (chronological transcript: your past frames as SVG + rendered PNG, and any live directions) follows.' : 'No frames yet - create the FIRST frame.');
  seq.push({ role: 'user', parts: [{ pt: 'text', text: intro.join('\n') }] });

  // map the incrementally-managed history transcript: user/system text -> user turns, frames -> model turns.
  // The PNG image is attached only for the most recent LIVESVG_MAX_IMAGES frames (provider caps images; >5 => HTTP 413).
  const imageFromIdx = Math.max(0, frameCount - LIVESVG_MAX_IMAGES);
  let frameSeen = 0;
  for (const item of history) {
    if (item.kind === 'user') {
      seq.push({ role: 'user', parts: [{ pt: 'text', text: item.text }] });
    } else if (item.kind === 'system') {
      seq.push({ role: 'user', parts: [{ pt: 'text', text: `<system-information>removed ${item.removed} frames here</system-information>` }] });
    } else {
      const withImage = attachImages && item.pngBase64 && frameSeen >= imageFromIdx;
      seq.push({
        role: 'model',
        parts: withImage
          ? [{ pt: 'text', text: item.svg }, { pt: 'inline_image', mimeType: 'image/png', base64: item.pngBase64 }]
          : [{ pt: 'text', text: item.svg }],
      });
      frameSeen++;
    }
  }

  // final emit instruction
  seq.push({ role: 'user', parts: [{ pt: 'text', text: framesPerCall <= 1
    ? `Emit the NEXT frame now. Return ONLY one complete, valid ${LIVESVG_FRAME_SIZE}x${LIVESVG_FRAME_SIZE} <svg>...</svg> advancing the animation ~0.5 seconds, preserving identity.`
    : `Emit the NEXT ${framesPerCall} frames now, in order. Return ONLY ${framesPerCall} complete, valid ${LIVESVG_FRAME_SIZE}x${LIVESVG_FRAME_SIZE} <svg>...</svg> documents back-to-back (no text between them), each ~0.5 seconds after the previous, preserving identity.` }] });

  return { systemMessage: { parts: [{ pt: 'text', text: buildSystemPrompt(framesPerCall) }] }, chatSequence: coalesceRoles(seq) };
}


/** Single inference with up to LIVESVG_REPAIR_ATTEMPTS extra tries when no valid <svg> is returned. */
async function generateFrameText(llmId: DLLMId, baseReq: AixAPIChatGenerate_Request, abortSignal: AbortSignal): Promise<{ text: string; metrics?: DMetricsChatGenerate_Md } | null> {
  const ctx = aixCreateChatGenerateContext('_DEV_', 'live-svg');
  let req = baseReq;
  for (let attempt = 0; attempt <= LIVESVG_REPAIR_ATTEMPTS; attempt++) {
    if (abortSignal.aborted) return null;
    const res = await aixChatGenerateContent_DMessage_orThrow(llmId, req, ctx, false, { abortSignal });
    if (res.outcome !== 'completed') return null;
    const text = messageFragmentsReduceText(res.fragments, '', false);
    if (extractSvg(text)) return { text, metrics: res.generator?.metrics };
    // repair: show the invalid output and ask again, stricter
    req = {
      ...baseReq,
      chatSequence: coalesceRoles([
        ...baseReq.chatSequence,
        { role: 'model', parts: [{ pt: 'text', text: text.slice(0, 2000) }] },
        { role: 'user', parts: [{ pt: 'text', text: `That was not a valid SVG. Return ONLY one complete, valid ${LIVESVG_FRAME_SIZE}x${LIVESVG_FRAME_SIZE} <svg ...>...</svg> document and nothing else.` }] },
      ]),
    };
  }
  return null;
}


/** Resolves after `ms`, or immediately when aborted. */
function abortableDelay(ms: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (ms <= 0 || abortSignal.aborted) return resolve();
    const onAbort = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { abortSignal.removeEventListener('abort', onAbort); resolve(); }, ms);
    abortSignal.addEventListener('abort', onAbort, { once: true });
  });
}


/**
 * Run the live loop FOREVER - until the user stops it (status leaves 'running') or the signal aborts.
 * A single failed/empty/throwing iteration NEVER stops the loop: it is recorded as a transient error
 * and retried (with backoff). Only Stop/Exit ends it. Sets status back to 'idle' on exit.
 * Started by the UI component, which owns the AbortController (and the mic).
 */
export async function runLiveSvgLoop(llmId: DLLMId, abortSignal: AbortSignal): Promise<void> {
  let lastTs = performance.now();
  let consecutiveFailures = 0;

  // only attach PNG image inputs if the selected model accepts images (else feed SVG text only)
  const selLlm = llmsStoreState().llms.find((l) => l.id === llmId);
  const attachImages = !selLlm || selLlm.interfaces.includes(LLM_IF_OAI_Vision);

  const onFailure = async (message: string) => {
    consecutiveFailures++;
    liveSvgActions()._setError(message);
    liveSvgActions().pushLog('error', message);
    // backoff to avoid hammering on a persistent error (e.g. rate limit), capped at 5s; abortable
    await abortableDelay(Math.min(5000, 500 * consecutiveFailures), abortSignal);
  };

  liveSvgActions().pushLog('info', `▶ started · ${selLlm?.label ?? llmId}${attachImages ? '' : ' (text-only)'}`);

  while (!abortSignal.aborted && liveSvgActions().status === 'running') {
    try {

      const A = liveSvgActions();
      const { prompt, plan, framesPerCall } = A;

      // drain spoken steers and append them as user text at the END of the history (preserved forever),
      // so the next frame is generated with them in context
      const steers = A.takeSteers(Date.now());
      for (const s of steers)
        A.appendUserText(`[live] ${s.text}`);

      const baseReq = buildRequest(prompt, plan, liveSvgActions().history, attachImages, framesPerCall);
      const genT0 = performance.now();
      const gen = await generateFrameText(llmId, baseReq, abortSignal);
      const genWallMs = performance.now() - genT0;
      if (abortSignal.aborted || liveSvgActions().status !== 'running') break;
      if (gen === null) { await onFailure('Frame generation failed - retrying…'); continue; }

      // extract up to `framesPerCall` SVGs from the single response
      const svgs = extractAllSvgs(gen.text).slice(0, Math.max(1, framesPerCall));
      if (!svgs.length) { await onFailure('Model did not return a valid SVG - retrying…'); continue; }

      // success: clear any transient error and reset the failure backoff
      consecutiveFailures = 0;
      if (liveSvgActions().error) liveSvgActions()._setError(null);

      // process each returned frame: sanitize -> enforce 512 -> rasterize 512 PNG -> push bounded
      let pushed = 0;
      for (let k = 0; k < svgs.length; k++) {
        if (abortSignal.aborted) break;
        const svg = sanitizeSvg(enforceSvg512(svgs[k]));
        let pngBase64 = '';
        try {
          const blob = await renderSVGToPNGBlob(svg, false, 1, LIVESVG_PNG_SIZE);
          if (blob) pngBase64 = await convert_Blob_To_Base64(blob, 'live-svg');
        } catch (e) {
          // keep the SVG frame even if rasterization fails (UI still renders the SVG)
        }
        const index = liveSvgActions().currentFrameIndex;
        liveSvgActions().appendFrame({ index, svg, pngBase64 });
        pushed++;
      }
      if (abortSignal.aborted) break;

      // smoothed frames/sec, over the `pushed` frames produced by this call
      const now = performance.now();
      const inst = (1000 * Math.max(1, pushed)) / Math.max(1, now - lastTs);
      lastTs = now;
      const prevFps = liveSvgActions().fps;
      liveSvgActions()._setFps(prevFps ? prevFps * 0.7 + inst * 0.3 : inst);

      // record per-call token throughput (prefer server-reported metrics, fall back to wall-clock)
      const m = gen.metrics;
      const tokensOut = m?.TOut ?? 0;
      const tokensIn = (m?.TIn ?? 0) + (m?.TCacheRead ?? 0) + (m?.TCacheWrite ?? 0);
      const genMs = (m?.dtAll && m.dtAll > 0) ? m.dtAll : genWallMs;
      const tps = (m?.vTOutInner && m.vTOutInner > 0) ? m.vTOutInner
        : (tokensOut > 0 && genMs > 0) ? tokensOut / (genMs / 1000)
          : 0;
      liveSvgActions().recordGenStat({ tps, tokensIn, tokensOut, ms: genMs });
      liveSvgActions().pushLog('info', `call · ${pushed} frame${pushed === 1 ? '' : 's'} · ${tokensOut} tok · ${tps.toFixed(0)} tok/s`);

      // pace generations (rate-friendly, user-adjustable); abortable so Stop stays responsive
      await abortableDelay(liveSvgActions().frameDelayMs, abortSignal);

    } catch (e: any) {
      // never let a single iteration kill the loop - record and retry
      if (abortSignal.aborted) break;
      await onFailure(e?.message || 'Frame failed - retrying…');
    }
  }

  liveSvgActions().pushLog('info', '■ stopped');
  liveSvgActions()._setStatus('idle');
}
