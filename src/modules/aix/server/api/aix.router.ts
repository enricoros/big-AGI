import * as z from 'zod/v4';

import { createEmptyReadableStream, createServerDebugWireEvents, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { AixAPI_Access, AixAPI_Context_ChatGenerate, AixWire_API, AixWire_API_ChatContentGenerate, AixWire_Particles } from './aix.wiretypes';
import { AixDemuxers } from '../dispatch/stream.demuxers';
import { ChatGenerateDispatch, ChatGenerateDispatchRequest, ChatGenerateParseFunction, createChatGenerateDispatch, createChatGenerateResumeDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { ChatGenerateTransmitter } from '../dispatch/chatGenerate/ChatGenerateTransmitter';
import { PerformanceProfiler } from '../dispatch/PerformanceProfiler';
import { heartbeatsWhileAwaiting } from '../dispatch/heartbeatsWhileAwaiting';


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


// --- Connection, Non-Streaming and Streaming Consumers ---

/**
 * Connects to the AI service dispatch endpoint.
 * Handles request echo debugging, fetch with heartbeats, and error handling.
 * Returns null if connection fails (error already handled and yielded).
 */
async function* _connectToDispatch(
  request: ChatGenerateDispatchRequest,
  intakeAbortSignal: AbortSignal,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: DebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, Response | null> {
  try {

    // [DEV] Debugging the request without requiring a server restart
    if (_d.echoRequest) {
      chatGenerateTx.addDebugRequest(!AIX_SECURITY_ONLY_IN_DEV_BUILDS, request.url, request.headers, 'body' in request ? request.body : undefined);
      yield* chatGenerateTx.emitParticles();
    }

    // Blocking fetch with heartbeats - combats timeouts, for instance with long Anthropic requests (>25s on large requests for Opus 3 models)
    _d.profiler?.measureStart('connect');
    const chatGenerateResponsePromise = fetchResponseOrTRPCThrow({
      ...request,
      signal: intakeAbortSignal,
      name: `Aix.${_d.prettyDialect}`,
      throwWithoutName: true,
    });
    const dispatchResponse = yield* heartbeatsWhileAwaiting(chatGenerateResponsePromise);
    _d.profiler?.measureEnd('connect');

    // Continue with the successful Fetch response (errors are caught below)
    return dispatchResponse;

  } catch (error: any) {
    // Handle expected dispatch abortion while the first fetch hasn't even completed
    if (error && error?.name === 'TRPCError' && intakeAbortSignal.aborted) {
      chatGenerateTx.setEnded('done-dispatch-aborted');
      yield* chatGenerateTx.flushParticles();
      return null; // signal caller to exit
    }

    // Handle AI Service connection error
    const dispatchFetchError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
    const extraDevMessage = AIX_SECURITY_ONLY_IN_DEV_BUILDS ? ` - [DEV_URL: ${request.url}]` : '';

    chatGenerateTx.setRpcTerminatingIssue('dispatch-fetch', `**[Service Issue] ${_d.prettyDialect}**: ${dispatchFetchError}${extraDevMessage}`, _d.consoleLogErrors);
    yield* chatGenerateTx.flushParticles();
    return null; // signal caller to exit
  }
}

/**
 * [NON-STREAMING] Consumes a unified (non-streaming) dispatch response
 * Reads entire body, parses once, emits particles.
 */
async function* _consumeDispatchUnified(
  dispatchResponse: Response,
  dispatchParserNS: ChatGenerateParseFunction,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: DebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {
  let dispatchBody: string | undefined = undefined;
  try {

    // Read the full response body with heartbeats
    _d.profiler?.measureStart('read-full');
    const fullBodyReadPromise = dispatchResponse.text();
    dispatchBody = yield* heartbeatsWhileAwaiting(fullBodyReadPromise);
    _d.profiler?.measureEnd('read-full');
    _d.wire?.onMessage(dispatchBody);

    // Parse the response in full
    _d.profiler?.measureStart('parse-full');
    dispatchParserNS(chatGenerateTx, dispatchBody);
    _d.profiler?.measureEnd('parse-full');

    // Normal termination with no more data
    chatGenerateTx.setEnded('done-dispatch-closed');

  } catch (error: any) {
    if (dispatchBody === undefined)
      chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Reading Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, true);
    else
      chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Parsing Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${dispatchBody}.\nPlease open a support ticket on GitHub.`, true);
  }
}

/**
 * [STREAMING] Consumes a streaming dispatch response with demuxing.
 * Reads chunks, demuxes events, parses each, emits particles.
 */
async function* _consumeDispatchStream(
  dispatchResponse: Response,
  dispatchDemuxerFormat: AixDemuxers.StreamDemuxerFormat,
  dispatchParser: ChatGenerateParseFunction,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: DebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  const dispatchReader = (dispatchResponse.body || createEmptyReadableStream()).getReader();
  const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> " " (U+FFFD) */ });
  const dispatchDemuxer = AixDemuxers.createStreamDemuxer(dispatchDemuxerFormat);

  // Data pump loop - for each chunk read from the dispatch stream
  do {

    // Stream... -> Events[] (& yield heartbeats)
    let demuxedEvents: AixDemuxers.DemuxedEvent[] = [];
    try {

      // 1. Blocking read with heartbeats
      _d.profiler?.measureStart('read');
      const chunkReadPromise = dispatchReader.read();
      const { done, value } = yield* heartbeatsWhileAwaiting(chunkReadPromise);
      _d.profiler?.measureEnd('read');

      // Handle normal dispatch stream closure (no more data, AI Service closed the stream)
      if (done) {
        chatGenerateTx.setEnded('done-dispatch-closed');
        break; // outer do {}
      }

      // 2. Decode the chunk - does Not throw (see the constructor for why)
      _d.profiler?.measureStart('decode');
      const chunk = dispatchDecoder.decode(value, { stream: true });
      _d.profiler?.measureEnd('decode');

      // 3. Demux the chunk into 0 or more events
      _d.profiler?.measureStart('demux');
      demuxedEvents = dispatchDemuxer.demux(chunk);
      _d.profiler?.measureEnd('demux');

    } catch (error: any) {
      // Handle expected dispatch stream abortion - nothing to do, as the intake is already closed
      // TODO: check if 'AbortError' is also a cause. Seems like ResponseAborted is NextJS vs signal driven.
      if (error && error?.name === 'ResponseAborted') {
        chatGenerateTx.setEnded('done-dispatch-aborted');
        break; // outer do {}
      }

      // Handle abnormal stream termination
      chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Streaming Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, true);
      break; // outer do {}
    }

    // ...Events[] -> parse() -> Particles* -> yield
    for (const demuxedItem of demuxedEvents) {
      _d.wire?.onMessage(demuxedItem);

      // ignore events post termination
      if (chatGenerateTx.isEnded) {
        // DEV-only message to fix dispatch protocol parsing -- warning on, because this is important and a sign of a bug
        console.warn('[chatGenerateContent] Received event after termination:', demuxedItem);
        break; // inner for {}, will break outer
      }

      // ignore unknown stream events
      if (demuxedItem.type !== 'event') {
        // console.log(`[chatGenerateContent] Ignoring non-event stream item of type "${demuxedItem.type}" with data:`, demuxedItem.data);
        continue; // inner for {}
      }

      // [OpenAI] Special: stream termination marker
      if (demuxedItem.data === '[DONE]') {
        chatGenerateTx.setEnded('done-dialect');
        break; // inner for {}, then outer do
      }

      try {

        // 4. Parse the event into particles queued for transmission
        _d.profiler?.measureStart('parse');
        dispatchParser(chatGenerateTx, demuxedItem.data, demuxedItem.name);
        _d.profiler?.measureEnd('parse');

        // 5. Emit any queued particles
        if (!chatGenerateTx.isEnded)
          yield* chatGenerateTx.emitParticles();

      } catch (error: any) {
        // Handle parsing issue (likely a schema break); print it to the console as well
        chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Service Parsing Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${demuxedItem.data}.\nPlease open a support ticket on GitHub.`, false);
        break; // inner for {}, then outer do
      }
    }

  } while (!chatGenerateTx.isEnded);
}


// --- ChatGenerate Core procedure ---

/**
 * Chat content generation implementation - unified for both chat and resume.
 * Accepts a dispatch creator function to handle both POST (chatGenerate) and GET (resume) requests.
 *
 * Can be called directly from server-side code or wrapped in retry logic, batching, etc.
 */
export async function* executeChatGenerate(
  dispatchCreatorFn: () => ChatGenerateDispatch,
  streaming: boolean,
  intakeAbortSignal: AbortSignal,
  _d: DebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  // AIX ChatGenerate Particles - Intake Transmitter
  const chatGenerateTx = new ChatGenerateTransmitter(_d.prettyDialect);

  // Create dispatch with error handling
  let dispatch: ChatGenerateDispatch;
  try {
    dispatch = dispatchCreatorFn();
  } catch (error: any) {
    chatGenerateTx.setRpcTerminatingIssue('dispatch-prepare', `**[AIX Configuration Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`, false);
    yield* chatGenerateTx.flushParticles();
    return; // exit
  }

  // Connect to the dispatch
  const dispatchResponse = yield* _connectToDispatch(dispatch.request, intakeAbortSignal, chatGenerateTx, _d);
  if (!dispatchResponse)
    return; // exit: error already handled

  // Consume dispatch response
  if (!streaming)
    yield* _consumeDispatchUnified(dispatchResponse, dispatch.chatGenerateParse, chatGenerateTx, _d);
  else
    yield* _consumeDispatchStream(dispatchResponse, dispatch.demuxerFormat, dispatch.chatGenerateParse, chatGenerateTx, _d);

  // Tack profiling particles if generated
  if (_d.profiler) {
    chatGenerateTx.addDebugProfilererData(_d.profiler.getResultsData());
    // performanceProfilerLog('AIX Router Performance', profiler?.getResultsData()); // uncomment to log to server console
    _d.profiler.clearMeasurements();
  }

  // Flush everything that's left; if we're here we have encountered a clean end condition,
  // or an error that has already been queued up for this last flush
  yield* chatGenerateTx.flushParticles();
}


// -- Utilities ---

function _createDebugConfig(access: AixAPI_Access, options: undefined | { debugDispatchRequest?: boolean, debugProfilePerformance?: boolean }, chatGenerateContextName: string) {
  const echoRequest = !!options?.debugDispatchRequest && (AIX_SECURITY_ONLY_IN_DEV_BUILDS || AIX_INSPECTOR_ALLOWED_CONTEXTS.includes(chatGenerateContextName));
  return {
    prettyDialect: serverCapitalizeFirstLetter(access.dialect), // string
    echoRequest: echoRequest, // boolean
    profiler: AIX_SECURITY_ONLY_IN_DEV_BUILDS && echoRequest && !!options?.debugProfilePerformance ? new PerformanceProfiler() : undefined, // PerformanceProfiler | undefined
    wire: createServerDebugWireEvents() ?? undefined, // ServerDebugWireEvents | undefined
    consoleLogErrors: !(access.dialect === 'openai' && access.oaiHost), // Exclude OpenAI Custom hosts (often self-hosted and buggy) from server-side console error logging
  };
}

type DebugObject = ReturnType<typeof _createDebugConfig>;


// --- AIX tRPC Router ---

export const aixRouter = createTRPCRouter({

  /**
   * Chat content generation, streaming, multipart.
   * Architecture: Client <-- (intake) --> Server <-- (dispatch) --> AI Service
   */
  chatGenerateContent: publicProcedure
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

      yield* executeChatGenerate(chatGenerateDispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

  /**
   * Chat content generation RESUME, streaming only.
   * Reconnects to an in-progress response by its ID - OpenAI Responses API only.
   */
  reattachContent: publicProcedure
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

      yield* executeChatGenerate(resumeDispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

});
