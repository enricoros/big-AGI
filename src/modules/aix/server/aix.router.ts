import { z } from 'zod';

import { createEmptyReadableStream, safeErrorString, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { fetchResponseOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { prepareDispatch } from './dispatch/prepareDispatch';
import { IntakeHandler } from '~/modules/aix/server/intake/IntakeHandler';

import { aixAccessSchema, aixHistorySchema, aixModelSchema, aixStreamingContextSchema } from '~/modules/aix/server/intake/aix.types';
import { aixToolsPolicySchema, aixToolsSchema } from '~/modules/aix/server/intake/aix.tool.types';


// export type AixGenerateContentInput = z.infer<typeof aixGenerateContentInputSchema>;

export const aixGenerateContentInputSchema = z.object({
  access: aixAccessSchema,
  model: aixModelSchema,
  history: aixHistorySchema,
  tools: aixToolsSchema.optional(),
  toolPolicy: aixToolsPolicySchema.optional(),
  context: aixStreamingContextSchema,
  // stream? -> discriminated via the rpc function name
});


export const aixRouter = createTRPCRouter({

  chatGenerateContentStream: publicProcedure
    .input(aixGenerateContentInputSchema)
    .mutation(async function* ({ input, ctx }) {

      // Derived state
      const clientAbortSignal = ctx.reqSignal;
      const { access, model, history } = input;
      const accessDialect = access.dialect;
      const prettyDialect = serverCapitalizeFirstLetter(accessDialect);

      // Downstream handler
      const downstreamHandler = new IntakeHandler(prettyDialect);
      yield* downstreamHandler.yieldStart();

      // Prepare the upstream
      let upstreamData: ReturnType<typeof prepareDispatch>;
      try {
        upstreamData = prepareDispatch(access, model, history);
      } catch (error: any) {
        yield* downstreamHandler.yieldError('upstream-prepare', `**[Service Prepare Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`);
        return; // exit
      }

      // Connect to the upstream
      let upstreamResponse: Response;
      try {

        // Blocking fetch - may timeout, for instance with long Anthriopic requests (>25s on Vercel)
        upstreamResponse = await fetchResponseOrTRPCThrow({
          url: upstreamData.request.url,
          method: 'POST',
          headers: upstreamData.request.headers,
          body: upstreamData.request.body,
          signal: clientAbortSignal,
          name: `Aix.${prettyDialect}`,
          throwWithoutName: true,
        });

      } catch (error: any) {

        // server-side admins message
        const fetchOrVendorError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
        const extraDevMessage = process.env.NODE_ENV === 'development' ? ` [DEV_URL: ${upstreamData.request.url}]` : '';

        // return a response to the client
        // NOTE: in the non-tRPC solution we had:
        //   const statusCode = ((error instanceof ServerFetchError) && (error.statusCode >= 400)) ? error.statusCode : 422;
        //   return new NextResponse(..., { status: statusCode, });
        yield* downstreamHandler.yieldError('upstream-fetch', `**[Service Issue] ${prettyDialect}**: ${fetchOrVendorError}${extraDevMessage}`, true);
        return; // exit
      }

      // Stream the response to the client
      const upstreamReader = (upstreamResponse.body || createEmptyReadableStream()).getReader();
      const upstreamDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> “ ” (U+FFFD) */ });
      const upstreamDemuxer = upstreamData.demuxer.demux;
      const upstreamParser = upstreamData.parser;

      // Data pump: upstream -> downstream
      do {

        // Read upstream chunk
        let decodedChunk: string;
        try {
          // NOTE: this is going to break when the upstream stream is closed by the signal
          const { done, value } = await upstreamReader.read();

          // Handle normal stream termination
          if (done) {
            yield* downstreamHandler.yieldTermination('upstream-close');
            break; // outer do {}
          }

          // Decode the chunk - does Not throw (see the constructor for why)
          decodedChunk = upstreamDecoder.decode(value, { stream: true });
        } catch (error: any) {
          // Handle expected upstream stream abortion - nothing to do, as the downstream is already closed
          if (error && error?.name === 'ResponseAborted') {
            downstreamHandler.markTermination();
            break; // outer do {}
          }

          // Handle abnormal stream termination
          yield* downstreamHandler.yieldError('upstream-read', `**[Streaming Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`);
          break; // outer do {}
        }


        // Demux the chunk into 0 or more events
        for (const demuxedEvent of upstreamDemuxer(decodedChunk)) {
          downstreamHandler.onReceivedUpstreamEvent(demuxedEvent);

          // ignore events post termination
          if (downstreamHandler.downstreamTerminated) {
            // warning on, because this is pretty important
            console.warn('/api/llms/stream: Received event after termination:', demuxedEvent);
            break; // inner for {}
          }

          // ignore superfluos stream events
          if (demuxedEvent.type !== 'event')
            continue; // inner for {}

          // [OpenAI] Special: event stream termination, close our transformed stream
          if (demuxedEvent.data === '[DONE]') {
            yield* downstreamHandler.yieldTermination('event-done');
            break; // inner for {}, then outer do
          }

          try {
            const parsedEvents = upstreamParser(demuxedEvent.data, demuxedEvent.name);
            for (const upe of parsedEvents) {
              console.log('parsedUpstream:', upe);
              // TODO: massively rework this into a good protocol
              if (upe.op === 'parser-close') {
                yield* downstreamHandler.yieldTermination('parser-done');
                break;
              } else if (upe.op === 'text') {
                yield {
                  t: upe.text,
                };
              } else if (upe.op === 'issue') {
                yield {
                  t: ` ${upe.symbol} **[${prettyDialect} Issue]:** ${upe.issue}`,
                };
              } else if (upe.op === 'set') {
                yield {
                  set: upe.value,
                };
              } else {
                // shall never reach this
                console.error('Unexpected stream event:', upe);
              }
            }
          } catch (error: any) {
            yield* downstreamHandler.yieldError('upstream-parse', ` **[Upstream Parse Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}. Please open a support ticket.`);
            break; // inner for {}, then outer do
          }
        }

      } while (!downstreamHandler.downstreamTerminated);

      // End reached, with or without issues or downstream connectivity
      // NOTE: we already send the termination (good exit) or issue (bad exit) on all code paths,
      //       or the downstream has already closed to socket on us
      // yield* downstreamHandler.yieldEnd();

    }),

});


