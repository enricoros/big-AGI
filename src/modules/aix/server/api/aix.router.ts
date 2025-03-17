import { z } from 'zod';

import { createEmptyReadableStream, createServerDebugWireEvents, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { AixDemuxers } from '../dispatch/stream.demuxers';
import { AixWire_API, AixWire_API_ChatContentGenerate, AixWire_Particles } from './aix.wiretypes';
import { ChatGenerateTransmitter } from '../dispatch/chatGenerate/ChatGenerateTransmitter';
import { PerformanceProfiler } from '../dispatch/PerformanceProfiler';
import { createChatGenerateDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { heartbeatsWhileAwaiting } from '../dispatch/heartbeatsWhileAwaiting';


/**
 * Security - only allow certain operations in development builds (i.e. not in any production builds by default):
 *  1. dispatch Headers: hide sensitive data such as keys
 *  2. Performance profiling: visible in the AIX debugger when requested on development builds
 *  3. 'DEV_URL: ...' in error messages to show the problematic upstream URL
 *  4. onComment on SSE streams
 */
export const AIX_SECURITY_ONLY_IN_DEV_BUILDS = process.env.NODE_ENV === 'development';


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
      connectionOptions: AixWire_API.ConnectionOptions_schema.optional(),
    }))
    .mutation(async function* ({ input, ctx }): AsyncGenerator<AixWire_Particles.ChatGenerateOp> {


      // Intake derived state
      const intakeAbortSignal = ctx.reqSignal;
      const { access, model, chatGenerate, streaming, connectionOptions } = input;
      const accessDialect = access.dialect;
      const prettyDialect = serverCapitalizeFirstLetter(accessDialect);


      // Intake Transmitters
      const chatGenerateTx = new ChatGenerateTransmitter(prettyDialect, connectionOptions?.throttlePartTransmitter);


      // Profiler, if requested by the caller
      const _profiler = (input.connectionOptions?.debugProfilePerformance && AIX_SECURITY_ONLY_IN_DEV_BUILDS)
        ? new PerformanceProfiler() : null;

      const _profilerCompleted = !_profiler ? null : () => {
        // append to the response, if requested by the client
        if (input.connectionOptions?.debugProfilePerformance)
          chatGenerateTx.addDebugProfilererData(_profiler?.getResultsData());

        // [DEV] uncomment this line to see the profiler table in the server-side console
        // performanceProfilerLog('AIX Router Performance', _profiler?.getResultsData());

        // clear the profiler for the next call, for resident lambdas (the profiling framework is global)
        _profiler?.clearMeasurements();
      };


      // Prepare the dispatch requests
      let dispatch: ReturnType<typeof createChatGenerateDispatch>;
      try {
        dispatch = createChatGenerateDispatch(access, model, chatGenerate, streaming);
      } catch (error: any) {
        chatGenerateTx.setRpcTerminatingIssue('dispatch-prepare', `**[AIX Configuration Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`, false);
        yield* chatGenerateTx.flushParticles();
        return; // exit
      }

      // Connect to the dispatch
      let dispatchResponse: Response;
      try {

        // [DEV] Debugging the request without requiring a server restart
        if (input.connectionOptions?.debugDispatchRequest) {
          chatGenerateTx.addDebugRequestInDev(dispatch.request.url, dispatch.request.headers, dispatch.request.body);
          yield* chatGenerateTx.emitParticles();
        }

        // Blocking fetch with heartbeats - combats timeouts, for instance with long Anthriopic requests (>25s on Vercel)
        _profiler?.measureStart('connect');
        dispatchResponse = yield* heartbeatsWhileAwaiting(fetchResponseOrTRPCThrow({
          url: dispatch.request.url,
          method: 'POST',
          headers: dispatch.request.headers,
          body: dispatch.request.body,
          signal: intakeAbortSignal,
          name: `Aix.${prettyDialect}`,
          throwWithoutName: true,
        }));
        _profiler?.measureEnd('connect');

      } catch (error: any) {
        // Handle expected dispatch abortion while the first fetch hasn't even completed
        if (error && error?.name === 'TRPCError' && intakeAbortSignal.aborted) {
          chatGenerateTx.setEnded('done-dispatch-aborted');
          yield* chatGenerateTx.flushParticles();
          return; // exit
        }

        // Handle AI Service connection error
        const dispatchFetchError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
        const extraDevMessage = AIX_SECURITY_ONLY_IN_DEV_BUILDS ? ` - [DEV_URL: ${dispatch.request.url}]` : '';

        const showOnConsoleForNonCustomServers = access.dialect !== 'openai' || !access.oaiHost;
        chatGenerateTx.setRpcTerminatingIssue('dispatch-fetch', `**[Service Issue] ${prettyDialect}**: ${dispatchFetchError}${extraDevMessage}`, showOnConsoleForNonCustomServers);
        yield* chatGenerateTx.flushParticles();
        return; // exit
      }


      // [NON-STREAMING] Read the full response and send operations down the intake
      const serverDebugIncomingPackets = createServerDebugWireEvents();
      if (!streaming) {
        let dispatchBody: string | undefined = undefined;
        try {
          // Read the full response body with heartbeats
          _profiler?.measureStart('read-full');
          dispatchBody = yield* heartbeatsWhileAwaiting(dispatchResponse.text());
          _profiler?.measureEnd('read-full');
          serverDebugIncomingPackets?.onMessage(dispatchBody);

          // Parse the response in full
          dispatch.chatGenerateParse(chatGenerateTx, dispatchBody);
          chatGenerateTx.setEnded('done-dispatch-closed');

        } catch (error: any) {
          if (dispatchBody === undefined)
            chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Reading Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, true);
          else
            chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Parsing Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${dispatchBody}.\nPlease open a support ticket on GitHub.`, true);
        }
        _profilerCompleted?.();
        yield* chatGenerateTx.flushParticles();
        return; // exit
      }


      // STREAM the response to the client
      const dispatchReader = (dispatchResponse.body || createEmptyReadableStream()).getReader();
      const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> “ ” (U+FFFD) */ });
      const dispatchDemuxer = AixDemuxers.createStreamDemuxer(dispatch.demuxerFormat);
      const dispatchParser = dispatch.chatGenerateParse;

      // Data pump: AI Service -- (dispatch) --> Server -- (intake) --> Client
      do {

        // Read AI Service chunk
        let dispatchChunk: string;
        try {
          _profiler?.measureStart('read');
          const { done, value } = yield* heartbeatsWhileAwaiting(dispatchReader.read());
          _profiler?.measureEnd('read');

          // Handle normal dispatch stream closure (no more data, AI Service closed the stream)
          if (done) {
            chatGenerateTx.setEnded('done-dispatch-closed');
            break; // outer do {}
          }

          // Decode the chunk - does Not throw (see the constructor for why)
          _profiler?.measureStart('decode');
          dispatchChunk = dispatchDecoder.decode(value, { stream: true });
          _profiler?.measureEnd('decode');
        } catch (error: any) {
          // Handle expected dispatch stream abortion - nothing to do, as the intake is already closed
          if (error && error?.name === 'ResponseAborted') {
            chatGenerateTx.setEnded('done-dispatch-aborted');
            break; // outer do {}
          }

          // Handle abnormal stream termination
          chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Streaming Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, true);
          break; // outer do {}
        }


        // Demux the chunk into 0 or more events
        _profiler?.measureStart('demux');
        const demuxedEvents = dispatchDemuxer.demux(dispatchChunk);
        _profiler?.measureEnd('demux');

        for (const demuxedItem of demuxedEvents) {
          serverDebugIncomingPackets?.onMessage(demuxedItem);

          // ignore events post termination
          if (chatGenerateTx.isEnded) {
            // DEV-only message to fix dispatch protocol parsing -- warning on, because this is important and a sign of a bug
            console.warn('[chatGenerateContent] Received event after termination:', demuxedItem);
            break; // inner for {}
          }

          // ignore superfluos stream events
          if (demuxedItem.type !== 'event')
            continue; // inner for {}

          // [OpenAI] Special: stream termination marker
          if (demuxedItem.data === '[DONE]') {
            chatGenerateTx.setEnded('done-dialect');
            break; // inner for {}, then outer do
          }

          try {
            _profiler?.measureStart('parse');
            dispatchParser(chatGenerateTx, demuxedItem.data, demuxedItem.name);
            _profiler?.measureEnd('parse');
            if (!chatGenerateTx.isEnded)
              yield* chatGenerateTx.emitParticles();
          } catch (error: any) {
            // Handle parsing issue (likely a schema break); print it to the console as well
            chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Service Parsing Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${demuxedItem.data}.\nPlease open a support ticket on GitHub.`, false);
            break; // inner for {}, then outer do
          }
        }

      } while (!chatGenerateTx.isEnded);

      _profilerCompleted?.();

      // Flush everything that's left; if we're here we have encountered a clean end condition,
      // or an error that has already been queued up for this last flush
      yield* chatGenerateTx.flushParticles();

    }),

});
