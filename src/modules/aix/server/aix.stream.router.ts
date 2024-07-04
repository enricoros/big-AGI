import { createEmptyReadableStream, debugGenerateCurlCommand, nonTrpcServerFetchOrThrow, safeErrorString, SERVER_DEBUG_WIRE, serverCapitalizeFirstLetter } from '~/server/wire';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';

import type { DemuxedEvent } from './upstream.demuxers';
import { aixGenerateContentInputSchema } from '../shared/aix.shared.chat';
import { prepareUpstream } from './upstream';


// stream handler as a class
class DownstreamHandler {
  private upstreamReceivedEvents: number = 0;
  private debugReceivedLastMs: number | null = null;
  public downstreamTerminated: boolean = false;

  constructor(readonly prettyDialect: string) {
    // ...
  }

  onReceivedUpstreamEvent(demuxedEvent: DemuxedEvent) {
    this.upstreamReceivedEvents++;
    if (SERVER_DEBUG_WIRE) {
      const nowMs = Date.now();
      const elapsedMs = this.debugReceivedLastMs ? nowMs - this.debugReceivedLastMs : 0;
      this.debugReceivedLastMs = nowMs;
      console.log(`<- SSE (${elapsedMs} ms):`, demuxedEvent);
    }
  }

  async* handleStream() {
    // ...
  }

  * yieldStart() {
    yield {
      type: 'start',
    };
  }

  * yieldTermination(reasonId: 'upstream-close' | 'event-done' | 'parser-done') {
    if (SERVER_DEBUG_WIRE || true)
      console.log('|terminate|', reasonId, this.downstreamTerminated ? '(WARNING: already terminated)' : '');
    if (this.downstreamTerminated) return;
    yield {
      type: 'done',
    };
    this.downstreamTerminated = true;
  }

  * yieldError(errorId: 'upstream-prepare' | 'upstream-fetch' | 'upstream-read' | 'upstream-parse', errorText: string, forceErrorMessage?: boolean) {
    if (SERVER_DEBUG_WIRE || forceErrorMessage || true)
      console.error(`[POST] /api/llms/stream: ${this.prettyDialect}: ${errorId}: ${errorText}`);
    yield {
      issueId: errorId,
      issueText: errorText,
    };
    this.downstreamTerminated = true;
  }
}


export const aixRouter = createTRPCRouter({

  chatGenerateContentStream: publicProcedure
    .input(aixGenerateContentInputSchema)
    .mutation(async function* ({ input, ctx }) {

      // Derived state
      const { access, model, history } = input;
      const accessDialect = access.dialect;
      const prettyDialect = serverCapitalizeFirstLetter(accessDialect);

      // Downstream handler
      const downstreamHandler = new DownstreamHandler(prettyDialect);
      yield* downstreamHandler.yieldStart();

      // Prepare the upstream
      let upstreamData: ReturnType<typeof prepareUpstream>;
      try {
        upstreamData = prepareUpstream(access, model, history);
      } catch (error: any) {
        yield* downstreamHandler.yieldError('upstream-prepare', `**[Service Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`);
        return; // exit
      }

      // Connect to the upstream
      let upstreamResponse: Response;
      try {
        if (SERVER_DEBUG_WIRE)
          console.log('-> upstream CURL:', debugGenerateCurlCommand('POST', upstreamData.request.url, upstreamData.request.headers, upstreamData.request.body));

        // Blocking fetch - may timeout, for instance with long Anthriopic requests (>25s on Vercel)
        upstreamResponse = await nonTrpcServerFetchOrThrow(upstreamData.request.url, 'POST', upstreamData.request.headers, upstreamData.request.body);

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
          const { done, value } = await upstreamReader.read();

          // Handle normal stream termination
          if (done) {
            yield* downstreamHandler.yieldTermination('upstream-close');
            break; // outer do {}
          }

          // Decode the chunk - does Not throw (see the constructor for why)
          decodedChunk = upstreamDecoder.decode(value, { stream: true });
        } catch (error: any) {
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
              if (upe.op === 'parser-close') {
                yield* downstreamHandler.yieldTermination('parser-done');
                break;
              } else if (upe.op === 'text') {
                yield {
                  t: upe.text,
                };
              } else if (upe.op === 'issue') {
                yield {
                  t: ` [${prettyDialect} Issue] ${upe.issue}`,
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
            yield* downstreamHandler.yieldError('upstream-parse', ` **[Stream Parse Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}. Please open a support ticket.`);
            break; // inner for {}, then outer do
          }
        }

      } while (!downstreamHandler.downstreamTerminated);

      // End reached, with or without issues (but without unhandled exceptions!)
      // NOTE: we already send the termination (good exit) or issue (bad exit) on all code paths
      // yield* downstreamHandler.yieldEnd();

    }),

});


