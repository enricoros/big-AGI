import { z } from 'zod';

import { createEmptyReadableStream, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { IntakeHandler } from './intake/IntakeHandler';
import { createDispatch } from './dispatch/createDispatch';
import { intakeAccessSchema, intakeChatGenerateRequestSchema, intakeContextChatStreamSchema, intakeModelSchema } from './intake/schemas.intake.api';


export const aixRouter = createTRPCRouter({

  /**
   * Chat content generation, streaming, multipart.
   * Architecture: Client <-- (intake) --> Server <-- (dispatch) --> AI Service
   */
  chatGenerateContentStream: publicProcedure
    .input(z.object({
      access: intakeAccessSchema,
      model: intakeModelSchema,
      chatGenerate: intakeChatGenerateRequestSchema,
      context: intakeContextChatStreamSchema,
    }))
    .mutation(async function* ({ input, ctx }) {

      // Using the variable to keep the implementation generic
      const streaming = true;

      // Intake derived state
      const intakeAbortSignal = ctx.reqSignal;
      const { access, model, chatGenerate } = input;
      const accessDialect = access.dialect;
      const prettyDialect = serverCapitalizeFirstLetter(accessDialect);

      // Intake handlers
      const intakeHandler = new IntakeHandler(prettyDialect);
      yield* intakeHandler.yieldStart();


      // Prepare the dispatch
      let dispatch: ReturnType<typeof createDispatch>;
      try {
        dispatch = createDispatch(access, model, chatGenerate, streaming);
      } catch (error: any) {
        yield* intakeHandler.yieldError('dispatch-prepare', `**[Service Creation Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`);
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


      // Stream the response to the client
      const dispatchReader = (dispatchResponse.body || createEmptyReadableStream()).getReader();
      const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> “ ” (U+FFFD) */ });
      const dispatchDemuxer = dispatch.demuxer.demux;
      const dispatchParser = dispatch.parser;

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
        for (const demuxedEvent of dispatchDemuxer(dispatchChunk)) {
          intakeHandler.onReceivedDispatchEvent(demuxedEvent);

          // ignore events post termination
          if (intakeHandler.intakeTerminated) {
            // warning on, because this is pretty important
            console.warn('/api/llms/stream: Received event after termination:', demuxedEvent);
            break; // inner for {}
          }

          // ignore superfluos stream events
          if (demuxedEvent.type !== 'event')
            continue; // inner for {}

          // [OpenAI] Special: event stream termination, close our transformed stream
          if (demuxedEvent.data === '[DONE]') {
            yield* intakeHandler.yieldTermination('event-done');
            break; // inner for {}, then outer do
          }

          try {
            const parsedEvents = dispatchParser(demuxedEvent.data, demuxedEvent.name);
            for (const upe of parsedEvents) {
              console.log('parsed dispatch:', upe);
              // TODO: massively rework this into a good protocol
              if (upe.op === 'parser-close') {
                yield* intakeHandler.yieldTermination('parser-done');
                break;
              } else if (upe.op === 'text') {
                yield* intakeHandler.yieldOp({
                  t: upe.text,
                });
              } else if (upe.op === 'issue') {
                yield* intakeHandler.yieldOp({
                  t: ` ${upe.symbol} **[${prettyDialect} Issue]:** ${upe.issue}`,
                });
              } else if (upe.op === 'set') {
                yield* intakeHandler.yieldOp({
                  set: upe.value,
                });
              } else {
                // shall never reach this
                console.error('Unexpected stream event:', upe);
              }
            }
          } catch (error: any) {
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
