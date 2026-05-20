import type * as z from 'zod/v4';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';

import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';
import { IssueSymbols } from '../ChatGenerateTransmitter';
import { geminiConvertPCM2WAV } from './gemini.audioutils';


// Kill-switch: drop url_citation annotations - Deep Research ships opaque grounding-redirect URLs with no titles, and the text already contains a numbered source list.
const DISABLE_CITATIONS = true;

// Gemini Interactions Environment retention (per docs: Idle after 15min, retained 7 days since last
// active, then deleted). Wire doesn't expose `environment_expires_at`, so we stamp the env handle
// with `now + 7d` on every turn that touches it. The history walk's 15s expiry buffer skips stale
// candidates and the adapter falls through to `"remote"` (fresh sandbox) when none are usable.
const _GEM_ENV_TTL_MS = 7 * 24 * 60 * 60 * 1000;


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
export function createGeminiInteractionsParserSSE(requestedModelName: string | null): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();
  let timeToFirstContent: number | undefined;

  // Antigravity is bound to its connection (background=false), so the upstream resource is GONE the
  // moment the stream disconnects (probe: GET 404s within seconds of abort). Suppressing the upstream
  // handle hides the Resume/Recover/Stop UI - the local-fetch abort path is still wired for cancel.
  const isAntigravity = (requestedModelName ?? '').includes('antigravity-');
  // Per-agent run-chip presentation (only DR's text was hard-coded historically).
  const runChipMotif: 'search-web' | 'code-exec' = isAntigravity ? 'code-exec' : 'search-web';
  const runChipText: string = isAntigravity ? 'Antigravity Agent running...' : 'Deep Research in progress...';

  let modelNameSent = requestedModelName == null; // on resume, DMessage already has the model name
  let upstreamHandleSent = isAntigravity; // never emit a handle for Antigravity (non-resumable)
  let operationOpId: string | null = null; // interaction id; used to pair in-progress / done operation-state updates AND as parentOpId for nested tool ops
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
        // Capture the Interactions API session handle (`environment_id`) so the next turn can reuse
        // the same upstream sandbox. Interaction-level field (not agent-specific) - any future
        // managed agent with a sandbox returns it. Lifecycle per docs: Idle after 15min, retained
        // 7 days since last active, then deleted - so we stamp `expiresAt: now + 7d` on every turn
        // that touches the env (refresh-on-use). The walk's existing 15s gate skips stale envs.
        if (event.interaction.environment_id)
          pt.sendSetVendorState({
            p: 'svs',
            vendor: 'gemini-envid',
            state: {
              environment: {
                id: event.interaction.environment_id,
                expiresAt: new Date(Date.now() + _GEM_ENV_TTL_MS).toISOString(),
              },
            },
          });
        break;

      case 'interaction.status_update':
        interactionIdCache = event.interaction_id;
        if (!upstreamHandleSent) {
          pt.setUpstreamHandle(event.interaction_id, 'vnd.gem.interactions');
          upstreamHandleSent = true;
        }
        // Surface the in-progress label the first time we see it. Pinned to the interaction id so
        // the terminal done/error (emitted from interaction.complete) replaces the same entry, AND
        // serves as parentOpId for nested tool ops (Antigravity sandbox function_call/function_result).
        if (event.status === 'in_progress' && !operationOpenEmitted) {
          operationOpId = event.interaction_id;
          pt.sendOperationState(runChipMotif, runChipText, { opId: operationOpId });
          operationOpenEmitted = true;
        }
        break;

      case 'interaction.complete':
        _handleInteractionComplete(pt, event.interaction, operationOpId ?? interactionIdCache, lastOpenIdx, parserCreationTimestamp, timeToFirstContent, runChipMotif, isAntigravity ? 'Antigravity Agent' : 'Deep Research');
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
          const deltaType = (event.delta as { type?: string })?.type;
          // Antigravity sandbox tool calls/results: surface as nested op-state placeholders under the
          // run chip. Paired by id/call_id across the call/result variants:
          //   function_call/_result          - filesystem ops (list_files, read_file, ...)
          //   code_execution_call/_result    - bash/python in the sandbox
          //   google_search_call/_result     - web search
          //   url_context_call/_result       - web page fetch
          if (deltaType && _ANTIGRAVITY_SURFACED_TYPES.has(deltaType) && operationOpId !== null) {
            _emitAntigravityToolOp(pt, event.delta, operationOpId);
            break;
          }
          // Known-but-not-surfaced delta types (mirrors NS parser's INTERNAL_OUTPUT_TYPES policy + spec's document/video variants we don't model) - silent skip
          if (deltaType && (GeminiInteractionsWire_API_Interactions.INTERNAL_OUTPUT_TYPES.has(deltaType) || deltaType === 'document' || deltaType === 'video')) break;
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
        // Two observed shapes:
        //  1) Empty payload mid-stream (Beta noise): the stream continues with further events and
        //     eventually an interaction.complete - silent-skip.
        //  2) Populated payload with message/code: terminal upstream error (also how Gemini reports
        //     cancelled interactions: HTTP 500 to the cancel call + an error SSE on the stream).
        //     Surface as a dialect-terminating issue so the UI renders it and the stream ends cleanly.
        if (event.error?.message || event.error?.code) {
          const errorText = `${event.error.code ? `${event.error.code}: ` : ''}${event.error.message || 'Upstream error.'}`;
          pt.setDialectTerminatingIssue(errorText, IssueSymbols.Generic, 'srv-warn');
        }
        break;

      default: {
        const _exhaustiveCheck: never = event;
        console.warn('[GeminiInteractions] unreachable: unhandled emittable type', { event });
        break;
      }
    }
  };
}


/**
 * Non-streaming parser: reads the GET /v1beta/interactions/{id} JSON body once and emits the same
 * particles the SSE parser would, in a single batch.
 *
 * Used by the "Recover" path when SSE delivery is broken upstream (10-min cuts; see KB doc) but the
 * resource is still fetchable. We always re-emit the upstream handle so failed/in_progress runs
 * remain retryable; only `status: completed` clears it (via the reassembler's outcome=='completed' policy).
 *
 * See `kb/modules/LLM-gemini-interactions.md` for failure modes and recovery model.
 */
export function createGeminiInteractionsParserNS(requestedModelName: string | null): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();

  return function parse(pt: IParticleTransmitter, rawEventData: string, _eventName?: string): void {

    // model name (preserved from caller's DMessage on resume; first-call only on fresh fetches)
    if (requestedModelName != null)
      pt.setModelName(requestedModelName);

    // parse + validate against the Interaction resource schema (looseObject - tolerant to upstream additions)
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawEventData);
    } catch (e: any) {
      throw new Error(`malformed Interaction JSON: ${e?.message || String(e)}`);
    }
    const parsed = GeminiInteractionsWire_API_Interactions.Interaction_schema.safeParse(rawJson);
    if (!parsed.success) {
      console.warn('[GeminiInteractions-NS] unexpected Interaction shape:', rawJson);
      throw new Error('Gemini Interactions: unexpected resource shape (no `id`/`status` fields)');
    }
    const interaction = parsed.data;

    // upstream handle - preserve so user can retry / delete
    pt.setUpstreamHandle(interaction.id, 'vnd.gem.interactions');

    // Walk outputs in order. Each output is loose; we safeParse against KnownOutput_schema and
    // silently skip INTERNAL_OUTPUT_TYPES (tool calls/results). Order matters - thoughts and
    // text interleave in the report and the user reads them top-to-bottom.
    const outputs = interaction.outputs ?? [];
    let lastEmittedKind: 'thought' | 'text' | 'image' | 'audio' | null = null;
    for (const rawOut of outputs) {
      const outType = (rawOut as { type?: string })?.type;

      // silent-skip internal tool-call outputs (matches SSE parser policy for INTERNAL_OUTPUT_TYPES)
      if (outType && GeminiInteractionsWire_API_Interactions.INTERNAL_OUTPUT_TYPES.has(outType))
        continue;

      const knownOut = GeminiInteractionsWire_API_Interactions.KnownOutput_schema.safeParse(rawOut);
      if (!knownOut.success) {
        if (outType) console.warn('[GeminiInteractions-NS] unknown output type, skipping:', outType);
        continue;
      }

      // emit a part boundary when switching kinds, mirrors SSE behavior on content.start across indices
      if (lastEmittedKind !== null && lastEmittedKind !== knownOut.data.type)
        pt.endMessagePart();

      switch (knownOut.data.type) {
        case 'thought': {
          const summary = knownOut.data.summary;
          if (typeof summary === 'string') {
            if (summary) pt.appendReasoningText(summary);
          } else if (Array.isArray(summary)) {
            for (const item of summary)
              if (item.text) pt.appendReasoningText(item.text);
          }
          if (knownOut.data.signature)
            pt.setReasoningSignature(knownOut.data.signature);
          lastEmittedKind = 'thought';
          break;
        }
        case 'text': {
          if (knownOut.data.text)
            pt.appendText(knownOut.data.text);
          // Citations: matches SSE policy - DISABLE_CITATIONS kill-switch dictates Deep Research drops them
          if (!DISABLE_CITATIONS && knownOut.data.annotations) {
            for (const annRaw of knownOut.data.annotations) {
              const ann = GeminiInteractionsWire_API_Interactions.UrlCitationAnnotation_schema.safeParse(annRaw);
              if (!ann.success) continue;
              const a = ann.data;
              pt.appendUrlCitation(a.title || a.url, a.url, undefined, a.start_index, a.end_index, undefined, undefined);
            }
          }
          lastEmittedKind = 'text';
          break;
        }
        case 'image': {
          if (knownOut.data.data && knownOut.data.mime_type)
            pt.appendImageInline(knownOut.data.mime_type, knownOut.data.data, 'Gemini Generated Image', 'Gemini', '', true);
          else if (knownOut.data.uri)
            pt.appendText(`\n[Image: ${knownOut.data.uri}]\n`);
          lastEmittedKind = 'image';
          break;
        }
        case 'audio': {
          if (knownOut.data.data && knownOut.data.mime_type) {
            const mime = knownOut.data.mime_type.toLowerCase();
            const isPCM = mime.startsWith('audio/l16') || mime.includes('codec=pcm');
            if (isPCM) {
              try {
                const wav = geminiConvertPCM2WAV(knownOut.data.mime_type, knownOut.data.data);
                pt.appendAudioInline(wav.mimeType, wav.base64Data, 'Gemini Generated Audio', 'Gemini', wav.durationMs);
              } catch (error) {
                console.warn('[GeminiInteractions-NS] audio PCM convert failed:', error);
              }
            } else {
              pt.appendAudioInline(knownOut.data.mime_type, knownOut.data.data, 'Gemini Generated Audio', 'Gemini', 0);
            }
          }
          lastEmittedKind = 'audio';
          break;
        }
        default: {
          const _exhaustive: never = knownOut.data;
          break;
        }
      }
    }

    // close out any open part before the terminal status emission
    if (lastEmittedKind !== null) pt.endMessagePart();

    // Terminal status -> stop reason + dialect end (mirrors _handleInteractionComplete)
    switch (interaction.status) {
      case 'completed':
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, undefined);
        pt.setTokenStopReason('ok');
        pt.setDialectEnded('done-dialect');
        break;
      case 'failed':
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, undefined);
        pt.setDialectTerminatingIssue('Deep Research interaction failed', null, 'srv-warn');
        break;
      case 'cancelled':
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, undefined);
        pt.setTokenStopReason('cg-issue');
        pt.setDialectEnded('done-dialect');
        break;
      case 'incomplete':
        pt.appendText('\n_Response incomplete (run stopped early)._\n');
        _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, undefined);
        pt.setTokenStopReason('out-of-tokens');
        pt.setDialectEnded('done-dialect');
        break;
      case 'requires_action':
        pt.setDialectTerminatingIssue('Deep Research returned requires_action (not supported in this client)', null, 'srv-warn');
        break;
      case 'in_progress': {
        // Two scenarios both surface as `in_progress`:
        //  1) Run is genuinely live server-side (just slow) - polling later will yield content.
        //  2) "Zombie": the generator crashed but the status never transitioned. Stays `in_progress`
        //     for days with no outputs. Not recoverable - the only remedy is delete + retry.
        // We can't disambiguate from one frame, so we surface {created, updated, outputs.length}
        // and let the user decide. `tokenStopReason='cg-issue'` keeps the upstream handle alive
        // (vs 'ok' which would clear it via the reassembler's clean-completion policy).
        // see kb/modules/LLM-gemini-interactions.md#failure-modes (C)
        const elapsedMin = _minutesSince(interaction.created);
        const updatedMin = _minutesSince(interaction.updated);
        const outCount = (interaction.outputs ?? []).length;
        const lines: string[] = ['\n_Deep Research run is **`in_progress`** server-side._\n'];
        if (elapsedMin != null) lines.push(`- Started: **${_humanDuration(elapsedMin)} ago**`);
        if (updatedMin != null && updatedMin !== elapsedMin) lines.push(`- Last server update: **${_humanDuration(updatedMin)} ago**`);
        lines.push(`- Outputs so far: **${outCount === 0 ? 'none' : outCount}**`);
        // Heuristic threshold: stale-and-empty for >60 min is almost certainly a zombie.
        const looksStuck = outCount === 0 && elapsedMin != null && elapsedMin > 60;
        if (looksStuck)
          lines.push('\nThis run looks **stuck** (no content for over an hour). Click **Cancel** to delete it and try again.');
        else
          lines.push('\nTry **Recover** again in a few minutes; if it stays empty, click **Cancel** to delete and retry.');
        pt.appendText(lines.join('\n') + '\n');
        pt.setTokenStopReason('cg-issue');
        pt.setDialectEnded('done-dialect');
        break;
      }
      default: {
        const _exhaustiveCheck: never = interaction.status;
        console.warn('[GeminiInteractions-NS] unreachable status', interaction.status);
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


// -- Antigravity sandbox tool surfacing --
//
// The Antigravity Agent emits its sandbox tools as content.delta payloads. We pair call/result via
// id/call_id and route through `sendOperationState`, with `parentOpId` set to the run's main chip
// (operationOpId === interaction.id). The reassembler accumulates these into a single VoidPlaceholder
// fragment's opLog with inferred `level`, producing a tree of actions under the run chip. Active on
// call, done on result. Empty `text` on result preserves the call's chip-line via the reassembler's
// falsy-skip in the merge logic.
//
// Observed delta shapes (probed 2026-05-19, antigravity-preview-05-2026):
//   function_call            { id, type: 'function_call',          name, arguments }
//   function_result          { call_id, type: 'function_result',   name, result: [{ type:'text', text }] }
//   code_execution_call      { id, type: 'code_execution_call',    arguments: { code: string } }
//   code_execution_result    { call_id, type: 'code_execution_result', result: string (stdout+stderr) }
//   google_search_call       { id, type: 'google_search_call',     arguments: { queries: string[] } }
//   google_search_result     { call_id, type: 'google_search_result', result: [{ search_suggestions: <html> }, ...] }
//   url_context_call         { id, type: 'url_context_call',       arguments: { url(s)? } }    [shape inferred]
//   url_context_result       { call_id, type: 'url_context_result', result: ?? }              [shape inferred]

const _ANTIGRAVITY_SURFACED_TYPES = new Set<string>([
  'function_call', 'function_result',
  'code_execution_call', 'code_execution_result',
  'google_search_call', 'google_search_result',
  'url_context_call', 'url_context_result',
]);

const _TOOL_TEXT_MAX = 80;   // chip-line cap (single-line summary)
const _TOOL_DETAIL_MAX = 240; // iTexts/oTexts cap (expanded detail)

function _truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function _summarizeFunctionArgs(name: string, args: unknown): string {
  if (typeof args !== 'object' || args === null) return name;
  const a = args as Record<string, unknown>;
  // Prefer the first stringy field that typically identifies the target of the call.
  for (const key of ['path', 'query', 'url', 'command', 'pattern']) {
    const v = a[key];
    if (typeof v === 'string' && v.length > 0) return _truncate(`${name} ${v}`, _TOOL_TEXT_MAX);
  }
  if (Object.keys(a).length === 0) return name;
  let json: string;
  try { json = JSON.stringify(a); } catch { return name; }
  return _truncate(`${name} ${json}`, _TOOL_TEXT_MAX);
}

function _snippetFromArrayOfText(result: unknown): string | undefined {
  if (!Array.isArray(result)) return undefined;
  for (const item of result) {
    const t = (item as { type?: unknown; text?: unknown })?.text;
    if (typeof t === 'string' && t.length > 0) return _truncate(t, _TOOL_DETAIL_MAX);
  }
  return undefined;
}

function _emitAntigravityToolOp(pt: IParticleTransmitter, delta: unknown, parentOpId: string): void {
  const d = delta as {
    type?: string; id?: string; call_id?: string;
    name?: string; arguments?: unknown; result?: unknown;
  };

  switch (d.type) {

    // --- filesystem tools (list_files, read_file, write_file, edit_file, search_files, ...) ---
    case 'function_call': {
      if (!d.id) return;
      const name = d.name || 'tool';
      pt.sendOperationState('code-exec', _summarizeFunctionArgs(name, d.arguments), { opId: d.id, parentOpId });
      return;
    }
    case 'function_result': {
      if (!d.call_id) return;
      const snippet = _snippetFromArrayOfText(d.result);
      pt.sendOperationState('code-exec', '', {
        opId: d.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }

    // --- bash / python in the sandbox ---
    case 'code_execution_call': {
      if (!d.id) return;
      const code = ((d.arguments as { code?: unknown })?.code ?? '') as string;
      const firstLine = typeof code === 'string' ? (code.split('\n')[0] || '') : '';
      const text = firstLine ? _truncate(`$ ${firstLine}`, _TOOL_TEXT_MAX) : 'execute';
      // Full code goes into iTexts so the user can inspect multi-line scripts in the placeholder UI.
      pt.sendOperationState('code-exec', text, {
        opId: d.id, parentOpId,
        ...(typeof code === 'string' && code.length > 0 ? { iTexts: [_truncate(code, _TOOL_DETAIL_MAX)] } : {}),
      });
      return;
    }
    case 'code_execution_result': {
      if (!d.call_id) return;
      const result = typeof d.result === 'string' ? d.result : (d.result == null ? '' : JSON.stringify(d.result));
      const snippet = result ? _truncate(result, _TOOL_DETAIL_MAX) : undefined;
      pt.sendOperationState('code-exec', '', {
        opId: d.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }

    // --- web search ---
    case 'google_search_call': {
      if (!d.id) return;
      const queries = ((d.arguments as { queries?: unknown })?.queries) as unknown;
      const first = Array.isArray(queries) && typeof queries[0] === 'string' ? queries[0] as string : '';
      const text = first ? _truncate(`search: ${first}`, _TOOL_TEXT_MAX) : 'web search';
      pt.sendOperationState('search-web', text, { opId: d.id, parentOpId });
      return;
    }
    case 'google_search_result': {
      if (!d.call_id) return;
      // Result carries `search_suggestions` HTML widgets - not useful as a chip detail. Skip oTexts.
      pt.sendOperationState('search-web', '', { opId: d.call_id, parentOpId, state: 'done' });
      return;
    }

    // --- url fetch (shape not yet observed; defensive extraction) ---
    case 'url_context_call': {
      if (!d.id) return;
      const a = (d.arguments as Record<string, unknown>) || {};
      const url = (typeof a.url === 'string' ? a.url : '')
        || (Array.isArray(a.urls) && typeof a.urls[0] === 'string' ? (a.urls[0] as string) : '');
      const text = url ? _truncate(`fetch: ${url}`, _TOOL_TEXT_MAX) : 'url fetch';
      pt.sendOperationState('search-web', text, { opId: d.id, parentOpId });
      return;
    }
    case 'url_context_result': {
      if (!d.call_id) return;
      const snippet = typeof d.result === 'string'
        ? _truncate(d.result, _TOOL_DETAIL_MAX)
        : _snippetFromArrayOfText(d.result);
      pt.sendOperationState('search-web', '', {
        opId: d.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }
  }
}

function _handleInteractionComplete(
  pt: IParticleTransmitter,
  interaction: TInteraction,
  operationOpId: string | null,
  lastOpenIdx: number,
  parserCreationTimestamp: number,
  timeToFirstContent: number | undefined,
  runChipMotif: 'search-web' | 'code-exec',
  agentLabel: string, // 'Deep Research' | 'Antigravity Agent' - used for the terminal chip text
): void {

  // Flush any content parts that were open when the final block arrived
  if (lastOpenIdx !== -1) pt.endMessagePart();

  switch (interaction.status) {
    case 'completed':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} complete`, { opId: operationOpId, state: 'done' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setTokenStopReason('ok');
      pt.setDialectEnded('done-dialect');
      break;

    case 'failed':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} failed`, { opId: operationOpId, state: 'error' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setDialectTerminatingIssue(`${agentLabel} interaction failed`, null, 'srv-warn');
      break;

    case 'cancelled':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} cancelled`, { opId: operationOpId, state: 'done' });
      _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);
      pt.setTokenStopReason('cg-issue');
      pt.setDialectEnded('done-dialect');
      break;

    case 'requires_action':
      // Not expected for Deep Research; not expected for Antigravity in current preview
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} needs action`, { opId: operationOpId, state: 'error' });
      pt.setDialectTerminatingIssue(`${agentLabel} returned requires_action (not supported in this client)`, null, 'srv-warn');
      break;

    case 'incomplete':
      // Run stopped early (token limit, etc.). Terminate gracefully with a visible note; we keep any content already emitted.
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} incomplete`, { opId: operationOpId, state: 'done' });
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


/** Minutes elapsed between an upstream ISO 8601 timestamp and now. Returns null on parse failure. */
function _minutesSince(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (Date.now() - ms) / 60_000);
}

/** Human-readable elapsed-time string for in_progress diagnostic messages. */
function _humanDuration(minutes: number): string {
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10} hours`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10} days`;
}
