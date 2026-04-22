import type * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.access';

import { ChatGenerateDispatch } from '../chatGenerate.dispatch';
import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';


// configuration
const INITIAL_POLL_DELAY_MS = 3_000; // first poll happens this long after the POST accepted the job
const STEADY_POLL_INTERVAL_MS = 10_000; // subsequent polls
const MAX_SLEEP_CHUNK_MS = 1_000; // wake often to honor abort promptly


type TRequestBody = z.infer<typeof GeminiInteractionsWire_API_Interactions.RequestBody_schema>;
type TInteraction = z.infer<typeof GeminiInteractionsWire_API_Interactions.Interaction_schema>;


/**
 * Gemini Interactions API - Poll-to-Stream bridge (CREATE flow).
 *
 * Returns a `customConnect` function suitable for `ChatGenerateDispatch.customConnect`.
 *
 * Flow:
 *  1. POST /v1beta/interactions with `background: true` - returns the interaction id (usually with status 'in_progress')
 *  2. Return a `Response` whose body is a ReadableStream of SSE frames
 *  3. Background producer polls GET /v1beta/interactions/{id} every few seconds until status is terminal
 *  4. Each poll writes one SSE frame (the full Interaction JSON) - the parser diffs vs. prior state
 *  5. DELETE only on natural terminal status (completed/failed/cancelled). On client abort or stream
 *     error we leave the interaction ALIVE upstream so the client can reattach across reloads via
 *     `createGeminiInteractionsResumeConnect`. Gemini auto-cleans after its retention window (1d free / 55d paid).
 *     WARNING: this trades off orphan risk for reattach viability - if the client never reattaches,
 *     the upstream agent keeps running and consuming tokens until the retention window expires.
 */
export function createGeminiInteractionsConnect(access: GeminiAccessSchema, body: TRequestBody): Pick<ChatGenerateDispatch, 'request' | 'customConnect'> {

  // compute URL/headers once - exposed as `request` for debug echo, and reused by the POST
  const { url, headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.postPath, false);
  const request = { url, headers, method: 'POST' as const, body };

  const connect = async function (signal: AbortSignal): Promise<Response> {

    // 1. Initial POST - reuses the same url/headers we expose via `request`
    const initial = await _postInteractionAt(url, headers, body, signal);

    // 2. Build the streaming response seeded with the initial snapshot
    return _buildStreamingResponse(access, initial.id, initial, signal);
  };

  return { request, customConnect: connect };
}


/**
 * Gemini Interactions API - Poll-to-Stream bridge (RESUME flow).
 *
 * Same shape as `createGeminiInteractionsConnect`, but skips the POST step and starts
 * directly from GET-polling an existing interaction id. Used by `createChatGenerateResumeDispatch`
 * when reattaching to an in-progress Deep Research run after a page reload.
 */
export function createGeminiInteractionsResumeConnect(access: GeminiAccessSchema, interactionId: string): Pick<ChatGenerateDispatch, 'request' | 'customConnect'> {

  // compute URL/headers for debug echo - real I/O happens in customConnect below (GET-poll loop)
  const requestDummy = {
    ...geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.getPath(interactionId), false),
    method: 'GET' as const,
  };

  const connect = async function (signal: AbortSignal): Promise<Response> {

    // no POST - jump straight into polling this known interaction id
    return _buildStreamingResponse(access, interactionId, null, signal);
  };

  return { request: requestDummy, customConnect: connect };
}


// --- Shared stream-building logic ---

function _buildStreamingResponse(
  access: GeminiAccessSchema,
  interactionId: string,
  initial: TInteraction | null,
  signal: AbortSignal,
): Response {

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {

      const emitSseFrame = (interaction: TInteraction) => {
        const data = JSON.stringify(interaction);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      void (async () => {
        // `store: true` is required by the API when background=true, so Gemini retains the interaction.
        // WARNING: orphan risk - we only DELETE on natural terminal status. On abort/error we leave the
        // interaction alive upstream so the client can reattach across reloads. If the client never
        // comes back, the agent keeps running and consuming tokens until Gemini's retention window
        // (1d free / 55d paid) auto-cleans it.
        let shouldDelete = false;
        try {

          // First frame (create flow only): seed with the POST response
          if (initial) {
            emitSseFrame(initial);
            if (_isTerminalStatus(initial.status)) {
              shouldDelete = true;
              controller.close();
              return;
            }
            await _sleepOrAbort(INITIAL_POLL_DELAY_MS, signal);
          }

          // Polling loop
          while (!signal.aborted) {
            const snapshot = await _getInteraction(access, interactionId, signal);
            emitSseFrame(snapshot);
            if (_isTerminalStatus(snapshot.status)) {
              shouldDelete = true;
              controller.close();
              return;
            }
            await _sleepOrAbort(STEADY_POLL_INTERVAL_MS, signal);
          }
          // aborted by client (reload or user cancel): close cleanly, do NOT delete so the client can reattach
          controller.close();

        } catch (err: any) {
          // surfaces to the stream consumer; executor treats as 'dispatch-read' issue
          // do NOT delete on error - the interaction may still be running upstream and the client may reattach
          if (signal.aborted)
            controller.close();
          else
            controller.error(err);
        } finally {
          if (shouldDelete)
            void _deleteInteraction(access, interactionId).catch(() => { /* ignore */ });
        }
      })();
    },
    cancel(_reason) {
      // the consumer cancelled - upstream abort will have fired too
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });
}


// --- HTTP helpers ---
//
// We use the unified `fetchJsonOrTRPCThrow` / `fetchResponseOrTRPCThrow` helpers from
// `~/server/trpc/trpc.router.fetchers`. They are isomorphic (CSF-safe), auto-check
// `response.ok`, and throw a well-shaped `TRPCFetcherError` with category + httpStatus.
//
// !! RETRY LANDMINE !! The outer executor wraps `customConnect` in
// `fetchWithAbortableConnectionRetry`, which retries on any TRPCFetcherError of
// category 'connection' or 'http' (502/503/429). Letting such an error propagate
// out of `customConnect` would re-execute the initial POST, creating a DUPLICATE
// Deep Research interaction server-side. So `_postInteraction` catches and rewraps
// TRPCFetcherError as plain Error (retrier ignores unknown errors).
//
// `_getInteraction` and `_deleteInteraction` run INSIDE the ReadableStream producer,
// which is beyond the retry boundary - their TRPCFetcherErrors are surfaced via
// `controller.error(err)` -> executor's `dispatch-read` path, and `safeErrorString`
// renders the .message nicely. So those can let TRPCFetcherError through.

async function _postInteractionAt(url: string, headers: HeadersInit, body: TRequestBody, signal: AbortSignal): Promise<TInteraction> {
  let rawJson: Record<string, unknown>;
  try {
    rawJson = await fetchJsonOrTRPCThrow<Record<string, unknown>, TRequestBody>({
      url, method: 'POST', headers, body,
      signal, name: 'Gemini.Interactions.create', throwWithoutName: true,
    });
  } catch (error: any) {
    // Preserve abort identity (name='TRPCFetcherError') so the executor's abort classifier
    // can route this to the clean 'done-dispatch-aborted' path. The retrier already
    // short-circuits on signal.aborted, so the duplicate-POST concern below doesn't apply.
    if (signal.aborted) throw error;
    // Rewrap TRPCFetcherError -> plain Error so the outer retry wrapper does NOT
    // re-execute this customConnect (which would duplicate the Interaction).
    throw new Error(`Gemini Interactions POST: ${error?.message || 'upstream error'}`);
  }
  return _validateInteraction(rawJson, 'POST');
}

async function _getInteraction(access: GeminiAccessSchema, interactionId: string, signal: AbortSignal): Promise<TInteraction> {
  const { url, headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.getPath(interactionId), false);
  const rawJson = await fetchJsonOrTRPCThrow<Record<string, unknown>>({
    url, method: 'GET', headers,
    signal, name: 'Gemini.Interactions.get', throwWithoutName: true,
  });
  return _validateInteraction(rawJson, 'GET');
}

async function _deleteInteraction(access: GeminiAccessSchema, interactionId: string): Promise<void> {
  // Best-effort: own short timeout, caller swallows any throw
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3_000);
  try {
    const { url, headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.deletePath(interactionId), false);
    await fetchResponseOrTRPCThrow({
      url, method: 'DELETE', headers,
      signal: ac.signal, name: 'Gemini.Interactions.delete', throwWithoutName: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

function _validateInteraction(rawJson: unknown, method: 'POST' | 'GET'): TInteraction {
  const parsed = GeminiInteractionsWire_API_Interactions.Interaction_schema.safeParse(rawJson);
  if (!parsed.success)
    throw new Error(`Gemini Interactions ${method}: unexpected response shape (${parsed.error.message})`);
  return parsed.data;
}


// --- Small utils ---

function _isTerminalStatus(status: TInteraction['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

async function _sleepOrAbort(totalMs: number, signal: AbortSignal): Promise<void> {
  let remaining = totalMs;
  while (remaining > 0 && !signal.aborted) {
    const chunk = Math.min(remaining, MAX_SLEEP_CHUNK_MS);
    await new Promise<void>(resolve => {
      const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, chunk);
      const onAbort = () => { clearTimeout(t); resolve(); };
      signal.addEventListener('abort', onAbort, { once: true });
    });
    remaining -= chunk;
  }
}
