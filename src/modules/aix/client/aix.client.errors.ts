import { TRPCClientError } from '@trpc/client';

import { presentErrorToHumans } from '~/common/util/errorUtils';


// AIX client Error Channels (keep the 3 in sync):
//  [1] transport/connection THROWS    -> aixClassifyStreamingError (below). Fed by the stream-loop catch in aix.client.ts;
//      pre-filtered by streamingTransportFetch in common/util/trpc.client.ts (tags 413 / text-html as error.cause.aixTransportCode).
//  [2] particle-PROCESSING throws      -> aixClassifyReassemblyError (below). Raised by ContentReassembler.#processWireBacklog.
//  [3] in-band server/provider errors  -> error PARTICLES inside the 200 stream -> error fragments (ContentReassembler normal path);
//      never reach [1]/[2]. A valid stream is 200 + application/json, so [1]'s pre-filter passes [3] straight through.


// configuration
const AIX_CLIENT_DEV_ASSERTS = process.env.NODE_ENV === 'development';

// user-facing messages reused by the typed transport-marker branch and the legacy string-match fallbacks
const MSG_REQUEST_EXCEEDED = '**Request too large**: Your message or attachments exceed the 4.5MB limit of the Vercel edge network. Tip: use the cleanup button in the right pane to hide messages, remove large attachments or reduce conversation length.';
const MSG_RESPONSE_CAPTIVE = '**Network issue**: The network returned an HTML page instead of expected data. This can be a Wi-Fi sign-in page, a proxy or browser extension, or a temporary gateway error. Please **refresh and try again**, or check your connection and disable blockers. Additional details may be available in the browser console.';


/**
 * [Error Channel 1] Classifies tRPC/network/transport errors from the streaming loop (see channel map at top of file).
 *
 * Responsibility: Connection, network, and stream errors (NOT particle processing).
 * Particle processing errors are caught in ContentReassembler due to async timing.
 *
 * Returns error classification and user-facing message. Caller applies to reassembler.
 * See comment above for-await loop for error handling split rationale.
 */
export function aixClassifyStreamingError(error: any, isUserAbort: boolean, hasFragments: boolean): {
  errorType: 'client-aborted' | 'net-disconnected' | 'request-exceeded' | 'response-captive' | 'net-unknown';
  errorMessage: string;
} {

  // User abort or AbortError from elsewhere (e.g. server-side tRPC abort?)
  const isErrorAbort = error instanceof Error && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'));
  if (isUserAbort || isErrorAbort) {
    if (AIX_CLIENT_DEV_ASSERTS && isUserAbort !== isErrorAbort)
      console.error(`[DEV] Aix streaming AbortError mismatch (${isUserAbort}, ${isErrorAbort})`, { error: error });
    return { errorType: 'client-aborted', errorMessage: '' }; // errorMessage unused for aborts
  }

  // IMPORTANT: NOTE: this code path has also been almost replicated on `ContentReassembler.#processWireBacklog.catch() {...}`

  if (AIX_CLIENT_DEV_ASSERTS) console.error('[DEV] Aix streaming Error:', { error });


  // Browser-level network connection drops (TypeError, happens below tRPC error wrapping layer), such as terminating the `npm run dev` process while streaming
  // Network errors - when the client is disconnected (Vercel 5min timeout, Mobile timeout / disconnect, etc) - they show up as TypeErrors
  // IMPORTANT: we will differentiate between the 2 'net-disconnected' cases in the UI, checking for the errorMessage '**network error**' vs '**connection terminated**'
  if (error instanceof TypeError && error.message === 'network error')
    return { errorType: 'net-disconnected', errorMessage: 'An unexpected issue occurred: **network error**.' /* DO NOT CHANGE '**network error**' - usually client-side broken */ };

  // Mid-stream remote termination (e.g. Vercel Edge function timeout = graceful HTTP EOF deep inside the
  // httpBatchStreamLink async-iterable). tRPC has thrown a DIFFERENT shape for this SAME event in each era (upstream #6989):
  //   <= 11.5.1:    Error('Stream closed')
  //   11.6 - 11.7:  bare `undefined`                  (the #6989 regression, PR #6960 - avoided: we ship >= 11.18)
  //   >= 11.14:     TypeError('... is not iterable')  (PR #7233 restored a real Error; message is engine/bundle-dependent)
  // We match the Error-typed shapes structurally. We deliberately do NOT match the bare `undefined` case: it is too broad
  // a signal (an undefined can originate anywhere) and 11.18+ no longer throws it. Re-enable the commented line below
  // only if a future tRPC version regresses to throwing `undefined` for a mid-stream cut.
  const isMidStreamTeardown =
    // (hasFragments && error === undefined) ||  // intentionally disabled - too broad; see note above (#6989)
    (error instanceof Error && error.message === 'Stream closed')
    || (error instanceof TypeError && /is not iterable/i.test(error.message));
  if (isMidStreamTeardown)
    return { errorType: 'net-disconnected', errorMessage: 'An unexpected issue occurred: **connection terminated**.' /* DO NOT CHANGE '**connection terminated**' - usually server (Vercel) side broken */ };

  // Undici (Node/Edge/Electron fetch) mid-stream TLS or socket drop - surfaces on any node-backed path (CSF, Electron, SSR).
  // Distinct from 'Stream closed' (tRPC wrapper): this one typically means the upstream LLM provider closed the TLS socket mid-stream, not the Vercel edge.
  if (error instanceof TypeError && error.message === 'terminated')
    return { errorType: 'net-disconnected', errorMessage: 'The AI provider interrupted mid-stream: **upstream dropped**.' /* DO NOT CHANGE '**upstream dropped**' - matched in BlockPartError */ };


  // Engine-independent transport signals tagged by the streaming fetch wrapper (trpc.client.ts streamingTransportFetch),
  // set BEFORE tRPC's JSONL parser would turn the response into an engine-specific SyntaxError. tRPC wraps a fetch-thrown
  // error as TRPCClientError with our marker on `.cause`; we also read it directly in case it ever arrives unwrapped.
  // The string-match cases further down remain as a V8-only fallback (and cover any path not behind the wrapper).
  const aixTransportSource: any = error instanceof TRPCClientError ? error.cause : error;
  switch (aixTransportSource?.aixTransportCode) {
    case 'request-exceeded':
      return { errorType: 'request-exceeded', errorMessage: MSG_REQUEST_EXCEEDED };
    case 'response-captive':
      return { errorType: 'response-captive', errorMessage: MSG_RESPONSE_CAPTIVE };
  }


  // tRPC-level protocol errors (wrapped by tRPC client)
  // Initial connection failures, HTTP errors, or text responses that blow up tRPC's JSON parser
  if (error instanceof TRPCClientError) {

    // Server-side PAYLOAD_TOO_LARGE - HTTP 413
    if (error.data?.httpStatus === 413)
      return { errorType: 'request-exceeded', errorMessage: '**Request too large**: This request exceed the size limit of the servers' };

    switch (error.cause?.message) {
      /**
       * When network is disconnected while a request hasn't started (is queued by the browser).
       * - repro: queue up > 6 connections, then turn WiFi off (no CSF).
       */
      case 'Failed to Fetch':
        return { errorType: 'net-disconnected', errorMessage: 'An issue occurred: **network error**' };

      /**
       * The body of the response was "Request Entity Too Large" (Vercel edge limit ~4.5MB).
       * - this caused trpc, in ...stream/jsonl.ts, function createConsumerStream, to throw an error due to parsing the line as JSON
       *   - "const head = JSON.parse(line);"
       * - as the error bubbles up to here, and cannot be handled by the superjson transformer either, which happens after this
       */
      case `Unexpected token 'R', "Request En"... is not valid JSON`:
        return { errorType: 'request-exceeded', errorMessage: MSG_REQUEST_EXCEEDED };

      /**
       * This happened many times in the past with captive portals and alike. Jet's just improve the messaging here.
       */
      case `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`:
        return { errorType: 'response-captive', errorMessage: '**Network issue**: The network returned an HTML page instead of expected data. This can be a Wi‑Fi sign‑in page, a proxy or browser extension, or a temporary gateway error. Please **refresh and try again**, or check your connection and disable blockers. Additional details may be available in the browser console.' };
    }
  }

  // Unknown/unhandled error
  const errorText = presentErrorToHumans(error, hasFragments, true)?.replace('[TRPCClientError]', '') || 'Unknown error';
  return { errorType: 'net-unknown', errorMessage: `An unexpected error occurred: ${errorText} Please retry.` };
}


/**
 * [Error Channel 2] Classifies particle-processing errors from ContentReassembler (see channel map at top; sibling of [1]).
 *
 * Responsibility: Malformed particles, async work failures (image/audio processing),
 * and UI callback errors (NOT tRPC/network errors - those are caught in aix.client.ts).
 *
 * Why here: The for-await loop in aix.client.ts enqueues particles synchronously
 * (no awaits) to prevent tRPC "closed connection" errors. Processing happens in
 * this detached promise chain, so errors occur AFTER the loop completes and can't
 * be caught by outer try-catch.
 *
 * Strategy: Convert to error fragment (matching outer handler behavior) and continue
 * processing remaining particles. Don't throw - would corrupt state with pending backlog.
 */
export function aixClassifyReassemblyError(error: any, hasFragments: boolean): {
  errorType: 'processing-error';
  errorMessage: string;
} {
  const errorText = presentErrorToHumans(error, hasFragments, true) || 'Unknown error';
  return { errorType: 'processing-error', errorMessage: `An unexpected issue occurred: ${errorText} Please retry.` };
}
