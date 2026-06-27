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
type TToolStep = z.infer<typeof GeminiInteractionsWire_API_Interactions.SurfacedToolStep_schema>;

type BlockState = {
  stepType: string; // raw step.type from step.start (model_output | thought | <tool>_call | <tool>_result | ...)
  kind: 'thought' | 'text' | 'image' | 'tool' | 'other';
  emittedCitationKeys: Set<string>; // `${url}@${start}-${end}` for de-dupe (url_citations can repeat)
  // tool steps
  toolOpId?: string;  // tool steps: opId to pair call/result chip ops (step.id for calls, step.call_id for results)
  toolName?: string;  // tool steps: function/tool name, for delta-refined chip labels
  argsAccum?: string; // tool calls: accumulated `arguments_delta` partial-JSON, finalized at step.stop
};


/**
 * Gemini Interactions API SSE parser (steps schema; Deep Research, Antigravity, future agents).
 *
 * The upstream request is sent with `stream=true` and returns `text/event-stream` with events:
 *  - interaction.created / interaction.status_update | in_progress | requires_action / interaction.completed  (lifecycle)
 *  - step.start / step.delta / step.stop                                   (per-index typed steps)
 *  - error                                                                 (non-fatal, empty payload observed mid-stream)
 *  - done                                                                  (legacy terminator, data: [DONE] - kept defensively)
 *
 * The SSE demuxer (`fast-sse`) invokes this parser once per frame with `eventData` (the JSON body)
 * and `eventName` (the `event:` line). We dispatch on the JSON payload's `event_type` field which
 * mirrors the SSE event name - staying resilient if the demuxer drops the event name.
 *
 * Step routing (step.start declares the step `type`; step.delta carries incremental `delta`):
 *  - model_output  -> content[] blocks: text -> appendText, image -> appendImageInline, audio -> appendAudioInline
 *  - thought       -> summary -> appendReasoningText, signature -> setReasoningSignature
 *  - <tool>_call   -> op-state chip (active) via `_emitAntigravityToolOp` (Antigravity sandbox surfacing)
 *  - <tool>_result -> op-state chip (done) via `_emitAntigravityToolOp`
 *
 * The 2026-05-26 "steps" migration renamed the legacy events (interaction.start -> interaction.created,
 * content.* -> step.*, interaction.complete -> interaction.completed) and moved user-facing content into
 * `model_output` steps' `content[]`. See gemini.interactions.wiretypes.ts and kb/modules/LLM-gemini-interactions.md.
 *
 * Resume: GET /v1beta/interactions/{id}?stream=true - Gemini replays the full event sequence from the
 * start. Our parser is position-idempotent within a single run because the transmitter's state carries
 * across events (the client's ContentReassembler REPLACES message content on reattach).
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
  let interactionIdCache: string | null = null; // cached for the `operation-state done` emission on interaction.completed

  // per-index step-block state (mirrors what step.start declared; persists across delta/stop)
  const blocks: Record<number, BlockState> = Object.create(null);
  let lastOpenIdx = -1; // most recently opened step index; -1 = none open

  const markFirstContent = (): void => {
    if (timeToFirstContent === undefined)
      timeToFirstContent = Date.now() - parserCreationTimestamp;
  };

  // Surface the run-chip the first time an in-progress lifecycle event arrives. Pinned to the
  // interaction id so the terminal done/error (from interaction.completed) replaces the same entry,
  // AND serves as parentOpId for nested tool ops (Antigravity sandbox tool steps).
  const openRunChip = (pt: IParticleTransmitter, interactionId: string | null): void => {
    if (operationOpenEmitted) return;
    operationOpId = interactionId ?? interactionIdCache;
    if (operationOpId) {
      pt.sendOperationState(runChipMotif, runChipText, { opId: operationOpId });
      operationOpenEmitted = true;
    }
  };

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

      case 'interaction.created':
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
        // Open the run chip eagerly: in the steps schema the in-progress signal may arrive as a
        // separate event (interaction.status_update / interaction.in_progress) OR be implied by created.
        // Opening here too ensures operationOpId is set (tool ops require it as parentOpId) even if the
        // separate in-progress event never lands. Idempotent via operationOpenEmitted.
        if (event.interaction.status === undefined || event.interaction.status === 'in_progress')
          openRunChip(pt, event.interaction.id);
        break;

      case 'interaction.status_update':
        interactionIdCache = event.interaction_id;
        if (!upstreamHandleSent) {
          pt.setUpstreamHandle(event.interaction_id, 'vnd.gem.interactions');
          upstreamHandleSent = true;
        }
        if (event.status === 'in_progress')
          openRunChip(pt, event.interaction_id);
        break;

      // Migration-guide variants of status_update (the formal spec only lists status_update, but the
      // guide's streaming example emits these). Treat in_progress as the run-chip opener; capture the
      // handle on either. requires_action is terminal-ish for our agents (we don't satisfy tool calls)
      // and is finalized at interaction.completed - here we just capture the handle.
      case 'interaction.in_progress':
        if (event.interaction_id) {
          interactionIdCache = event.interaction_id;
          if (!upstreamHandleSent) {
            pt.setUpstreamHandle(event.interaction_id, 'vnd.gem.interactions');
            upstreamHandleSent = true;
          }
        }
        openRunChip(pt, event.interaction_id ?? null);
        break;

      case 'interaction.requires_action':
        if (event.interaction_id) {
          interactionIdCache = event.interaction_id;
          if (!upstreamHandleSent) {
            pt.setUpstreamHandle(event.interaction_id, 'vnd.gem.interactions');
            upstreamHandleSent = true;
          }
        }
        break;

      case 'interaction.completed':
        _handleInteractionCompleted(pt, event.interaction, operationOpId ?? interactionIdCache, lastOpenIdx, parserCreationTimestamp, timeToFirstContent, runChipMotif, isAntigravity ? 'Antigravity Agent' : 'Deep Research');
        break;

      // --- Step lifecycle ---

      case 'step.start': {
        const step = event.step;
        const stepType = String(step.type);
        const kind = _classifyStepKind(stepType);
        const state: BlockState = { stepType, kind, emittedCitationKeys: new Set() };
        blocks[event.index] = state;

        // natural part boundary: close any previously open part when switching indices
        if (lastOpenIdx !== -1 && lastOpenIdx !== event.index)
          pt.endMessagePart();
        lastOpenIdx = event.index;

        if (stepType === 'model_output') {
          // step.start may carry the first content chunk(s); subsequent chunks stream via step.delta.
          if (Array.isArray(step.content) && step.content.length)
            for (const block of step.content)
              _emitContentBlock(pt, block, state, markFirstContent);
        } else if (stepType === 'thought') {
          // step.start may carry the summary + signature inline; later additions stream as thought_summary deltas.
          markFirstContent();
          _emitThoughtSummary(pt, step.summary);
          if (typeof step.signature === 'string' && step.signature)
            pt.setReasoningSignature(step.signature);
        } else if (GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_CALL_TYPES.has(stepType) || GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_RESULT_TYPES.has(stepType)) {
          // Antigravity sandbox tool call/result: surface as a nested op-state chip under the run chip.
          // safeParse the loose step into the typed tool-step union for type-safe field access.
          const toolStep = GeminiInteractionsWire_API_Interactions.SurfacedToolStep_schema.safeParse(step);
          if (toolStep.success) {
            const td = toolStep.data;
            state.toolOpId = 'id' in td ? td.id : td.call_id; // call -> id, result -> call_id (pairs the chip)
            state.toolName = 'name' in td ? td.name : undefined;
            if (operationOpId !== null) _emitAntigravityToolOp(pt, td, operationOpId);
          } else {
            console.warn(`[GeminiInteractions] surfaced tool step '${stepType}' failed schema parse at index ${event.index} - chip not rendered`, step);
          }
        } else if (stepType === 'user_input' || GeminiInteractionsWire_API_Interactions.SILENCE_STEP_TYPES.has(stepType)) {
          // Expected-but-not-surfaced: `user_input` echo (appears on resume-GET replay, not on POST) and the
          // internal tools (google_maps / file_search / mcp). Intentionally no emission.
        } else {
          // HIGH-PRIORITY: an unsupported/new step type. Surface loudly (non-fatal - we keep parsing the
          // rest of the run) so a new tool or a changed schema gets noticed instead of silently dropping
          // its output. To handle it, add the type to SURFACED_TOOL_*_TYPES / SILENCE_STEP_TYPES (wiretypes)
          // or extend this step handler.
          console.warn(`[GeminiInteractions] unsupported step.start type '${stepType}' at index ${event.index} - skipping (no surface)`, step);
        }
        break;
      }

      case 'step.stop': {
        const state = blocks[event.index];
        // Finalize a tool-call chip whose arguments arrived incrementally via `arguments_delta`.
        if (state?.toolOpId && state.argsAccum && operationOpId !== null && GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_CALL_TYPES.has(state.stepType)) {
          let args: unknown;
          try { args = JSON.parse(state.argsAccum); } catch { args = undefined; }
          if (args !== undefined) {
            const synth = GeminiInteractionsWire_API_Interactions.SurfacedToolStep_schema.safeParse({ type: state.stepType, id: state.toolOpId, name: state.toolName, arguments: args });
            if (synth.success) _emitAntigravityToolOp(pt, synth.data, operationOpId);
          }
        }
        // content blocks: the final `endMessagePart` is emitted by interaction.completed after status
        // evaluation, so we don't auto-close here - lets multi-step streams flow naturally.
        break;
      }

      // --- Delta routing ---

      case 'step.delta': {
        markFirstContent();

        // Ensure state exists even if we missed step.start (tolerant)
        if (!blocks[event.index])
          blocks[event.index] = { stepType: 'unknown', kind: 'other', emittedCitationKeys: new Set() };
        const state = blocks[event.index];

        // Classify the delta payload - unknown/tool types fall to the surfacing branch below
        const deltaParse = GeminiInteractionsWire_API_Interactions.StreamDelta_schema.safeParse(event.delta);
        if (!deltaParse.success) {
          // Empty deltas ({}) appear alongside placeholder steps (e.g. internal tool slots) - silent skip
          if (event.delta && Object.keys(event.delta).length === 0) break;
          const deltaType = (event.delta as { type?: string })?.type;
          // Antigravity sandbox tool calls/results stream their typed delta on the matching step index.
          // The typed delta carries no id/call_id, so we pair it with the opId captured at step.start.
          if (deltaType && state.toolOpId && operationOpId !== null
            && (GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_CALL_TYPES.has(deltaType) || GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_RESULT_TYPES.has(deltaType))) {
            _emitAntigravityToolDeltaRefine(pt, event.delta, state, operationOpId);
            break;
          }
          // Known-but-not-surfaced delta types (internal tools + spec's video we don't model) - silent skip
          if (deltaType && (GeminiInteractionsWire_API_Interactions.SILENCE_STEP_TYPES.has(deltaType) || deltaType === 'video')) break;
          console.warn('[GeminiInteractions] unknown step.delta shape at index', event.index, event.delta);
          break;
        }
        const delta = deltaParse.data;

        switch (delta.type) {
          case 'thought_summary':
            if (delta.content?.text) pt.appendReasoningText(delta.content.text);
            // Intentionally NOT re-emitting sendOperationState here. The chip is created ONCE at the
            // in-progress lifecycle event and left alone - its `cts` is anchored to the run's createdAt
            // via the upstream handle, so the chip's timer shows the true elapsed run time and survives
            // reattach cleanly. Re-emitting would pollute the opLog without adding user value.
            break;
          case 'thought_signature':
            if (delta.signature) pt.setReasoningSignature(delta.signature);
            break;
          case 'text':
            pt.appendText(delta.text);
            break;
          case 'text_annotation_delta':
            if (!DISABLE_CITATIONS && delta.annotations)
              _emitUrlCitations(pt, delta.annotations, state);
            break;
          case 'arguments_delta':
            // Streamed client function-call args (partial JSON). We don't execute client tools, but we
            // accumulate so a surfaced sandbox tool-call chip can be refined with the full args at step.stop.
            if (delta.arguments && state.toolOpId)
              state.argsAccum = (state.argsAccum ?? '') + delta.arguments;
            break;
          case 'image':
            // Inline bytes flow through appendImageInline; URI-only gets a visible note.
            if (delta.data && delta.mime_type) {
              pt.appendImageInline(delta.mime_type, delta.data, 'Gemini Generated Image', 'Gemini', '', true);
            } else if (delta.uri) {
              console.warn('[GeminiInteractions] image delta via URI not fetched:', delta.uri);
              pt.appendText(`\n[Image: ${delta.uri}]\n`);
            }
            break;
          case 'audio':
            // PCM needs WAV conversion; packaged formats pass through.
            if (delta.data && delta.mime_type)
              _emitAudio(pt, delta.mime_type, delta.data, '[GeminiInteractions] audio PCM convert failed:');
            break;
          case 'document':
            _emitDocument(pt, delta.mime_type, delta.data, delta.uri);
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
        //     eventually an interaction.completed - silent-skip.
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
 * resource is still fetchable. The GET returns the FULL timeline including `user_input` steps - we
 * skip those (they echo our own input) and walk `model_output` content + `thought` steps. We always
 * re-emit the upstream handle so failed/in_progress runs remain retryable; only `status: completed`
 * clears it (via the reassembler's outcome=='completed' policy).
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

    // Walk steps in order. Each step is loose; we route by `type`:
    //  - user_input  -> skip (the GET timeline echoes our own input back; not re-rendered)
    //  - model_output -> walk content[] (text/thought interleave in the report; read top-to-bottom)
    //  - thought     -> summary + signature
    //  - tool steps  -> skip on the recovery snapshot (chips were a streaming-time affordance)
    const steps = interaction.steps ?? [];
    const markFirstContent = (): void => void 0; // no timing on the one-shot path
    let lastEmittedKind: 'thought' | 'text' | 'image' | 'audio' | null = null;
    const sharedState: BlockState = { stepType: 'model_output', kind: 'text', emittedCitationKeys: new Set() };

    for (const rawStep of steps) {
      const stepType = (rawStep as { type?: string })?.type;
      if (!stepType || stepType === 'user_input') continue;

      if (stepType === 'thought') {
        const known = GeminiInteractionsWire_API_Interactions.KnownStep_schema.safeParse(rawStep);
        if (!known.success || known.data.type !== 'thought') continue;
        if (lastEmittedKind !== null && lastEmittedKind !== 'thought') pt.endMessagePart();
        _emitThoughtSummary(pt, known.data.summary);
        if (known.data.signature) pt.setReasoningSignature(known.data.signature);
        lastEmittedKind = 'thought';
        continue;
      }

      if (stepType === 'model_output') {
        const known = GeminiInteractionsWire_API_Interactions.KnownStep_schema.safeParse(rawStep);
        if (!known.success || known.data.type !== 'model_output') continue;
        for (const block of known.data.content ?? []) {
          const blockKind = _contentBlockKind(block);
          if (blockKind && lastEmittedKind !== null && lastEmittedKind !== blockKind) pt.endMessagePart();
          if (_emitContentBlock(pt, block, sharedState, markFirstContent)) lastEmittedKind = blockKind ?? lastEmittedKind;
        }
        continue;
      }

      // Tool steps (surfaced or internal) are intentionally not re-rendered on the recovery snapshot.
      // Anything ELSE is an unsupported/new step type - surface loudly (non-fatal) so it gets noticed.
      if (!GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_CALL_TYPES.has(stepType)
        && !GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_RESULT_TYPES.has(stepType)
        && !GeminiInteractionsWire_API_Interactions.SILENCE_STEP_TYPES.has(stepType))
        console.warn(`[GeminiInteractions-NS] unsupported step type '${stepType}' - skipping (no surface)`, rawStep);
    }

    // close out any open part before the terminal status emission
    if (lastEmittedKind !== null) pt.endMessagePart();

    // Metrics once, before the switch (status-independent). NS has no first-content time, so timing is dtAll only.
    _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, undefined);

    // Terminal status -> stop reason + dialect end (mirrors _handleInteractionCompleted)
    switch (interaction.status) {
      case 'completed':
        pt.setTokenStopReason('ok');
        pt.setDialectEnded('done-dialect');
        break;
      case 'failed':
        pt.setDialectTerminatingIssue('Deep Research interaction failed', null, 'srv-warn');
        break;
      case 'cancelled':
        pt.setTokenStopReason('cg-issue');
        pt.setDialectEnded('done-dialect');
        break;
      case 'incomplete':
        pt.appendText('\n_Response incomplete (run stopped early)._\n');
        pt.setTokenStopReason('out-of-tokens');
        pt.setDialectEnded('done-dialect');
        break;
      case 'budget_exceeded':
        pt.appendText('\n_Run stopped: budget exceeded._\n');
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
        //     for days with no steps. Not recoverable - the only remedy is delete + retry.
        // We can't disambiguate from one frame, so we surface {created, updated, steps.length}
        // and let the user decide. `tokenStopReason='cg-issue'` keeps the upstream handle alive
        // (vs 'ok' which would clear it via the reassembler's clean-completion policy).
        // see kb/modules/LLM-gemini-interactions.md#failure-modes (C)
        const elapsedMin = _minutesSince(interaction.created);
        const updatedMin = _minutesSince(interaction.updated);
        const outCount = (interaction.steps ?? []).length;
        const lines: string[] = ['\n_Deep Research run is **`in_progress`** server-side._\n'];
        if (elapsedMin != null) lines.push(`- Started: **${_humanDuration(elapsedMin)} ago**`);
        if (updatedMin != null && updatedMin !== elapsedMin) lines.push(`- Last server update: **${_humanDuration(updatedMin)} ago**`);
        lines.push(`- Steps so far: **${outCount === 0 ? 'none' : outCount}**`);
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


// --- content + thought emission (shared SSE step.start / NS walk) ---

function _classifyStepKind(stepType: string): BlockState['kind'] {
  if (stepType === 'thought') return 'thought';
  if (stepType === 'model_output') return 'text';
  if (stepType.endsWith('_call') || stepType.endsWith('_result')) return 'tool';
  return 'other';
}

function _contentBlockKind(block: unknown): 'text' | 'image' | 'audio' | null {
  const t = (block as { type?: string })?.type;
  if (t === 'text') return 'text';
  if (t === 'image') return 'image';
  if (t === 'audio') return 'audio';
  return null;
}

/** Emit one model_output content block (text/image/audio). Returns true if anything was emitted. */
function _emitContentBlock(pt: IParticleTransmitter, rawBlock: unknown, state: BlockState, markFirstContent: () => void): boolean {
  const known = GeminiInteractionsWire_API_Interactions.KnownContent_schema.safeParse(rawBlock);
  if (!known.success) {
    const t = (rawBlock as { type?: string })?.type;
    if (t && t !== 'video') console.warn('[GeminiInteractions] unknown content block, skipping:', t);
    return false;
  }
  const block = known.data;
  switch (block.type) {
    case 'text':
      if (block.text) {
        markFirstContent();
        pt.appendText(block.text);
      }
      if (!DISABLE_CITATIONS && block.annotations) _emitUrlCitations(pt, block.annotations, state);
      return !!block.text;
    case 'image':
      markFirstContent();
      if (block.data && block.mime_type)
        pt.appendImageInline(block.mime_type, block.data, 'Gemini Generated Image', 'Gemini', '', true);
      else if (block.uri)
        pt.appendText(`\n[Image: ${block.uri}]\n`);
      return true;
    case 'audio':
      markFirstContent();
      if (block.data && block.mime_type)
        _emitAudio(pt, block.mime_type, block.data, '[GeminiInteractions] audio PCM convert failed:');
      return true;
    case 'document':
      markFirstContent();
      _emitDocument(pt, block.mime_type, block.data, block.uri);
      return true;
    default: {
      const _exhaustive: never = block;
      return false;
    }
  }
}

/** Emit a thought summary (string or array of {text}) as reasoning text. */
function _emitThoughtSummary(pt: IParticleTransmitter, summary: unknown): void {
  if (typeof summary === 'string') {
    if (summary) pt.appendReasoningText(summary);
  } else if (Array.isArray(summary)) {
    for (const item of summary) {
      const t = (item as { text?: unknown })?.text;
      if (typeof t === 'string' && t) pt.appendReasoningText(t);
    }
  }
}

/** Emit a document/file artifact: inline bytes -> fire-and-forget client download (inline-download hres); URI-only -> a visible note. */
function _emitDocument(pt: IParticleTransmitter, mimeType: string | undefined, base64Data: string | undefined, uri: string | undefined): void {
  if (base64Data && mimeType)
    pt.appendHostedResource({ p: 'hres', kind: 'inline-download', mimeType, b64: base64Data });
  else if (uri)
    pt.appendText(`\n[Document: ${uri}]\n`);
}

function _emitAudio(pt: IParticleTransmitter, mimeType: string, base64Data: string, errPrefix: string): void {
  const mime = mimeType.toLowerCase();
  const isPCM = mime.startsWith('audio/l16') || mime.includes('codec=pcm');
  if (isPCM) {
    try {
      const wav = geminiConvertPCM2WAV(mimeType, base64Data);
      pt.appendAudioInline(wav.mimeType, wav.base64Data, 'Gemini Generated Audio', 'Gemini', wav.durationMs);
    } catch (error) {
      console.warn(errPrefix, error);
    }
  } else {
    pt.appendAudioInline(mimeType, base64Data, 'Gemini Generated Audio', 'Gemini', 0);
  }
}

function _emitUrlCitations(pt: IParticleTransmitter, annotations: Array<{ type: string }>, state: BlockState): void {
  for (const annRaw of annotations) {
    const ann = GeminiInteractionsWire_API_Interactions.UrlCitationAnnotation_schema.safeParse(annRaw);
    if (!ann.success) continue; // place_citation, file_citation, etc. - not surfaced here
    const a = ann.data;
    const key = `${a.url}@${a.start_index ?? ''}-${a.end_index ?? ''}`;
    if (state.emittedCitationKeys.has(key)) continue;
    state.emittedCitationKeys.add(key);
    pt.appendUrlCitation(a.title || a.url, a.url, undefined, a.start_index, a.end_index, undefined, undefined);
  }
}


// -- Antigravity sandbox tool surfacing --
//
// The Antigravity Agent surfaces its sandbox tools as typed STEPS (step.start carries the full step
// object; step.delta may carry incremental args/results). We pair call/result via id/call_id and route
// through `sendOperationState`, with `parentOpId` set to the run's main chip (operationOpId ===
// interaction.id). The reassembler accumulates these into a single VoidPlaceholder fragment's opLog with
// inferred `level`, producing a tree of actions under the run chip. Active on call, done on result.
//
// `_emitAntigravityToolOp` takes a typed `SurfacedToolStep` (the callers safeParse the loose step, or a
// {type,id/call_id,...} synthesized from a typed step.delta, into the union first), so field access is
// type-checked per variant. Wire shapes VERIFIED on the steps schema (live probe 2026-06-02, zero warnings):
//   function_call       step.start { id, type:'function_call', name, arguments:{} (EMPTY) }; args stream as
//                       a JSON string via `arguments_delta` deltas (accumulated -> finalized at step.stop)
//   function_result     step.start { call_id, type:'function_result' } + typed result step.delta; call_id === call.id
//   code_execution_call step.start { id, type:'code_execution_call' }; `{code}` arrives via typed code_execution_call step.delta
//   code_execution_result typed step.delta { result: string (stdout+stderr) }; call_id === call.id
//   google_search_call  step.start { id, type:'google_search_call' }; `{queries|query}` via typed step.delta
//   google_search_result typed step.delta { result: { search_suggestions } }
//   url_context_*        NOT observed (Antigravity prefers bash curl); defensive handler retained

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
    const t = (item as { type?: unknown; text?: unknown; snippet?: unknown })?.text ?? (item as { snippet?: unknown })?.snippet;
    if (typeof t === 'string' && t.length > 0) return _truncate(t, _TOOL_DETAIL_MAX);
  }
  return undefined;
}

function _emitAntigravityToolOp(pt: IParticleTransmitter, step: TToolStep, parentOpId: string): void {
  switch (step.type) {

    // --- filesystem tools (list_files, read_file, write_file, edit_file, search_files, ...) ---
    case 'function_call':
      pt.sendOperationState('code-exec', _summarizeFunctionArgs(step.name || 'tool', step.arguments), { opId: step.id, parentOpId });
      return;
    case 'function_result': {
      const snippet = _snippetFromArrayOfText(step.result) ?? (typeof step.result === 'string' ? _truncate(step.result, _TOOL_DETAIL_MAX) : undefined);
      pt.sendOperationState('code-exec', '', {
        opId: step.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }

    // --- bash / python in the sandbox ---
    case 'code_execution_call': {
      const code = step.arguments?.code ?? '';
      const firstLine = code.split('\n')[0] || '';
      const text = firstLine ? _truncate(`$ ${firstLine}`, _TOOL_TEXT_MAX) : 'execute';
      // Full code goes into iTexts so the user can inspect multi-line scripts in the placeholder UI.
      pt.sendOperationState('code-exec', text, {
        opId: step.id, parentOpId,
        ...(code.length > 0 ? { iTexts: [_truncate(code, _TOOL_DETAIL_MAX)] } : {}),
      });
      return;
    }
    case 'code_execution_result': {
      const result = typeof step.result === 'string' ? step.result : (step.result == null ? '' : JSON.stringify(step.result));
      const snippet = result ? _truncate(result, _TOOL_DETAIL_MAX) : undefined;
      pt.sendOperationState('code-exec', '', {
        opId: step.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }

    // --- web search ---
    case 'google_search_call': {
      const a = step.arguments;
      const first = (a && Array.isArray(a.queries) && typeof a.queries[0] === 'string') ? a.queries[0] : (a?.query ?? '');
      const text = first ? _truncate(`search: ${first}`, _TOOL_TEXT_MAX) : 'web search';
      pt.sendOperationState('search-web', text, { opId: step.id, parentOpId });
      return;
    }
    case 'google_search_result':
      // Result carries `search_suggestions` HTML widgets - not useful as a chip detail. Skip oTexts.
      pt.sendOperationState('search-web', '', { opId: step.call_id, parentOpId, state: 'done' });
      return;

    // --- url fetch (not observed on Antigravity - prefers bash curl; defensive extraction) ---
    case 'url_context_call': {
      const a = step.arguments;
      const url = (a?.url ?? '') || (a && Array.isArray(a.urls) && typeof a.urls[0] === 'string' ? a.urls[0] : '');
      const text = url ? _truncate(`fetch: ${url}`, _TOOL_TEXT_MAX) : 'url fetch';
      pt.sendOperationState('search-web', text, { opId: step.id, parentOpId });
      return;
    }
    case 'url_context_result': {
      const snippet = typeof step.result === 'string'
        ? _truncate(step.result, _TOOL_DETAIL_MAX)
        : _snippetFromArrayOfText(step.result);
      pt.sendOperationState('search-web', '', {
        opId: step.call_id, parentOpId, state: 'done',
        ...(snippet ? { oTexts: [snippet] } : {}),
      });
      return;
    }

    default: {
      const _exhaustive: never = step;
      return;
    }
  }
}

/**
 * Refine a tool chip from a step.delta payload (the typed call/result delta carries no id, so we pair it
 * with the opId captured at step.start). Synthesizes the {type,id/call_id,...} shape `_emitAntigravityToolOp`
 * expects from the delta + the step-block state.
 */
function _emitAntigravityToolDeltaRefine(pt: IParticleTransmitter, delta: unknown, state: BlockState, parentOpId: string): void {
  const d = delta as { type?: string; arguments?: unknown; result?: unknown };
  if (!d.type || !state.toolOpId) return;
  const isResult = GeminiInteractionsWire_API_Interactions.SURFACED_TOOL_RESULT_TYPES.has(d.type);
  const synthesized = isResult
    ? { type: d.type, call_id: state.toolOpId, name: state.toolName, result: d.result }
    : { type: d.type, id: state.toolOpId, name: state.toolName, arguments: d.arguments };
  const parsed = GeminiInteractionsWire_API_Interactions.SurfacedToolStep_schema.safeParse(synthesized);
  if (parsed.success) _emitAntigravityToolOp(pt, parsed.data, parentOpId);
}


// --- terminal status + usage ---

function _handleInteractionCompleted(
  pt: IParticleTransmitter,
  interaction: TInteraction,
  operationOpId: string | null,
  lastOpenIdx: number,
  parserCreationTimestamp: number,
  timeToFirstContent: number | undefined,
  runChipMotif: 'search-web' | 'code-exec',
  agentLabel: string, // 'Deep Research' | 'Antigravity Agent' - used for the terminal chip text
): void {

  // Flush any content parts that were open when the final step arrived
  if (lastOpenIdx !== -1) pt.endMessagePart();

  // Metrics are status-independent (runtime always; token counts only when `usage` is present), so emit
  // once here instead of repeating the call in each terminal branch - requires_action now gets it too.
  _emitUsageMetrics(pt, interaction.usage, parserCreationTimestamp, timeToFirstContent);

  switch (interaction.status) {
    case 'completed':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} complete`, { opId: operationOpId, state: 'done' });
      pt.setTokenStopReason('ok');
      pt.setDialectEnded('done-dialect');
      break;

    case 'failed':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} failed`, { opId: operationOpId, state: 'error' });
      pt.setDialectTerminatingIssue(`${agentLabel} interaction failed`, null, 'srv-warn');
      break;

    case 'cancelled':
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} cancelled`, { opId: operationOpId, state: 'done' });
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
      pt.setTokenStopReason('out-of-tokens');
      pt.setDialectEnded('done-dialect');
      break;

    case 'budget_exceeded':
      // New steps-schema terminal status: the run hit a spend/compute budget cap. Keep emitted content.
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} budget exceeded`, { opId: operationOpId, state: 'error' });
      pt.appendText('\n_Run stopped: budget exceeded._\n');
      pt.setTokenStopReason('out-of-tokens');
      pt.setDialectEnded('done-dialect');
      break;

    case 'in_progress':
      // Anomalous: interaction.completed is the TERMINAL SSE event, so status=in_progress here means the
      // run did not actually finish AND no further frames will arrive. Terminate cleanly instead of leaving
      // the stream hanging until the socket times out (user-visible spinner hang). `cg-issue` keeps the
      // upstream handle alive for retry, matching the NS parser's in_progress policy.
      console.warn('[GeminiInteractions] interaction.completed with status=in_progress; terminating as retryable');
      if (operationOpId)
        pt.sendOperationState(runChipMotif, `${agentLabel} interrupted`, { opId: operationOpId, state: 'error' });
      pt.setTokenStopReason('cg-issue');
      pt.setDialectEnded('done-dialect');
      break;

    default: {
      const _exhaustiveCheck: never = interaction.status;
      console.warn('[GeminiInteractions] unreachable status', interaction.status);
      break;
    }
  }
}


/**
 * Map a Gemini Interactions `usage` block to token-count metrics (NO timing). Returns null when
 * usage is absent/empty.
 *
 * Shared by the live/NS parsers AND the usage-backfill transform: the live Deep Research
 * `interaction.completed` event omits `usage` by design (reduced payload - see the doc), so the
 * transform re-fetches the stored interaction and feeds its `usage` through this same mapping.
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
export function geminiInteractionsUsageToTokenMetrics(usage: Partial<TUsage> | undefined | null): Pick<AixWire_Particles.CGSelectMetrics, 'TIn' | 'TCacheRead' | 'TOut' | 'TOutR'> | null {
  if (!usage) return null;

  const inputTokens = usage.total_input_tokens ?? 0;
  const cachedTokens = usage.total_cached_tokens ?? 0;
  const toolUseTokens = usage.total_tool_use_tokens ?? 0;
  const outputTokens = usage.total_output_tokens ?? 0;
  const thoughtTokens = usage.total_thought_tokens ?? 0;

  const m: ReturnType<typeof geminiInteractionsUsageToTokenMetrics> = {};

  // TIn = "new" input, i.e. prompt tokens beyond cache, plus tool-use tokens (folded in - no dedicated slot)
  const newInput = Math.max(0, inputTokens - cachedTokens) + toolUseTokens;
  if (newInput > 0) m.TIn = newInput;
  if (cachedTokens > 0) m.TCacheRead = cachedTokens;

  // TOut = output + thought (match gemini.parser.ts convention: candidatesTokenCount excludes thoughts)
  const totalOut = outputTokens + thoughtTokens;
  if (totalOut > 0) m.TOut = totalOut;
  if (thoughtTokens > 0) m.TOutR = thoughtTokens;

  return (m.TIn !== undefined || m.TOut !== undefined || m.TCacheRead !== undefined) ? m : null;
}

/**
 * Emit chat-generate metrics on a terminal interaction.
 *
 * TIMING is emitted UNCONDITIONALLY: it is measured locally (parser-creation -> now) and does not
 * depend on the upstream `usage` block. This matters because the live Deep Research
 * `interaction.completed` event omits `usage` by design, and gating timing behind usage-presence
 * would silently discard the real run duration (`dtAll`). TOKENS are emitted only when `usage` is
 * present here; when it is not, the `usage-backfill` transform re-fetches them post-stream and
 * merges them into this same metrics particle (timing is preserved via accMetrics' key-merge).
 */
function _emitUsageMetrics(
  pt: IParticleTransmitter,
  usage: TUsage | undefined,
  parserCreationTimestamp: number,
  timeToFirstContent: number | undefined,
): void {

  const m: AixWire_Particles.CGSelectMetrics = {};

  // timing - always available locally, independent of upstream usage
  const dtAll = Date.now() - parserCreationTimestamp;
  m.dtAll = dtAll;
  if (timeToFirstContent !== undefined) {
    m.dtStart = timeToFirstContent;
    const dtInner = dtAll - timeToFirstContent;
    if (dtInner > 0)
      m.dtInner = dtInner;
  }

  // tokens - only when the upstream usage block is present in this event
  const tokenMetrics = geminiInteractionsUsageToTokenMetrics(usage);
  if (tokenMetrics) {
    // assign usage
    Object.assign(m, tokenMetrics);
    // compute speed
    if (m.dtInner && m.TOut)
      m.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * m.TOut / m.dtInner) / 100;
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
