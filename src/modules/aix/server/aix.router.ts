import { z } from 'zod';

import { createEmptyReadableStream, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { IntakeHandler } from './intake/IntakeHandler';
import { dispatchChatGenerate } from './dispatch/chatGenerate/dispatchChatGenerate';
import { intake_Access_Schema, intake_ChatGenerateRequest_Schema, intake_ContextChatStream_Schema, intake_Model_Schema } from './intake/schemas.intake.api';


export const aixRouter = createTRPCRouter({

  /**
   * Chat content generation, streaming, multipart.
   * Architecture: Client <-- (intake) --> Server <-- (dispatch) --> AI Service
   */
  chatGenerateContent: publicProcedure
    .input(z.object({
      access: intake_Access_Schema,
      model: intake_Model_Schema,
      chatGenerate: intake_ChatGenerateRequest_Schema,
      context: intake_ContextChatStream_Schema,
      streaming: z.boolean(),
      _debugRequestBody: z.boolean().optional(),
    }))
    .mutation(async function* ({ input, ctx }) {


      // Intake derived state
      const intakeAbortSignal = ctx.reqSignal;
      const { access, model, chatGenerate, streaming } = input;
      const accessDialect = access.dialect;
      const prettyDialect = serverCapitalizeFirstLetter(accessDialect);

      // Intake handlers
      const intakeHandler = new IntakeHandler(prettyDialect);
      yield* intakeHandler.yieldStart();


      // Prepare the dispatch
      let dispatch: ReturnType<typeof dispatchChatGenerate>;
      try {
        dispatch = dispatchChatGenerate(access, model, chatGenerate, streaming);

        // TEMP for debugging without requiring a full server restart
        if (input._debugRequestBody)
          yield { _debugClientPrint: JSON.stringify(dispatch.request.body, null, 2) };

      } catch (error: any) {
        yield* intakeHandler.yieldError('dispatch-prepare', `**[Configuration Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`);
        return; // exit
      }

      // Connect to the dispatch
      let dispatchResponse: Response;
      try {

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

        // Handle AI Service connection error
        const dispatchFetchError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
        const extraDevMessage = process.env.NODE_ENV === 'development' ? ` [DEV_URL: ${dispatch.request.url}]` : '';

        yield* intakeHandler.yieldError('dispatch-fetch', `**[Service Issue] ${prettyDialect}**: ${dispatchFetchError}${extraDevMessage}`, true);
        return; // exit
      }


      // [ALPHA] [NON-STREAMING] Read the full response and send operations down the intake
      if (!streaming) {
        try {
          const dispatchBody = await dispatchResponse.text();
          const messageAction = dispatch.parser(dispatchBody);
          yield* intakeHandler.yieldDmaOps(messageAction, prettyDialect);
        } catch (error: any) {
          yield* intakeHandler.yieldError('dispatch-read', `**[Service Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service reading error'}`);
        }
        return; // exit
      }


      // STREAM the response to the client
      const dispatchReader = (dispatchResponse.body || createEmptyReadableStream()).getReader();
      const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> “ ” (U+FFFD) */ });

      // Data pump: AI Service -- (dispatch) --> Server -- (intake) --> Client
      do {

        // Read AI Service chunk
        let dispatchChunk: string;
        try {
          const { done, value } = await dispatchReader.read();

          // Handle normal dispatch stream closure (no more data, AI Service closed the stream)
          if (done) {
            yield* intakeHandler.yieldTermination('dispatch-close');
            break; // outer do {}
          }

          // Decode the chunk - does Not throw (see the constructor for why)
          dispatchChunk = dispatchDecoder.decode(value, { stream: true });
        } catch (error: any) {
          // Handle expected dispatch stream abortion - nothing to do, as the intake is already closed
          if (error && error?.name === 'ResponseAborted') {
            intakeHandler.markTermination();
            break; // outer do {}
          }

          // Handle abnormal stream termination
          yield* intakeHandler.yieldError('dispatch-read', `**[Streaming Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`);
          break; // outer do {}
        }


        // Demux the chunk into 0 or more events
        for (const demuxedItem of dispatch.demuxer.demux(dispatchChunk)) {
          intakeHandler.onReceivedDispatchEvent(demuxedItem);

          // ignore events post termination
          if (intakeHandler.intakeTerminated) {
            // warning on, because this is important and a sign of a bug
            console.warn('[chatGenerateContent] Received event after termination:', demuxedItem);
            break; // inner for {}
          }

          // ignore superfluos stream events
          if (demuxedItem.type !== 'event')
            continue; // inner for {}

          // [OpenAI] Special: stream termination marker
          if (demuxedItem.data === '[DONE]') {
            yield* intakeHandler.yieldTermination('event-done');
            break; // inner for {}, then outer do
          }

          try {
            const messageAction = dispatch.parser(demuxedItem.data, demuxedItem.name);
            yield* intakeHandler.yieldDmaOps(messageAction, prettyDialect);
          } catch (error: any) {
            console.warn('[chatGenerateContent] Error parsing dispatch stream event:', demuxedItem, error);
            yield* intakeHandler.yieldError('dispatch-parse', ` **[Service Parsing Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}. Please open a support ticket.`);
            break; // inner for {}, then outer do
          }
        }

      } while (!intakeHandler.intakeTerminated);

      // We already send the termination event (good exit) or issue (bad exit) on all code
      // paths to the intake, or the intake has already closed the socket on us.
      // So there's nothing to do here.
      // yield* intakeHandler.yieldEnd();

    }),

});
