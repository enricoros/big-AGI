import type * as z from 'zod/v4';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';

import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';
import { geminiConvertPCM2WAV } from './gemini.audioutils';


// Kill-switch: drop url_citation annotations - Deep Research ships opaque grounding-redirect URLs with no titles, and the text already contains a numbered source list.
const DISABLE_CITATIONS = true;


type TInteraction = z.infer<typeof GeminiInteractionsWire_API_Interactions.Interaction_schema>;
type TUsage = NonNullable<TInteraction['usage']>;

type BlockState = {
  kind: 'thought' | 'text' | 'image' | 'other';
  emittedCitationKeys: Set<string>; // `${url}@${start}-${end}` for de-dupe (url_citations can repeat)
};


/**
 * Gemini Interactions API SSE parser (for Deep Research and future agents).
 *
 * The upstream request is sent with `stream=true` and returns `text/event-stream` with events:
 *  - interaction.start / interaction.status_update / interaction.complete  (lifecycle)
 *  - content.start / content.delta / content.stop                          (per-index content blocks)
 *  - error                                                                 (non-fatal, empty payload observed mid-stream)
 *  - done                                                                  (terminator, data: [DONE])
 *
 * The SSE demuxer (`fast-sse`) invokes this parser once per frame with `eventData` (the JSON body)
 * and `eventName` (the `event:` line). We dispatch on the JSON payload's `event_type` field which
 * mirrors the SSE event name - staying resilient if the demuxer drops the event name.
 *
 * Delta variants (content.delta's `delta` payload):
 *  - thought_summary  -> `pt.appendReasoningText(delta.content.text)`
 *  - text             -> `pt.appendText(delta.text)`
 *  - text_annotation  -> `pt.appendUrlCitation(...)` for each url_citation (if `DISABLE_CITATIONS` is false)
 *  - image            -> `pt.appendImageInline(...)` (forward-looking; not observed in captures yet)
 *
 * Resume: GET /v1beta/interactions/{id}?stream=true[&last_event_id=<cursor>] - Gemini replays from
 * the cursor (or from start if omitted). Our parser is position-idempotent within a single run
 * because the transmitter's state carries across events.
 */
export function createGeminiInteractionsParser(requestedModelName: string | null): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();
  let timeToFirstContent: number | undefined;

  let modelNameSent = requestedModelName == null; // on resume, DMessage already has the model name
  let upstreamHandleSent = false;
  let operationOpId: string | null = null; // interaction id; used to pair in-progress / done operation-state updates
  let operationOpenEmitted = false;
  let interactionIdCache: string | null = null; // cached for the `operation-state done` emission on interaction.complete

  // per-index content-block state (mirrors what content.start declared; persists across delta/stop)
  const blocks: Record<number, BlockState> = Object.create(null);
  let lastOpenIdx = -1; // most recently opened content-block index; -1 = none open

  return function parse(pt: IParticleTransmitter, rawEventData: string, _eventName?: string): void {

    // model name announced once (agents don't populate modelVersion the way generateContent does)
    if (!modelNameSent && requestedModelName != null) {
      pt.setModelName(requestedModelName);
      modelNameSent = true;
    }

    // `event: done` carries the literal string `[DONE]` - terminate cleanly without a JSON parse
    if (rawEventData === '[DONE]')
      return;

    // parse the JSON body + validate against the event-union
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawEventData);
    } catch (e: any) {
      throw new Error(`malformed SSE frame (not JSON): ${e?.message || String(e)}`);
    }
    const parsed = GeminiInteractionsWire_API_Interactions.StreamEvent_schema.safeParse(rawJson);
    if (!parsed.success) {
      // tolerate future/unknown event types rather than failing the whole stream
      console.warn('[GeminiInteractions] unknown SSE event shape:', rawJson);
      return;
    }
    const event = parsed.data;

    switch (event.event_type) {

      // --- Lifecycle ---

      case 'interaction.start':
        interactionIdCache = event.interaction.id;
        if (!upstreamHandleSent) {
          pt.setUpstreamHandle(event.interaction.id, 'vnd.gem.interactions');
          upstreamHandleSent = true;
        }
        break;

      case 'interaction.status_update':
        interactionIdCache = event.interaction_id;
        if (!upstreamHandleSent) {
          pt.setUpstreamHandle(event.interaction_id, 'vnd.gem.interactions');
          upstreamHandleSent = true;
        }
        // Surface the in-progress label the first time we see it. Pinned to the interaction id so
        // the terminal done/error (emitted from interaction.complete) replaces the same entry.
        if (event.status === 'in_progress' && !operationOpenEmitted) {
          operationOpId = event.interaction_id;
          pt.sendOperationState('search-web', 'Deep Research in progress...', { opId: operationOpId });
          operationOpenEmitted = true;
        }
        break;

      case 'interaction.complete':
        _handleInteractionComplete(pt, event.interaction, operationOpId ?? interactionIdCache, lastOpenIdx, parserCreationTimestamp, timeToFirstContent);
        break;

      // --- Content-block lifecycle ---

      case 'content.start': {
        const kind = _classifyContentKind(event.content?.type);
        blocks[event.index] = { kind, emittedCitationKeys: new Set() };
        // natural part boundary: close any previously open part when switching indices
        if (lastOpenIdx !== -1 && lastOpenIdx !== event.index)
          pt.endMessagePart();
        lastOpenIdx = event.index;
        break;
      }

      case 'content.stop':
        // the final `endMessagePart` is emitted by `interaction.complete` after status evaluation,
        // so we don't auto-close here - lets multi-block streams flow naturally
        break;

      // --- Delta routing ---

      case 'content.delta': {
        if (timeToFirstContent === undefined)
          timeToFirstContent = Date.now() - parserCreationTimestamp;

        // Ensure state exists even if we missed content.start (tolerant)
        if (!blocks[event.index])
          blocks[event.index] = { kind: 'other', emittedCitationKeys: new Set() };
        const state = blocks[event.index];

        // Classify the delta payload - unknown types warn once and are dropped
        const deltaParse = GeminiInteractionsWire_API_Interactions.StreamDelta_schema.safeParse(event.delta);
        if (!deltaParse.success) {
          // Empty deltas ({}) appear alongside placeholder blocks (e.g. internal tool slots) - silent skip
          if (event.delta && Object.keys(event.delta).length === 0) break;
          console.warn('[GeminiInteractions] unknown content.delta shape at index', event.index, event.delta);
          break;
        }
        const delta = deltaParse.data;

        switch (delta.type) {
          case 'thought_summary':
            if (delta.content?.text) pt.appendReasoningText(delta.content.text);
            // Intentionally NOT re-emitting sendOperationState here. The chip is created ONCE at
            // interaction.status_update and left alone - its `cts` is anchored to the run's
            // createdAt via the upstream handle (reassembler line 775), so the chip's timer shows
            // the true elapsed run time and survives reattach cleanly. Re-emitting would pollute
            // the opLog without adding user value.
            break;
          case 'thought_signature':
            if (delta.signature) pt.setReasoningSignature(delta.signature);
            break;
          case 'text':
            pt.appendText(delta.text);
            break;
          case 'text_annotation':
            if (!DISABLE_CITATIONS && delta.annotations) {
              for (const annRaw of delta.annotations) {
                const ann = GeminiInteractionsWire_API_Interactions.UrlCitationAnnotation_schema.safeParse(annRaw);
                if (!ann.success) continue; // place_citation, file_citation, etc. - not surfaced here
                const a = ann.data;
                const key = `${a.url}@${a.start_index ?? ''}-${a.end_index ?? ''}`;
                if (state.emittedCitationKeys.has(key)) continue;
                state.emittedCitationKeys.add(key);
                pt.appendUrlCitation(a.title || a.url, a.url, undefined, a.start_index, a.end_index, undefined, undefined);
              }
            }
            break;
          case 'image':
            // Forward-looking: inline bytes flow through appendImageInline; URI-only gets a visible note.
            if (delta.data && delta.mime_type) {
              pt.appendImageInline(delta.mime_type, delta.data, 'Gemini Generated Image', 'Gemini', '', true);
            } else if (delta.uri) {
              console.warn('[GeminiInteractions] image delta via URI not fetched:', delta.uri);
              pt.appendText(`\n[Image: ${delta.uri}]\n`);
            }
            break;
          case 'audio':
            // Forward-looking: audio deltas per spec (not yet observed in DR streams). PCM needs WAV conversion; packaged formats pass through.
            if (delta.data && delta.mime_type) {
              const mime = delta.mime_type.toLowerCase();
              const isPCM = mime.startsWith('audio/l16') || mime.includes('codec=pcm');
              if (isPCM) {
                try {
                  const wav = geminiConvertPCM2WAV(delta.mime_type, delta.data);
                  pt.appendAudioInline(wav.mimeType, wav.base64Data, 'Gemini Generated Audio', 'Gemini', wav.durationMs);
                } catch (error) {
                  console.warn('[GeminiInteractions] audio PCM convert failed:', error);
                }
              } else {
                pt.appendAudioInline(delta.mime_type, delta.data, 'Gemini Generated Audio', 'Gemini', 0);
              }
            }
            break;
          default: {
            const _exhaustive: never = delta;
            break;
          }
        }
        break;
      }

      case 'error':
        // Observed mid-stream with an empty payload between content blocks - non-fatal, the stream
        // continues with further events and eventually an interaction.complete. Silent-skip empty
        // payloads (Beta noise); warn only when actual error info is present.
        if (event.error?.message || event.error?.code)
          console.warn('[GeminiInteractions] SSE error event:', event.error);
        break;

      default: {
        const _exhaustiveCheck: never = event;
        console.warn('[GeminiInteractions] unreachable: unhandled emittable type', { event });
        break;
      }
    }
  };
}


// --- helpers ---

function _classifyContentKind(rawType: unknown): BlockState['kind'] {
  if (rawType === 'thought') return 'thought';
  if (rawType === 'text') return 'text';
  if (rawType === 'image') return 'image';
  return 'other';
}

function _handleInteractionComplete(
  pt: IParticleTransmitter,
  interaction: TInteraction,
  operationOpId: string | null,
  lastOpenIdx: number,
  parserCreationTimestamp: number,
  timeToFirstContent: number | undefined,
): void {

  // Flush any content parts that were open when the final block arrived
  if (lastOpenIdx !== -1) pt.endMessagePart();

  switch (interaction.status) {
    case 'completed':
      if (operationOpId)
        pt.sendOperationState('search-web', 'Deep Research complete', { opId: operationOpId, state: 'done' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setTokenStopReason('ok');
      pt.setDialectEnded('done-dialect');
      break;

    case 'failed':
      if (operationOpId)
        pt.sendOperationState('search-web', 'Deep Research failed', { opId: operationOpId, state: 'error' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setDialectTerminatingIssue('Deep Research interaction failed', null, 'srv-warn');
      break;

    case 'cancelled':
      if (operationOpId)
        pt.sendOperationState('search-web', 'Deep Research cancelled', { opId: operationOpId, state: 'done' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setTokenStopReason('cg-issue');
      pt.setDialectEnded('done-dialect');
      break;

    case 'requires_action':
      // Not expected for Deep Research agents - fail loudly so we notice
      if (operationOpId)
        pt.sendOperationState('search-web', 'Deep Research needs action', { opId: operationOpId, state: 'error' });
      pt.setDialectTerminatingIssue('Deep Research returned requires_action (not supported in this client)', null, 'srv-warn');
      break;

    case 'incomplete':
      // Run stopped early (token limit, etc.). Terminate gracefully with a visible note; we keep any content already emitted.
      if (operationOpId)
        pt.sendOperationState('search-web', 'Deep Research incomplete', { opId: operationOpId, state: 'done' });
      pt.appendText('\n_Response incomplete (run stopped early)._\n');
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setTokenStopReason('out-of-tokens');
      pt.setDialectEnded('done-dialect');
      break;

    case 'in_progress':
      // interaction.complete with in_progress shouldn't happen per the spec - log and keep the stream open
      console.warn('[GeminiInteractions] interaction.complete with status=in_progress; ignoring');
      break;

    default: {
      const _exhaustiveCheck: never = interaction.status;
      console.warn('[GeminiInteractions] unreachable status', interaction.status);
      break;
    }
  }
}


/**
 * Map Gemini Interactions `usage` to `CGSelectMetrics`.
 *
 * Notes on the token model (per the Interactions API):
 *  - `total_input_tokens` counts the user-visible prompt input.
 *  - `total_cached_tokens` is a *subset* of input that was served from cache (we subtract to get "new" input).
 *  - `total_tool_use_tokens` is distinct from input/output/thought and accounts for internal tool calls
 *    (web search, code exec, etc.). For Deep Research this dominates - we fold it into TIn so displayed
 *    input reflects true model consumption; there is no dedicated slot in CGSelectMetrics today.
 *  - `total_output_tokens` excludes thought tokens; `gemini.parser.ts` already adds TOutR into TOut
 *    for consistency, and we follow the same convention here.
 */
function _emitUsageMetrics(
  pt: IParticleTransmitter,
  usage: TUsage | undefined,
  parserCreationTimestamp: number,
  timeToFirstContent: number | undefined,
): void {
  if (!usage) return;

  const m: AixWire_Particles.CGSelectMetrics = {};

  const inputTokens = usage.total_input_tokens ?? 0;
  const cachedTokens = usage.total_cached_tokens ?? 0;
  const toolUseTokens = usage.total_tool_use_tokens ?? 0;
  const outputTokens = usage.total_output_tokens ?? 0;
  const thoughtTokens = usage.total_thought_tokens ?? 0;

  // TIn = "new" input, i.e. prompt tokens beyond cache, plus tool-use tokens (folded in - no dedicated slot)
  const newInput = Math.max(0, inputTokens - cachedTokens) + toolUseTokens;
  if (newInput > 0) m.TIn = newInput;
  if (cachedTokens > 0) m.TCacheRead = cachedTokens;

  // TOut = output + thought (match gemini.parser.ts convention: candidatesTokenCount excludes thoughts)
  const totalOut = outputTokens + thoughtTokens;
  if (totalOut > 0) m.TOut = totalOut;
  if (thoughtTokens > 0) m.TOutR = thoughtTokens;

  // timing
  const dtAll = Date.now() - parserCreationTimestamp;
  m.dtAll = dtAll;
  if (timeToFirstContent !== undefined) {
    m.dtStart = timeToFirstContent;
    const dtInner = dtAll - timeToFirstContent;
    if (dtInner > 0) {
      m.dtInner = dtInner;
      if (totalOut > 0)
        m.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * totalOut / dtInner) / 100;
    }
  }

  pt.updateMetrics(m);
}
