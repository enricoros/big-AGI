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
      const chatGenerateDispatchCreator = () => createChatGenerateDispatch(input.access, input.model, input.chatGenerate, input.streaming, !!input.connectionOptions?.enableResumability);
      const parseContext = {
        modelId: input.model.id,
        contextName: input.context.name,
        contextRef: input.context.ref,
        conversationId: input.context.name === 'conversation' ? input.context.ref : undefined,
      } as const;

      yield* executeChatGenerateWithContinuation(chatGenerateDispatchCreator, input.streaming, ctx.reqSignal, _d, parseContext);
    }),

  /**
   * Chat content generation RESUME, streaming only.
   * Reconnects to an in-progress response by its ID - OpenAI Responses API only.
   */
  reattachContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      resumeHandle: AixWire_API.ResumeHandle_schema, // resume has a handle instead of 'model + chatGenerate'
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.literal(true), // resume is always streaming
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.pick({ debugDispatchRequest: true }).optional(), // debugDispatchRequest
    }))
    .mutation(async function* ({ input, ctx }) {
      const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
      const resumeDispatchCreator = () => createChatGenerateResumeDispatch(input.access, input.resumeHandle, input.streaming);
      const parseContext = {
        contextName: input.context.name,
        contextRef: input.context.ref,
        conversationId: input.context.name === 'conversation' ? input.context.ref : undefined,
      } as const;

      yield* executeChatGenerateWithContinuation(resumeDispatchCreator, input.streaming, ctx.reqSignal, _d, parseContext);
    }),

});
