import type * as z from 'zod/v4';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';

import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';


// Kill-switch: drop url_citation annotations - Deep Research ships opaque grounding-redirect URLs with no titles, and the text already contains a numbered source list.
const DISABLE_CITATIONS = true;


type TInteraction = z.infer<typeof GeminiInteractionsWire_API_Interactions.Interaction_schema>;
type TUsage = NonNullable<TInteraction['usage']>;


/**
 * Gemini Interactions API parser (for Deep Research agents).
 *
 * Each SSE frame carries a *full* Interaction snapshot (from POST or from a GET poll).
 * The parser diffs against prior state and emits only new content.
 *
 * Emission rules per output type:
 *  - `text`           -> `pt.appendText(newSuffix)`. New url_citation annotations are emitted once.
 *  - `thought`        -> `pt.appendReasoningText(newSuffix)`; signatures recorded via `setReasoningSignature`.
 *  - any other type   -> ignored (Deep Research primarily emits text + thought).
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
    kind: 'text' | 'thought' | 'other';
    emittedTextLen: number;
    emittedCitationKeys: Set<string>; // `${url}@${start}-${end}` to de-dupe
    signatureSent: boolean;
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
    // Each raw output is classified via Zod safeParse against a discriminated union; unknown
    // shapes fall through to `kind: 'other'` and are silently ignored.
    const outputs = interaction.outputs ?? [];
    for (let i = 0; i < outputs.length; i++) {
      const classified = GeminiInteractionsWire_API_Interactions.KnownOutput_schema.safeParse(outputs[i]);
      const kind: EmittedState['kind'] = !classified.success ? 'other' : classified.data.type;

      // first time we see this index: initialize + flush previous part if switching kinds
      let state = emitted[i];
      if (!state) {
        state = { kind, emittedTextLen: 0, emittedCitationKeys: new Set(), signatureSent: false };
        emitted[i] = state;

        // close previous part if we're opening a new index (natural part boundary)
        if (lastOpenIdx !== -1 && lastOpenIdx !== i)
          pt.endMessagePart();
        lastOpenIdx = i;
      }

      if (!classified.success) continue; // 'other': ignored for now

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
      } else /* out.type === 'thought' */ {
        const summary = out.summary ?? '';
        if (summary.length > state.emittedTextLen) {
          pt.appendReasoningText(summary.slice(state.emittedTextLen));
          state.emittedTextLen = summary.length;
        }
        if (!state.signatureSent && out.signature) {
          pt.setReasoningSignature(out.signature);
          state.signatureSent = true;
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
