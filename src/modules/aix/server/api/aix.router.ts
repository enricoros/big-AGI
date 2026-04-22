import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { _createDebugConfig } from '../dispatch/chatGenerate/chatGenerate.debug';
import { createChatGenerateDispatch, createChatGenerateResumeDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithContinuation } from '../dispatch/chatGenerate/chatGenerate.continuation';

import { AixWire_API, AixWire_API_ChatContentGenerate } from './aix.wiretypes';


// --- AIX tRPC Router ---

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
      const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
      const dispatchCreator = () => createChatGenerateDispatch(input.access, input.model, input.chatGenerate, input.streaming, !!input.connectionOptions?.enableResumability);

      yield* executeChatGenerateWithContinuation(dispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

  /**
   * Chat content generation - reattach to an in-progress upstream run by handle, streaming only.
   * Today: OpenAI Responses API (network-disconnect recovery) and Gemini Interactions (Deep Research across reloads).
   */
  reattachContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      resumeHandle: AixWire_API.ResumeHandle_schema, // reattach uses a handle instead of 'model + chatGenerate'
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.literal(true), // reattach is always streaming
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.pick({ debugDispatchRequest: true }).optional(), // debugDispatchRequest
    }))
    .mutation(async function* ({ input, ctx }) {
      const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
      const dispatchCreator = () => createChatGenerateResumeDispatch(input.access, input.resumeHandle, input.streaming);

      yield* executeChatGenerateWithContinuation(dispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

});
