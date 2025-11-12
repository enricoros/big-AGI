import { createEmptyReadableStream, safeErrorString } from '~/server/wire';
import { createRetryablePromise, RetryAttempt } from '~/server/trpc/trpc.fetchers.retrier';
import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { AIX_SECURITY_ONLY_IN_DEV_BUILDS, AixDebugObject } from '../../api/aix.router';
import { AixWire_Particles } from '../../api/aix.wiretypes';

import { AixDemuxers } from '../stream.demuxers';
import { ChatGenerateDispatch, ChatGenerateDispatchRequest, ChatGenerateParseFunction } from './chatGenerate.dispatch';
import { ChatGenerateTransmitter } from './ChatGenerateTransmitter';
import { RequestRetryError } from './chatGenerate.retrier';
import { heartbeatsWhileAwaiting } from '../heartbeatsWhileAwaiting';


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
  _d: AixDebugObject,
  parseContext?: { retriesAvailable: boolean },
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  // AIX ChatGenerate Particles - Intake Transmitter
  const chatGenerateTx = new ChatGenerateTransmitter(_d.prettyDialect);

  // Create dispatch with error handling
  let dispatch: ChatGenerateDispatch;
  try {
    dispatch = dispatchCreatorFn();
  } catch (error: any) {
    // log but don't warn on the server console, this is typically a service configuration issue (e.g. a missing password will throw here)
    chatGenerateTx.setRpcTerminatingIssue('dispatch-prepare', `**[AIX Configuration Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown service preparation error'}`, 'srv-log');
    yield* chatGenerateTx.flushParticles();
    return; // exit
  }

  // Connect to the dispatch
  const dispatchResponse = yield* _connectToDispatch(dispatch.request, intakeAbortSignal, chatGenerateTx, _d);
  if (!dispatchResponse)
    return; // exit: error already handled

  // Consume dispatch response
  if (!streaming)
    yield* _consumeDispatchUnified(dispatchResponse, dispatch.chatGenerateParse, chatGenerateTx, _d, parseContext);
  else
    yield* _consumeDispatchStream(dispatchResponse, dispatch.demuxerFormat, dispatch.chatGenerateParse, chatGenerateTx, _d, parseContext);

  // Tack profiling particles if generated
  if (_d.profiler) {
    chatGenerateTx.addDebugProfilerData(_d.profiler.getResultsData());
    // performanceProfilerLog('AIX Router Performance', profiler?.getResultsData()); // uncomment to log to server console
    _d.profiler.clearMeasurements();
  }

  // Flush everything that's left; if we're here we have encountered a clean end condition,
  // or an error that has already been queued up for this last flush
  yield* chatGenerateTx.flushParticles();
}


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
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, Response | null> {

  // [DEV] Debugging the request without requiring a server restart
  if (_d.echoRequest) {
    try {
      chatGenerateTx.addDebugRequest(!AIX_SECURITY_ONLY_IN_DEV_BUILDS, request.url, request.headers, 'body' in request ? request.body : undefined);
      yield* chatGenerateTx.emitParticles();
    } catch (error: any) {
      // ...
    }
  }

  try {

    // Blocking fetch with heartbeats - combats timeouts, for instance with long Anthropic requests (>25s on large requests for Opus 3 models)
    _d.profiler?.measureStart('connect');
    const connectionOperationCreator = () => fetchResponseOrTRPCThrow({
      ...request,
      signal: intakeAbortSignal,
      name: `Aix.${_d.prettyDialect}`,
      throwWithoutName: true,
    });
    const onRetryAttempt = (info: RetryAttempt) => {
      // -> retry-server-dispatch
      chatGenerateTx.sendControl({ cg: 'retry-reset', rScope: 'srv-dispatch', rShallClear: false, reason: 'retrying initial connection', ...info });
    };
    const chatGenerateResponsePromise = createRetryablePromise(connectionOperationCreator, intakeAbortSignal, onRetryAttempt);
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
  _d: AixDebugObject,
  parseContext?: { retriesAvailable: boolean },
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
    dispatchParserNS(chatGenerateTx, dispatchBody, undefined, parseContext);
    _d.profiler?.measureEnd('parse-full');

    // Normal termination with no more data
    chatGenerateTx.setEnded('done-dispatch-closed');

  } catch (error: any) {
    if (dispatchBody === undefined)
      chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Reading Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, 'srv-warn');
    else
      chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Parsing Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\n\nInput data: ${dispatchBody}.\n\nPlease open a support ticket on GitHub.`, 'srv-warn');
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
  _d: AixDebugObject,
  parseContext?: { retriesAvailable: boolean },
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

      // Handle abnormal stream termination; print to the server console as well (important to debug)
      chatGenerateTx.setRpcTerminatingIssue('dispatch-read', `**[Streaming Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream reading error'}`, 'srv-warn');
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
        dispatchParser(chatGenerateTx, demuxedItem.data, demuxedItem.name, parseContext);
        _d.profiler?.measureEnd('parse');

        // 5. Emit any queued particles
        if (!chatGenerateTx.isEnded)
          yield* chatGenerateTx.emitParticles();

      } catch (error: any) {
        // special: pass-through ONLY our retriable errors, for full operation-level retry - these are thrown by Parsers to remand reconnection
        if (error instanceof RequestRetryError) throw error;

        // Handle parsing issue (likely a schema break); print it to the server console as well
        chatGenerateTx.setRpcTerminatingIssue('dispatch-parse', ` **[Service Parsing Issue] ${_d.prettyDialect}**: ${safeErrorString(error) || 'Unknown stream parsing error'}.\nInput data: ${demuxedItem.data}.\nPlease open a support ticket on GitHub.`, 'srv-warn');
        break; // inner for {}, then outer do
      }
    }

  } while (!chatGenerateTx.isEnded);
}
