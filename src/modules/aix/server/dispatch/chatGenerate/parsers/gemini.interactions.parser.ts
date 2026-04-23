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


/**
 * Gemini Interactions API parser (for Deep Research and future multimodal agents).
 *
 * Each SSE frame carries a *full* Interaction snapshot (from POST or from a GET poll).
 * The parser diffs against prior state and emits only new content.
 *
 * Emission rules per output type:
 *  - `text`           -> `pt.appendText(newSuffix)`. New url_citation annotations are emitted once.
 *  - `thought`        -> `pt.appendReasoningText(newSuffix)`; signatures recorded via `setReasoningSignature`.
 *  - `image`          -> `pt.appendImageInline(...)` once per index (images are whole, not incremental).
 *                        URI-only variants emit a visible note + `console.warn` (not yet wired as fetches).
 *  - `audio`          -> PCM -> WAV via `geminiConvertPCM2WAV`, then `pt.appendAudioInline(...)` once per index.
 *  - unknown types    -> `console.warn` + inline `_Unsupported content block: <type>_` note, once per index.
 *                        Non-terminating: Deep Research streams are long-lived and must not blow up on new blocks.
 *
 * Part boundaries: when the output type at a given index changes kind (e.g. thought -> text),
 * we call `endMessagePart()` so the transmitter flushes the previous part cleanly.
 */
export function createGeminiInteractionsParser(requestedModelName: string | null): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();
  let timeToFirstEvent: number | undefined;

  // on resume we don't know the model name (the DMessage already has it) - skip emission
  let modelNameSent = requestedModelName == null;
  let upstreamHandleSent = false;
  let operationOpId: string | null = null; // interaction id, set once; used to pair in-progress/done operation state
  let operationOpenEmitted = false;

  // per-index emission state (array index in `outputs[]`)
  type EmittedState = {
    kind: 'text' | 'thought' | 'image' | 'audio' | 'other';
    emittedTextLen: number;
    emittedCitationKeys: Set<string>; // `${url}@${start}-${end}` to de-dupe
    signatureSent: boolean;
    mediaEmitted: boolean; // image/audio: emit only once (whole, not incremental)
    otherWarned: boolean; // unknown type: warn only once per index
  };
  const emitted: EmittedState[] = [];
  let lastOpenIdx = -1; // index of the most recently opened part; -1 = none

  return function parse(pt: IParticleTransmitter, rawEventData: string): void {

    // model name is announced once (agents don't populate modelVersion the same way)
    if (!modelNameSent && requestedModelName != null) {
      pt.setModelName(requestedModelName);
      modelNameSent = true;
    }

    // parse + validate
    const parsed = GeminiInteractionsWire_API_Interactions.Interaction_schema.safeParse(JSON.parse(rawEventData));
    if (!parsed.success)
      throw new Error(`malformed interaction snapshot: ${parsed.error.message}`);
    const interaction: TInteraction = parsed.data;

    // emit the upstream handle on the first frame that has an id (enables reattach across reloads)
    if (!upstreamHandleSent && interaction.id) {
      pt.setUpstreamHandle(interaction.id, 'vnd.gem.interactions');
      upstreamHandleSent = true;
    }

    // Operation state: give the UI a live progress indicator while the background agent runs.
    // Pinned to the interaction id so the terminal 'done'/'error' replaces the same entry.
    if (interaction.id && !operationOpId)
      operationOpId = interaction.id;
    if (operationOpId && !operationOpenEmitted && interaction.status === 'in_progress') {
      pt.sendOperationState('search-web', 'Deep Research in progress...', { opId: operationOpId });
      operationOpenEmitted = true;
    }

    // record time-to-first-content (first frame that carries outputs)
    if (timeToFirstEvent === undefined && interaction.outputs && interaction.outputs.length > 0)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // process outputs (may be absent on early in_progress frames).
    // Each raw output is classified via Zod safeParse against a discriminated union.
    // - Untyped/empty placeholders (`{}`, no `type` field) are skipped silently without creating
    //   state, so a later snapshot that populates them can classify cleanly.
    // - Typed-but-unknown shapes warn once per index with a visible note (non-terminating).
    const outputs = interaction.outputs ?? [];
    for (let i = 0; i < outputs.length; i++) {
      const raw = outputs[i] as { type?: unknown };
      const rawType = typeof raw?.type === 'string' ? raw.type : null;

      // skip not-yet-populated placeholder blocks silently (Deep Research pre-allocates slots)
      if (rawType === null) continue;

      // silent-skip Deep Research internal tool call/result blocks. These are streamed as content
      // alongside text/thought but shouldn't surface to the user - the top-level "Deep Research in
      // progress" operation state already signals activity.
      if (GeminiInteractionsWire_API_Interactions.INTERNAL_OUTPUT_TYPES.has(rawType)) continue;

      const classified = GeminiInteractionsWire_API_Interactions.KnownOutput_schema.safeParse(raw);
      const kind: EmittedState['kind'] = !classified.success ? 'other' : classified.data.type;

      // first time we see this index: initialize + flush previous part if switching kinds
      let state = emitted[i];
      if (!state) {
        state = { kind, emittedTextLen: 0, emittedCitationKeys: new Set(), signatureSent: false, mediaEmitted: false, otherWarned: false };
        emitted[i] = state;

        // close previous part if we're opening a new index (natural part boundary)
        if (lastOpenIdx !== -1 && lastOpenIdx !== i)
          pt.endMessagePart();
        lastOpenIdx = i;
      }

      // 'other': warn once per index with visible note, then continue
      if (!classified.success) {
        if (!state.otherWarned) {
          console.warn(`[GeminiInteractions] unsupported output type: ${rawType}`, raw);
          pt.appendText(`\n_Unsupported content block: ${rawType}_\n`);
          state.otherWarned = true;
        }
        continue;
      }

      const out = classified.data;
      if (out.type === 'text') {
        if (out.text.length > state.emittedTextLen) {
          pt.appendText(out.text.slice(state.emittedTextLen));
          state.emittedTextLen = out.text.length;
        }
        // url_citation annotations: loose-typed in Output_schema, validated per-item here
        if (!DISABLE_CITATIONS && out.annotations) {
          for (const annRaw of out.annotations) {
            const annParse = GeminiInteractionsWire_API_Interactions.UrlCitationAnnotation_schema.safeParse(annRaw);
            if (!annParse.success) continue; // not a url_citation (place_citation, file_citation, ...)
            const ann = annParse.data;
            const key = `${ann.url}@${ann.start_index ?? ''}-${ann.end_index ?? ''}`;
            if (state.emittedCitationKeys.has(key)) continue;
            state.emittedCitationKeys.add(key);
            pt.appendUrlCitation(ann.title || ann.url, ann.url, undefined, ann.start_index, ann.end_index, undefined, undefined);
          }
        }
      } else if (out.type === 'thought') {
        // summary may be a string (preview) or an array of {type:'text', text} blocks (documented shape)
        const summary = typeof out.summary === 'string'
          ? out.summary
          : Array.isArray(out.summary)
            ? out.summary.map(s => s.text).join('\n\n')
            : '';
        if (summary.length > state.emittedTextLen) {
          pt.appendReasoningText(summary.slice(state.emittedTextLen));
          state.emittedTextLen = summary.length;
        }
        if (!state.signatureSent && out.signature) {
          pt.setReasoningSignature(out.signature);
          state.signatureSent = true;
        }
      } else if (out.type === 'image') {
        if (!state.mediaEmitted) {
          if (out.data) {
            pt.appendImageInline(out.mime_type, out.data, 'Gemini Generated Image', 'Gemini', '');
          } else if (out.uri) {
            // URI-hosted images aren't fetched here (yet); surface the link inline
            console.warn('[GeminiInteractions] image output via URI is not yet fetched inline:', out.uri);
            pt.appendText(`\n[Image: ${out.uri}]\n`);
          } else {
            console.warn('[GeminiInteractions] image output with neither data nor uri:', out);
            pt.appendText(`\n_Image block without payload_\n`);
          }
          state.mediaEmitted = true;
        }
      } else /* out.type === 'audio' */ {
        if (!state.mediaEmitted) {
          if (out.data) {
            const mime = out.mime_type.toLowerCase();
            const isPCM = mime.startsWith('audio/l16') || mime.includes('codec=pcm');
            if (isPCM) {
              try {
                const wav = geminiConvertPCM2WAV(out.mime_type, out.data);
                pt.appendAudioInline(wav.mimeType, wav.base64Data, 'Gemini Generated Audio', 'Gemini', wav.durationMs);
              } catch (error) {
                console.warn('[GeminiInteractions] audio PCM convert failed:', error);
                pt.appendText(`\n_Audio conversion failed: ${String(error)}_\n`);
              }
            } else {
              // already a packaged format (audio/wav, audio/mp3, audio/aac, ...) - pass through
              pt.appendAudioInline(out.mime_type, out.data, 'Gemini Generated Audio', 'Gemini', 0);
            }
          } else if (out.uri) {
            console.warn('[GeminiInteractions] audio output via URI is not yet fetched inline:', out.uri);
            pt.appendText(`\n[Audio: ${out.uri}]\n`);
          } else {
            console.warn('[GeminiInteractions] audio output with neither data nor uri:', out);
            pt.appendText(`\n_Audio block without payload_\n`);
          }
          state.mediaEmitted = true;
        }
      }
    }

    // terminal states: flush current part and signal end
    switch (interaction.status) {
      case 'completed':
        if (lastOpenIdx !== -1) pt.endMessagePart();
        if (operationOpId)
          pt.sendOperationState('search-web', 'Deep Research complete', { opId: operationOpId, state: 'done' });
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstEvent);
        pt.setTokenStopReason('ok');
        pt.setDialectEnded('done-dialect');
        break;

      case 'failed':
        if (operationOpId)
          pt.sendOperationState('search-web', 'Deep Research failed', { opId: operationOpId, state: 'error' });
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstEvent);
        pt.setDialectTerminatingIssue('Deep Research interaction failed', null, 'srv-warn');
        break;

      case 'cancelled':
        if (operationOpId)
          pt.sendOperationState('search-web', 'Deep Research cancelled', { opId: operationOpId, state: 'done' });
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstEvent);
        pt.setTokenStopReason('cg-issue');
        pt.setDialectEnded('done-dialect');
        break;

      case 'requires_action':
        // Not expected for Deep Research agents - fail loudly so we notice
        if (operationOpId)
          pt.sendOperationState('search-web', 'Deep Research needs action', { opId: operationOpId, state: 'error' });
        pt.setDialectTerminatingIssue('Deep Research returned requires_action (not supported in this client)', null, 'srv-warn');
        break;

      case 'in_progress':
      default:
        // keep polling
        break;
    }
  };
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
 *  - `total_output_tokens` excludes thought tokens; `gemini.parser.ts` (line 110) already adds TOutR into TOut
 *    for consistency, and we follow the same convention here.
 */
function _emitUsageMetrics(
  pt: IParticleTransmitter,
  usage: TUsage | undefined,
  parserCreationTimestamp: number,
  timeToFirstEvent: number | undefined,
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
  if (timeToFirstEvent !== undefined) {
    m.dtStart = timeToFirstEvent;
    const dtInner = dtAll - timeToFirstEvent;
    if (dtInner > 0) {
      m.dtInner = dtInner;
      if (totalOut > 0)
        m.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * totalOut / dtInner) / 100;
    }
  }

  pt.updateMetrics(m);
}
