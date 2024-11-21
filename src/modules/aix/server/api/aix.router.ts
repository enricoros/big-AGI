import { z } from 'zod';

import { createEmptyReadableStream, createServerDebugWireEvents, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { AixWire_API, AixWire_API_ChatContentGenerate, AixWire_Particles } from './aix.wiretypes';
import { ChatGenerateTransmitter } from '../dispatch/chatGenerate/ChatGenerateTransmitter';
import { createChatGenerateDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { createStreamDemuxer } from '../dispatch/stream.demuxers';


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
        if (input.connectionOptions?.debugDispatchRequestbody) {
          chatGenerateTx.addDebugRequestInDev(dispatch.request.url, dispatch.request.headers, dispatch.request.body);
          yield* chatGenerateTx.emitParticles();
        }

        // Blocking fetch - may timeout, for instance with long Anthriopic requests (>25s on Vercel)
        dispatchResponse = await fetchResponseOrTRPCThrow({
          url: dispatch.request.url,
          method: 'POST',
          headers: dispatch.request.headers,
          body: dispatch.request.body,
          signal: intakeAbortSignal,
          name: `Aix.${prettyDialect}`,
          throwWithoutName: true,
        });

      } catch (error: any) {
        // Handle expected dispatch abortion while the first fetch hasn't even completed
        if (error && error?.name === 'TRPCError' && intakeAbortSignal.aborted) {
          chatGenerateTx.setEnded('done-dispatch-aborted');
          yield* chatGenerateTx.flushParticles();
          return; // exit
        }

        // Handle AI Service connection error
        const dispatchFetchError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
        const extraDevMessage = process.env.NODE_ENV === 'development' ? ` - [DEV_URL: ${dispatch.request.url}]` : '';

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
          // Read the full response body
          dispatchBody = await dispatchResponse.text();
          serverDebugIncomingPackets?.onMessage(dispatchBody);

          // Parse the response in full
          dispatch.chatGenerateParse(chatGenerateTx, dispatchBody);
          chatGenerateTx.setEnded('done-dispatch-closed');

        } catch (error: any) {
          if (dispatchBody === undefined)
            chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Reading Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, true);
          else
            chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Parsing Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${dispatchBody}.\nPlease open a support ticket.`, true);
        }
        yield* chatGenerateTx.flushParticles();
        return; // exit
      }


      // STREAM the response to the client
      const dispatchReader = (dispatchResponse.body || createEmptyReadableStream()).getReader();
      const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> “ ” (U+FFFD) */ });
      const dispatchDemuxer = createStreamDemuxer(dispatch.demuxerFormat);
      const dispatchParser = dispatch.chatGenerateParse;

      // Data pump: AI Service -- (dispatch) --> Server -- (intake) --> Client
      do {

        // Read AI Service chunk
        let dispatchChunk: string;
        try {
          const { done, value } = await dispatchReader.read();

          // Handle normal dispatch stream closure (no more data, AI Service closed the stream)
          if (done) {
            chatGenerateTx.setEnded('done-dispatch-closed');
            break; // outer do {}
          }

          // Decode the chunk - does Not throw (see the constructor for why)
          dispatchChunk = dispatchDecoder.decode(value, { stream: true });
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
        for (const demuxedItem of dispatchDemuxer.demux(dispatchChunk)) {
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
            dispatchParser(chatGenerateTx, demuxedItem.data, demuxedItem.name);
            if (!chatGenerateTx.isEnded)
              yield* chatGenerateTx.emitParticles();
          } catch (error: any) {
            // Handle parsing issue (likely a schema break); print it to the console as well
            chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Service Parsing Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${demuxedItem.data}.\nPlease open a support ticket.`, false);
            break; // inner for {}, then outer do
          }
        }

      } while (!chatGenerateTx.isEnded);

      // Flush everything that's left; if we're here we have encountered a clean end condition,
      // or an error that has already been queued up for this last flush
      yield* chatGenerateTx.flushParticles();

    }),

});
