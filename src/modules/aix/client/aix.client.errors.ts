import { TRPCClientError } from '@trpc/client';

import { getTRPCClientFetchError, isBrowserOffline, isTRPCNetworkError, isTRPCStreamClosedEarly } from '~/common/util/fetchFailures';
import { presentErrorToHumans } from '~/common/util/errorUtils';

import { aixIssue, type DAixIssue } from '../shared/aix.issues';


/**
 * A client failure that knows its record: thrown to interrupt a flow (the Direct Connection bundle not loading), caught
 * by the layer that stores it. The message stays the human text for callers that only show errors.
 */
export class AixIssueThrow extends Error {
  override readonly name = 'AixIssueThrow';

  constructor(message: string, readonly issue: DAixIssue, options?: { cause?: unknown }) {
    super(message, options);
  }
}


// AIX client Error Channels (keep the 3 in sync); every channel ends in one DAixIssue record (aix.issues.ts):
//  [1] relay/connection THROWS         -> aixClassifyStreamingError (below): a `relay-*` or `aix-unknown` record. Fed by the
//      stream-loop catch in aix.client.ts; pre-filtered by streamingTransportFetch in common/util/trpc.client.ts (throws a
//      TRPCClientFetchError for 413 / text-html / any other status a front answered with).
//  [2] particle-PROCESSING throws      -> aixClassifyReassemblyError (below): an `aix-unknown` record. Raised by ContentReassembler.#processWireBacklog.
//  [3] in-band executor/service issues -> `cg: 'aix-issue'` PARTICLES inside the 200 stream, carrying the record (ContentReassembler);
//      never reach [1]/[2]. A valid stream is 200 + application/json, so [1]'s pre-filter passes [3] straight through.


// configuration
const AIX_CLIENT_DEV_ASSERTS = process.env.NODE_ENV === 'development';


/**
 * [Error Channel 1] Classifies a throw out of the stream loop (see the channel map above) into the record that fails the
 * generation. Returns null for the user's own Stop: only when the user's signal is aborted.
 * - path 'csf': Direct Connection has no relay, the executor runs here and yields its failures as particles: what still
 *   throws is our bug, never a `relay-*`
 */
export function aixClassifyStreamingError(error: any, { aborted, path }: { aborted: boolean, path: 'trpc' | 'csf' }): DAixIssue | null {

  if (aborted)
    return null;

  if (AIX_CLIENT_DEV_ASSERTS) console.error('[DEV] Aix streaming Error:', { error });

  // abort-shaped, but the user did not stop: an engine or the network cut the request (a suspended tab, a navigation). Not
  // measured on every engine: the record fails the generation, and its advice is to try again, not to report a bug
  const isErrorAbort = error instanceof Error && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'));
  if (isErrorAbort)
    return aixIssue('aix-unknown', 'failed', { causeCode: 'abort-unexpected', detail: (error.cause as Error | undefined)?.message || error.message });

  if (path === 'csf')
    return _unknownIssue(error);

  // Browser-level connection failures (engine-specific TypeError texts - see isBrowserNetworkError): offline, Wi-Fi/mobile drops,
  // DNS, a reset connection, the `npm run dev` process killed while streaming. Reads of the stream throw them bare (relay-read);
  // failures before the result envelope arrives come wrapped in a TRPCClientError (relay-connect) - e.g. requests still queued
  // by the browser (> 6 connections) when the Wi-Fi goes off. isTRPCNetworkError matches both.
  if (isTRPCNetworkError(error))
    return aixIssue(error instanceof TRPCClientError ? 'relay-connect' : 'relay-read', 'failed', {
      detail: (error instanceof TRPCClientError ? (error.cause as Error | undefined)?.message : undefined) || error.message,
      offline: isBrowserOffline() || undefined,
    });

  // Remote termination of the tRPC stream (e.g. the Vercel 300s function limit = a graceful HTTP EOF inside the
  // httpBatchStreamLink async-iterable). tRPC has thrown a DIFFERENT shape for this SAME event in each era (upstream #6989):
  //   <= 11.5.1:    Error('Stream closed')
  //   11.6 - 11.13: bare `undefined`                  (the #6989 regression, PR #6960)
  //   11.14-11.19.0: TypeError from destructuring the `done` read (PR #7233; engine-dependent text, V8 '... is not iterable')
  //   >= 11.20:     Error('Stream closed unexpectedly')  (PR #7604 checks `done`; first on npm as 11.22.1)
  // The Error-typed texts of every era are matched by isTRPCStreamClosedEarly (common/util/fetchFailures.ts).
  // tRPC only: CSF has no JSONL layer, and its executor turns read failures into in-band 'dispatch-read' records.
  // We deliberately do NOT match the bare `undefined` case: it is too broad a signal (an undefined can originate anywhere)
  // and 11.18+ no longer throws it.
  if (isTRPCStreamClosedEarly(error))
    return aixIssue('relay-cutoff', 'failed', { detail: error.message });

  // Engine-independent signals thrown by the streaming fetch wrapper (trpc.client.ts streamingTransportFetch), BEFORE tRPC's
  // JSONL parser would turn the response into an engine-specific SyntaxError. tRPC wraps a fetch-thrown error as
  // TRPCClientError with ours on `.cause`; the reader also takes it in case it ever arrives unwrapped.
  const fetchError = getTRPCClientFetchError(error);
  switch (fetchError?.code) {
    case 'request-exceeded':
      return aixIssue('relay-http', 'failed', { httpStatus: 413 });
    case 'response-captive':
      return aixIssue('relay-html', 'failed');
    case 'response-status':
      // what sits in front of our server answered: a gateway's 502/504, a firewall's 403, a 429. Never our procedure
      return aixIssue('relay-http', 'failed', { httpStatus: fetchError.httpStatus });
    case undefined:
      // not a fetch error of ours: the checks below
      break;
  }

  // a tRPC error envelope, its code is the cause code; its httpStatus is mapped from the code, it was not on the wire
  // - INTERNAL_SERVER_ERROR: our procedure threw (before or while streaming)
  // - any other code: our server did not accept the request (input validation, auth)
  if (error instanceof TRPCClientError && typeof error.data?.code === 'string')
    return aixIssue(error.data.code === 'INTERNAL_SERVER_ERROR' ? 'aix-unknown' : 'relay-rejected', 'failed', { causeCode: error.data.code, detail: error.message });

  return _unknownIssue(error);
}

function _unknownIssue(error: any): DAixIssue {
  return aixIssue('aix-unknown', 'failed', { detail: presentErrorToHumans(error, false, true)?.replace('[TRPCClientError]', '').trim() || 'Unknown error' });
}


/**
 * [Error Channel 2] Classifies particle-processing errors from ContentReassembler (see channel map at top; sibling of [1]).
 *
 * Responsibility: malformed particles and async work failures (NOT tRPC/network errors - those are caught in aix.client.ts).
 *
 * Why here: the for-await loop in aix.client.ts enqueues particles synchronously (no awaits) to prevent tRPC "closed
 * connection" errors. Processing happens in the reassembler's detached promise chain, so errors occur AFTER the loop
 * completes and can't be caught by the outer try-catch.
 *
 * Strategy: a record that fails the generation (the particle may have carried content, now lost), and the remaining
 * particles are processed. A throw of the UI update callback is not a processing error: the reassembler logs it, no record.
 */
export function aixClassifyReassemblyError(error: any): DAixIssue {
  return aixIssue('aix-unknown', 'failed', {
    text: 'Part of the response could not be processed.',
    detail: presentErrorToHumans(error, false, true) || 'Unknown error',
  });
}
