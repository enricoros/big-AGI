import { TRPCClientError } from '@trpc/client';

import { presentErrorToHumans } from '~/common/util/errorUtils';


// configuration
const AIX_CLIENT_DEV_ASSERTS = process.env.NODE_ENV === 'development';


/**
 * Classifies tRPC/network errors from the streaming loop.
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


  // Browser-level network connection drops (TypeError, happens below tRPC error wrapping layer)
  // Network errors - when the client is disconnected (Vercel 5min timeout, Mobile timeout / disconnect, etc) - they show up as TypeErrors
  if (error instanceof TypeError && error.message === 'network error')
    return { errorType: 'net-disconnected', errorMessage: 'An unexpected issue occurred: **network error**.' };

  // tRPC <= 11.5.1 - Vercel Edge network disconnects are thrown form tRPC as 'Stream closed'
  // NOTE The behavior changed in 11.6+ for which we have an open upstream ticket: #6989
  if (error instanceof Error && error.message === 'Stream closed')
    return { errorType: 'net-disconnected', errorMessage: 'An unexpected issue occurred: **connection terminated**.' };


  // tRPC-level protocol errors (wrapped by tRPC client)
  // Initial connection failures, HTTP errors, or text responses that blow up tRPC's JSON parser
  if (error instanceof TRPCClientError) {
    switch (error.cause?.message) {
      /**
       * The body of the response was "Request Entity Too Large".
       * - this caused trpc, in ...stream/jsonl.ts, function createConsumerStream, to throw an error due to parsing the line as JSON
       *   - "const head = JSON.parse(line);"
       * - as the error bubbles up to here, and cannot be handled by the superjson transformer either, which happens after this
       */
      case `Unexpected token 'R', "Request En"... is not valid JSON`:
        return { errorType: 'request-exceeded', errorMessage: '**Request too large**: Your message or attachments exceed the 4.5MB limit of the Vercel edge network. Tip: use the cleanup button in the right pane to hide messages, remove large attachments or reduce conversation length.' };

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
 * Classifies particle processing errors from ContentReassembler.
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
