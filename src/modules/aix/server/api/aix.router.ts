import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { _createDebugConfig } from '../dispatch/chatGenerate/chatGenerate.debug';
import { createChatGenerateDispatch, createChatGenerateResumeDispatch, executeChatGenerateDelete } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithContinuation } from '../dispatch/chatGenerate/chatGenerate.continuation';

import { AixWire_API, AixWire_API_ChatContentGenerate } from './aix.wiretypes';


// --- AIX tRPC Router ---

/**
 * Vercel hard-kills the edge function at 300s (limit set in the Vercel project settings) without running
 * any tRPC catch/finally, so a timed-out request leaves only a generic 'Task timed out' line with no model.
 * This arms a timer that logs the culprit ~15s before that kill - the only reliable way to see which
 * models/contexts run long enough to time out.
 *
 * It MUST live inside the streaming generator body (which runs during stream consumption); a tRPC middleware
 * can't do this because its `await next()` resolves before streaming begins (verified on @trpc/server 11.18).
 * Cleared in `finally` on any completion - success, error, or client abort - so it only ever fires for a
 * request that genuinely crossed 270s.
 */
function _armSlowRequestWatchdog(label: string, hardKillTime = 300): () => void {
  const timer = setTimeout(() => console.error(`[AIX] SLOW request (almost ${hardKillTime}s): ${label}`), (hardKillTime - 15) * 1000);
  return () => clearTimeout(timer);
}


export const aixRouter = createTRPCRouter({

  /**
   * Chat content generation, streaming, multipart.
   * Architecture: Client <-- (intake) --> Server <-- (dispatch) --> AI Service
   */
  chatGenerateContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      model: AixWire_API.Model_schema,
      chatGenerate: AixWire_API_ChatContentGenerate.Request_schema,
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.boolean(),
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.optional(), // debugDispatchRequest, debugProfilePerformance, enableResumability
    }))
    .mutation(async function* ({ input, ctx }) {
      const _clearWatchdog = _armSlowRequestWatchdog(`model=${input.model.id} dialect=${input.access.dialect} context=${input.context.name}/${input.context.ref}`);
      try {
        const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
        const dispatchCreator = () => createChatGenerateDispatch(input.access, input.model, input.chatGenerate, input.streaming, !!input.connectionOptions?.enableResumability);

        yield* executeChatGenerateWithContinuation(dispatchCreator, ctx.reqSignal, _d);
      } finally {
        _clearWatchdog();
      }
    }),

  /**
   * Chat content generation - reattach to an in-progress upstream run by handle, streaming only.
   * Today: OpenAI Responses API (network-disconnect recovery) and Gemini Interactions (Deep Research across reloads).
   */
  upstreamReattachContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      upstreamHandle: AixWire_API.UpstreamHandle_schema, // reattach uses a handle instead of 'model + chatGenerate'
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.boolean(),
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.pick({ debugDispatchRequest: true }).optional(), // debugDispatchRequest
    }))
    .mutation(async function* ({ input, ctx }) {
      const _clearWatchdog = _armSlowRequestWatchdog(`reattach dialect=${input.access.dialect} context=${input.context.name}/${input.context.ref}`);
      try {
        const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
        const dispatchCreator = () => createChatGenerateResumeDispatch(input.access, input.upstreamHandle, input.streaming);

        yield* executeChatGenerateWithContinuation(dispatchCreator, ctx.reqSignal, _d);
      } finally {
        _clearWatchdog();
      }
    }),

  /**
   * Delete an upstream-stored run by handle. One-shot, non-streaming, terminal: removes the
   * server-side resource (Gemini interaction / OpenAI response). Symmetric to `reattachContent`.
   */
  upstreamDeleteContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      upstreamHandle: AixWire_API.UpstreamHandle_schema, // { uht, runId, ... } - the schema strips unknown fields (createdAt/expiresAt)
    }))
    .mutation(async ({ input, ctx }) => {
      return await executeChatGenerateDelete(input.access, input.upstreamHandle, ctx.reqSignal);
    }),

});
