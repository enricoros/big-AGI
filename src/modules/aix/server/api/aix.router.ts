import * as z from 'zod/v4';

import { createServerDebugWireEvents, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { AixAPI_Access, AixAPI_Context_ChatGenerate, AixWire_API, AixWire_API_ChatContentGenerate } from './aix.wiretypes';
import { PerformanceProfiler } from '../dispatch/PerformanceProfiler';
import { createChatGenerateDispatch, createChatGenerateResumeDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithRetry } from '../dispatch/chatGenerate/chatGenerate.retrier';


// -- Utilities ---

export type AixDebugObject = ReturnType<typeof _createDebugConfig>;

/**
 * Security - only allow certain operations in development builds (i.e. not in any production builds by default):
 *  1. dispatch Headers: hide sensitive data such as keys
 *  2. Performance profiling: visible in the AIX debugger when requested on development builds
 *  3. 'DEV_URL: ...' in error messages to show the problematic upstream URL
 *  4. onComment on SSE streams
 */
export const AIX_SECURITY_ONLY_IN_DEV_BUILDS = process.env.NODE_ENV === 'development';

/**
 * Production-allowed contexts for AIX inspector.
 * These are the only contexts that can be captured in production builds for security.
 */
const AIX_INSPECTOR_ALLOWED_CONTEXTS: (AixAPI_Context_ChatGenerate['name'] | string)[] = [
  'beam-followup',
  'beam-gather',
  'beam-scatter',
  'chat-react-turn',
  'conversation',
  'scratch-chat',
] as const;

function _createDebugConfig(access: AixAPI_Access, options: undefined | { debugDispatchRequest?: boolean, debugProfilePerformance?: boolean }, chatGenerateContextName: string) {
  const echoRequest = !!options?.debugDispatchRequest && (AIX_SECURITY_ONLY_IN_DEV_BUILDS || AIX_INSPECTOR_ALLOWED_CONTEXTS.includes(chatGenerateContextName));
  const consoleLogErrors =
    (access.dialect === 'openai' && access.oaiHost) ? false as const // do not server-log OpenAI Custom hosts (often self-hosted and buggy) from server-side console error logging
      : 'srv-warn' as const; // keeping the highest level of server-side logging for 'fetching' issues (usually however we see the messages of the TRPC retrier `createRetryablePromise` already)
  return {
    prettyDialect: serverCapitalizeFirstLetter(access.dialect), // string
    echoRequest: echoRequest, // boolean
    profiler: AIX_SECURITY_ONLY_IN_DEV_BUILDS && echoRequest && !!options?.debugProfilePerformance ? new PerformanceProfiler() : undefined, // PerformanceProfiler | undefined
    wire: createServerDebugWireEvents() ?? undefined, // ServerDebugWireEvents | undefined
    consoleLogErrors,
  };
}


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

      yield* executeChatGenerateWithRetry(chatGenerateDispatchCreator, input.streaming, ctx.reqSignal, _d);
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

      yield* executeChatGenerateWithRetry(resumeDispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

});
