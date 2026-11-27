import { createEmptyReadableStream, safeErrorString } from '~/server/wire';
import { fetchResponseOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';
import { fetchWithAbortableConnectionRetry, RetryAttempt } from '~/server/trpc/trpc.fetchers.retrier';

import { llmAppIdentityHeaders } from '~/modules/llms/shared/llm.appIdentity';

import { isBrowserNetworkError, isBrowserOffline, isEdgeConnectionLost, isNodeStreamTerminated } from '~/common/util/fetchFailures';
import { objectDeepCloneWithStringLimit } from '~/common/util/objectUtils';

import { AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../../api/aix.security';
import { AixWire_Particles } from '../../api/aix.wiretypes';
import { aixIssue, type DAixIssue } from '../../../shared/aix.issues';

import { AixDebugObject } from './chatGenerate.debug';
import { AixDemuxers } from '../stream.demuxers';
import { ChatGenerateDispatch, ChatGenerateDispatchRequest, ChatGenerateParseContext, ChatGenerateParseFunction } from './chatGenerate.dispatch';
import { ChatGenerateTransmitter } from './ChatGenerateTransmitter';
import { DispatchContinuationSignal } from './chatGenerate.continuation';
import { OperationRetrySignal } from './chatGenerate.operation-retry';
import { heartbeatsWhileAwaiting } from '../heartbeatsWhileAwaiting';


/**
 * Local replacement for Promise.withResolvers (ES2024). Native in Node 22+/Edge, but this file
 * ships to the browser via AIX client-side-fetch (CSF), where older browsers (Safari < 17.4,
 * Chrome < 119, Firefox < 121) lack it. This manual form works on every runtime.
 */
function promiseWithResolvers<T>(): { promise: Promise<T>, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/**
 * The record for a failure while reading the service response, shared by the streaming and non-streaming consumers.
 * A dropped connection keeps the runtime's own text as the detail: [CSF] a browser drop (e.g. Firefox 'Error in input stream', #1211),
 * [server] a Node fetch drop ('terminated') or a Vercel Edge one ('Network connection lost.'). Anything else is an unexpected read error.
 */
function _readFailureIssue(error: any, _d: AixDebugObject): DAixIssue {
  const dropped = isBrowserNetworkError(error) || isNodeStreamTerminated(error) || isEdgeConnectionLost(error);
  return aixIssue('dispatch-read', 'failed', {
    runtime: _d.runtime,
    detail: dropped ? error.message : (safeErrorString(error) || 'Unknown stream reading error'),
    ...(!dropped && { text: 'Reading the response failed.' }),
    ...(dropped && isBrowserOffline() && { offline: true }),
  });
}

// class names say nothing about a connection failure: only a system code (ECONNREFUSED, UND_ERR_CONNECT_TIMEOUT) is a cause code
const _BARE_ERROR_NAMES = ['Error', 'TypeError', 'AggregateError', 'DOMException', 'UnknownError'];

/**
 * The record for a failure to get a response from the service, from the TRPCFetcherError facts: an HTTP status with the
 * vendor's words and code, or a connection failure with the runtime's own words. No advice: that is the renderer's.
 */
function _connectFailureIssue(error: any, _d: AixDebugObject): DAixIssue {
  const fe: TRPCFetcherError | null = error?.name === 'TRPCFetcherError' ? error : null;
  if (fe?.category === 'http')
    return aixIssue('dispatch-http', 'failed', { httpStatus: fe.httpStatus, causeCode: fe.httpErrorCode ?? fe.httpErrorType, retryAfterMs: fe.httpRetryAfterMs, detail: fe.causeText });
  if (fe?.category === 'parse') // not on the default connect (its parser cannot throw): a customConnect's
    return aixIssue('dispatch-parse', 'failed', { detail: safeErrorString(error) || undefined });
  const name = fe ? fe.connErrorName : error?.name;
  return aixIssue('dispatch-connect', 'failed', {
    runtime: _d.runtime,
    detail: (fe ? fe.causeText : safeErrorString(error)) || undefined, // not a fetcher error: a customConnect's own throw
    causeCode: name && !_BARE_ERROR_NAMES.includes(name) ? name : undefined, // the record keeps it only when code-shaped
    ...(isBrowserOffline() && { offline: true }),
  });
}

/** The one abort rule of the connect and read catches: the intake signal fired, or the error says abort */
function _isDispatchAbort(error: any, intakeAbortSignal: AbortSignal): boolean {
  return intakeAbortSignal.aborted
    || error?.name === 'AbortError' || error?.name === 'ResponseAborted' // CSF, Next.js
    || (error?.name === 'TRPCFetcherError' && error.category === 'abort');
}

/** The record for data the service sent that could not be processed: the error, and a bounded single-line head of the input for a bug report */
function _parseFailureIssue(error: any, input: string): DAixIssue {
  const errorText = (safeErrorString(error) || 'Unknown parsing error').replace(/\s+/g, ' ').trim();
  const head = (input || '').replace(/\s+/g, ' ').trim();
  return aixIssue('dispatch-parse', 'failed', {
    detail: `${errorText.length > 240 ? errorText.slice(0, 240) + '...' : errorText} - input: ${head.length > 200 ? head.slice(0, 200) + '...' : head || '(empty)'}`,
  });
}


// --- ChatGenerate Core procedure ---

/**
 * Chat content generation implementation - unified for both chat and resume.
 * Accepts a dispatch creator function to handle both POST (chatGenerate) and GET (resume) requests.
 *
 * Can be called directly from server-side code or wrapped in retry logic, batching, etc.
 */
export async function* executeChatGenerateDispatch(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  intakeAbortSignal: AbortSignal,
  _d: AixDebugObject,
  parseContext?: ChatGenerateParseContext,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  // AIX ChatGenerate Particles - Intake Transmitter
  const chatGenerateTx = new ChatGenerateTransmitter(_d.prettyDialect);

  // Create dispatch with error handling
  let dispatch: ChatGenerateDispatch;
  try {
    dispatch = await dispatchCreatorFn();
    // attach outbound app identity, for every dialect (no-op in the browser)
    dispatch.request.headers = llmAppIdentityHeaders(dispatch.request.headers);
  } catch (error: any) {
    // log but don't warn on the server console, this is typically a service configuration issue (e.g. a missing password will throw here)
    chatGenerateTx.setDispatchRpcTerminatingIssue(aixIssue('dispatch-prepare', 'failed', { detail: safeErrorString(error) || 'Unknown service preparation error' }), 'srv-log');
    yield* chatGenerateTx.flushParticles();
    return; // exit
  }

  // [DEV] Apply a request body override, if set
  if (_d.requestBodyOverride && 'body' in dispatch.request)
    dispatch.request.body = { ...dispatch.request.body, ..._d.requestBodyOverride };

  // Companions: attachments that live for this dispatch - lifecycle hooks and 1:1 particle mappers, in order (see ChatGenerateDispatchCompanion)
  const companions = dispatch.companions ?? [];
  try {

    for (const companion of companions) {
      try {
        companion.onStart?.(intakeAbortSignal);
      } catch (error: any) {
        console.warn(`[AIX] ${_d.prettyDialect}: companion '${companion.name}' threw on start`, { error: error?.message || error });
      }
    }

    // Connect to the dispatch (yields debug echo particles directly, bypasses the companions)
    const dispatchResponse = yield* _connectToDispatch(dispatch.request, dispatch.customConnect, !!dispatch.connectNoRetry, intakeAbortSignal, chatGenerateTx, _d);
    if (!dispatchResponse)
      return; // exit: error already handled

    // Inner stream
    const innerStream = (async function* () {

      // Consume dispatch response
      if (dispatch.demuxerFormat === null /* NS */)
        yield* _consumeDispatchUnified(dispatchResponse, dispatch.chatGenerateParse, intakeAbortSignal, chatGenerateTx, _d, parseContext);
      else
        yield* _consumeDispatchStream(dispatchResponse, dispatch.bodyTransform ?? null, dispatch.demuxerFormat, dispatch.chatGenerateParse, intakeAbortSignal, chatGenerateTx, _d, parseContext);

      // The read is over: a parser that kept an event aside for the next one states it now, before the end
      try {
        dispatch.chatGenerateParse.onReadEnd?.(chatGenerateTx, chatGenerateTx.isClosedWithoutEnd);
      } catch (error: any) {
        console.warn(`[AIX] ${_d.prettyDialect}: the parser threw on read end`, { error: error?.message || error });
      }

      // Tack profiling particles if generated
      if (_d.profiler) {
        chatGenerateTx.addDebugProfilerData(_d.profiler.getResultsData());
        // performanceProfilerLog('AIX Router Performance', profiler?.getResultsData()); // uncomment to log to server console
        _d.profiler.clearMeasurements();
      }

      // Flush everything that's left; if we're here we have encountered a clean end condition,
      // or an error that has already been queued up for this last flush
      yield* chatGenerateTx.flushParticles();

    })();

    // Particle mappers (optional): every particle passes through each companion's onParticle in order. The loop awaits only
    // when a mapper returns a promise, and yields outside any try, so a consumer's throw at the yield is never swallowed.
    const mappers = companions.flatMap(({ name, onParticle }) => onParticle ? [{ name, onParticle }] : []);
    if (!mappers.length) {
      yield* innerStream; // passthrough
      return;
    }
    for await (const particle of innerStream) {
      let mapped = particle;
      for (const mapper of mappers) {
        try {
          const result = mapper.onParticle(mapped);
          mapped = result instanceof Promise ? await result : result;
        } catch (error: any) {
          console.warn(`[AIX] ${_d.prettyDialect}: companion '${mapper.name}' threw on a particle, passing it through`, { error: error?.message || error });
        }
      }
      yield mapped;
    }

  } finally {
    // every exit: normal end, early return, a thrown retry or continuation signal, a consumer closing the generator
    for (let i = companions.length - 1; i >= 0; i--) {
      try {
        companions[i].onEnd?.();
      } catch (error: any) {
        console.warn(`[AIX] ${_d.prettyDialect}: companion '${companions[i].name}' threw on end`, { error: error?.message || error });
      }
    }
  }
}


// --- Connection, Non-Streaming and Streaming Consumers ---

/**
 * Connects to the AI service dispatch endpoint.
 * Handles request echo debugging, fetch with heartbeats, and error handling.
 * Returns null if connection fails (error already handled and yielded).
 */
async function* _connectToDispatch(
  request: ChatGenerateDispatchRequest,
  customConnect: ((signal: AbortSignal) => Promise<Response>) | undefined,
  connectNoRetry: boolean,
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
    // [customConnect] dialects that need multi-step I/O (e.g. Gemini Interactions poll loop) own the connection
    const connectionOperationCreator = customConnect ? () => customConnect(intakeAbortSignal) : () => fetchResponseOrTRPCThrow({
      ...request,
      signal: intakeAbortSignal,
      name: `Aix.${_d.prettyDialect}`,
      throwWithoutName: true,
    });
    // drain (▼) signal allows to interrupt the heartbeat loop and yield particles
    let singnaldrain = promiseWithResolvers<'▼'>();
    const onRetryAttempt = (attempt: RetryAttempt) => {
      // -> retry-server-dispatch
      chatGenerateTx.sendCGControl({
        cg: 'aix-retry-reset', rScope: 'srv-dispatch', rClearStrategy: 'none', // clear nothing, because no content has been streamed while trying to connect
        ...attempt, // reason, attempt (2..) of maxAttempts: same notation as the operation retrier
      });
      singnaldrain.resolve('▼'); // -> breaks the heartbeat loop
    };
    // loops on connection issues, or throws the original error (TRPCFetcherError) from fetchResponseOrTRPCThrow when: not retryable, aborted, or attempts exhausted
    const chatGenerateResponsePromise = fetchWithAbortableConnectionRetry(connectionOperationCreator, intakeAbortSignal, onRetryAttempt, { noRetry: connectNoRetry });

    while (true) {
      // this only yields heartbeat particles, does not yield while blocked on the connection attempt (which could be a long loop)
      const dispatchResponse = yield* heartbeatsWhileAwaiting(Promise.race([chatGenerateResponsePromise, singnaldrain.promise]));

      // ▼ interrupt: emit particles and restart heartbeat loop
      if (dispatchResponse === '▼') {
        singnaldrain = promiseWithResolvers<'▼'>(); // re-arm BEFORE draining, so a retry firing mid-drain resolves the fresh promise (else it's lost)
        yield* chatGenerateTx.emitParticles();
        continue;
      }
      _d.profiler?.measureEnd('connect');

      // Continue with the successful Fetch response (errors are caught below)
      return dispatchResponse;
    }
  } catch (error: any) {

    // aborted while connecting
    if (_isDispatchAbort(error, intakeAbortSignal)) {
      chatGenerateTx.setDispatchEnded('done-dispatch-aborted');
      yield* chatGenerateTx.flushParticles();
      return null; // signal caller to exit
    }

    // the request URL helps a developer, but is never stored: under Direct Connection to Gemini its query holds the key
    if (AIX_SECURITY_ONLY_IN_DEV_BUILDS)
      console.log(`[AIX] ${_d.prettyDialect}: connect failed: ${request.url.split('?')[0]}`);

    // upstream rejections that are user/key/policy issues (401 bad key, 402 billing, 403 region/permission, 404 unknown model, 429 quota) or the vendor's capacity (503) log instead of warn;
    // 400/422 and the rest keep warning, as they can signal adapter bugs (malformed requests we generated)
    const demoteToLog = [401, 402, 403, 404, 429, 503];
    // [Anthropic] billing and a conversation over the context window are a 400 too: the user's to fix, told apart by the text
    const demote400Text = /credit balance is too low|prompt is too long/i;
    const isUpstreamUserError = error?.name === 'TRPCFetcherError' && error.category === 'http'
      && (demoteToLog.includes(error.httpStatus) || (error.httpStatus === 400 && demote400Text.test(error.message)));
    const serverLogLevel = _d.consoleLogErrors === 'srv-warn' && isUpstreamUserError ? 'srv-log' : _d.consoleLogErrors;

    chatGenerateTx.setDispatchRpcTerminatingIssue(_connectFailureIssue(error, _d), serverLogLevel);
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
  intakeAbortSignal: AbortSignal,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: AixDebugObject,
  parseContext?: ChatGenerateParseContext,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {
  let dispatchBody: string | undefined = undefined;
  try {

    // Read the full response body with heartbeats
    _d.profiler?.measureStart('read-full');
    const fullBodyReadPromise = dispatchResponse.text();
    dispatchBody = yield* heartbeatsWhileAwaiting(fullBodyReadPromise);
    _d.profiler?.measureEnd('read-full');
    _d.wire?.logResponse(dispatchBody);

    // Parse the response in full
    _d.profiler?.measureStart('parse-full');
    dispatchParserNS(chatGenerateTx, dispatchBody, undefined, parseContext);
    _d.profiler?.measureEnd('parse-full');

    // Handle the case where the Dialect hansn't signaled the end of generation
    if (!chatGenerateTx.isEnded) {

      // the body was read and parsed in full: with a stop reason the close is how the dialect ends; without one the response
      // is whole but unqualified (a gateway that omits the finish), the same as a stream that ends without one: not a cutoff
      if (!chatGenerateTx.hasExplicitTokenStopReason) {
        console.warn(`[AIX] _consumeDispatchUnified: ${_d.prettyDialect}: response parsed without a provider stop reason`);
        chatGenerateTx.setDialectEnded('done-dialect');
      } else
        chatGenerateTx.setDispatchEnded('done-dispatch-closed');
    }

  } catch (error: any) {
    // NS pass-through dispatch signals - thrown by parsers to request operation retry or continuation
    if (error instanceof DispatchContinuationSignal) {
      yield* chatGenerateTx.flushParticles(); // the paused segment's content and metrics: the parser queued them all before it threw
      throw error;
    }
    if (error instanceof OperationRetrySignal) throw error;

    if (dispatchBody === undefined) {
      if (_isDispatchAbort(error, intakeAbortSignal))
        chatGenerateTx.setDispatchEnded('done-dispatch-aborted');
      else
        chatGenerateTx.setDispatchRpcTerminatingIssue(_readFailureIssue(error, _d), 'srv-warn');
    } else {
      // the full body goes to the log, a bounded head of it to the record
      console.warn(`[AIX] _consumeDispatchUnified: ${_d.prettyDialect}: parse failure, input data:`, objectDeepCloneWithStringLimit(dispatchBody, 'aix.parsing-issue', 2048));
      chatGenerateTx.setDispatchRpcTerminatingIssue(_parseFailureIssue(error, dispatchBody), 'srv-warn');
    }
  }
}

/**
 * [STREAMING] Consumes a streaming dispatch response with demuxing.
 * Reads chunks, demuxes events, parses each, emits particles.
 */
async function* _consumeDispatchStream(
  dispatchResponse: Response,
  dispatchBodyTransform: AixDemuxers.StreamBodyTransform,
  dispatchDemuxerFormat: AixDemuxers.StreamDemuxerFormat,
  dispatchParser: ChatGenerateParseFunction,
  intakeAbortSignal: AbortSignal,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: AixDebugObject,
  parseContext?: ChatGenerateParseContext,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  // Body reader with optional transform (e.g. AWS EventStream binary -> SSE text)
  const dispatchReader = AixDemuxers.applyBodyTransformer(dispatchResponse.body || createEmptyReadableStream(), dispatchBodyTransform).getReader();
  try {
    yield* _pumpDispatchStream(dispatchReader, dispatchDemuxerFormat, dispatchParser, intakeAbortSignal, chatGenerateTx, _d, parseContext);
  } finally {
    // We read no further, however we got here (the dialect ended, an issue, a retry or continuation signal, the consumer
    // closing): release the upstream body. A vendor that keeps its stream open past the event that ended it, or that only
    // pings, would otherwise hold the connection - for good in the browser (CSF), where no function teardown closes it.
    // Best effort: a body that is closed or aborted already rejects.
    dispatchReader.cancel().catch(() => undefined);
  }
}

/** The data pump of _consumeDispatchStream, which owns the reader: chunks -> events -> particles, until the stream or the generation ends */
async function* _pumpDispatchStream(
  dispatchReader: ReadableStreamDefaultReader<Uint8Array>,
  dispatchDemuxerFormat: AixDemuxers.StreamDemuxerFormat,
  dispatchParser: ChatGenerateParseFunction,
  intakeAbortSignal: AbortSignal,
  chatGenerateTx: ChatGenerateTransmitter,
  _d: AixDebugObject,
  parseContext?: ChatGenerateParseContext,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  const dispatchDecoder = new TextDecoder('utf-8', { fatal: false /* malformed data -> " " (U+FFFD) */ });
  const dispatchDemuxer = AixDemuxers.createStreamDemuxer(dispatchDemuxerFormat);

  // Data pump loop - for each chunk read from the dispatch stream
  do {

    // Stream... -> Events[] (& yield heartbeats)
    let demuxedEvents: AixDemuxers.DemuxedEvent[] = [];
    let isFinalIteration = false;
    try {

      // 1. Blocking read with heartbeats
      _d.profiler?.measureStart('read');
      const chunkReadPromise = dispatchReader.read();
      const { done, value } = yield* heartbeatsWhileAwaiting(chunkReadPromise);
      _d.profiler?.measureEnd('read');

      // Handle normal dispatch stream closure (no more data, AI Service closed the stream)
      if (done) {

        // mark as ended,
        isFinalIteration = true;

        // 2. Decode nothing new

        // 3. Recover leftover events
        _d.profiler?.measureStart('demux');
        demuxedEvents = dispatchDemuxer.flushRemaining();
        _d.profiler?.measureEnd('demux');

        if (demuxedEvents.length > 0)
          console.warn(`[AIX] _consumeDispatchStream: ${_d.prettyDialect}: stream closed with ${demuxedEvents.length} recovered event(s) from demuxer buffer`);

      } else {

        // 2. Decode the chunk - does Not throw (see the constructor for why)
        _d.profiler?.measureStart('decode');
        const chunk = dispatchDecoder.decode(value, { stream: true });
        _d.profiler?.measureEnd('decode');

        // 3. Demux the chunk into 0 or more events
        _d.profiler?.measureStart('demux');
        demuxedEvents = dispatchDemuxer.demux(chunk);
        _d.profiler?.measureEnd('demux');

      }

    } catch (error: any) {

      // aborted while reading (NOTE: ResponseAborted is Next.js, not signal driven)
      if (_isDispatchAbort(error, intakeAbortSignal)) {
        chatGenerateTx.setDispatchEnded('done-dispatch-aborted');
        break; // outer do {}
      }

      // Handle abnormal stream termination; print to the server console as well (important to debug)
      chatGenerateTx.setDispatchRpcTerminatingIssue(_readFailureIssue(error, _d), 'srv-warn');
      break; // outer do {}
    }

    // ...Events[] -> parse() -> Particles* -> yield
    for (const demuxedItem of demuxedEvents) {
      _d.wire?.logResponse(demuxedItem);

      // ignore events post termination
      if (chatGenerateTx.isEnded) {
        // the SSE '[DONE]' sentinel after the terminal event is not a protocol issue ([Meta AI] Responses closes every stream with it)
        if (demuxedItem.type === 'event' && demuxedItem.data === '[DONE]')
          break; // inner for {}, will break outer
        // DEV-only message to fix dispatch protocol parsing -- warning on, because this is important and a sign of a bug
        console.warn(`[AIX] _consumeDispatchStream: ${_d.prettyDialect}: received stream event after termination. ignoring.`, demuxedItem);
        break; // inner for {}, will break outer
      }

      // ignore unknown stream events
      if (demuxedItem.type !== 'event') {
        // console.log(`[AIX] _consumeDispatchStream: ${_d.prettyDialect}: ignoring non-event stream item of type "${demuxedItem.type}".`, demuxedItem.data);
        continue; // inner for {}
      }

      // [OpenAI] Special: stream termination marker
      if (demuxedItem.data === '[DONE]') {
        chatGenerateTx.setDialectEnded('done-dialect'); // OpenAI ChatCompletions
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
        // pass-through dispatch signals - thrown by parsers to request operation retry or continuation
        if (error instanceof DispatchContinuationSignal) {
          yield* chatGenerateTx.flushParticles(); // the paused turn's final metrics: sent once at the start, then only on a flush
          throw error;
        }
        if (error instanceof OperationRetrySignal) throw error;

        // Handle parsing issue (likely a schema break): the full event goes to the log, a bounded head of it to the record
        console.warn(`[AIX] _consumeDispatchStream: ${_d.prettyDialect}: parse failure, input data:`, objectDeepCloneWithStringLimit(demuxedItem.data, 'aix.service-parsing-issue', 2048));
        chatGenerateTx.setDispatchRpcTerminatingIssue(_parseFailureIssue(error, demuxedItem.data), 'srv-warn');
        break; // inner for {}, then outer do
      }
    }

    // 6. Stream end - Handle the case where the Dialect hansn't signaled the end of generation
    if (isFinalIteration && !chatGenerateTx.isEnded) {

      // without a stop reason this is a cutoff, which the transmitter states at the end (dispatch-cutoff)
      if (!chatGenerateTx.hasExplicitTokenStopReason)
        console.warn(`[AIX] _consumeDispatchStream: ${_d.prettyDialect}: stream closed (done-dispatch-closed) without provider termination signal - response may be truncated`);

      chatGenerateTx.setDispatchEnded('done-dispatch-closed'); // not a a good end reason, means we didn't receive a logic end
      break; // outer do {}
    }

  } while (!chatGenerateTx.isEnded);
}
