/**
 * Fetch failures - MAGIC CONSTANTS: the texts our runtimes throw when a fetch fails or a stream ends early, as checks over
 * the raw error. Facts only: each caller sits on one leg (browser -> our server, our server -> AI service, browser -> AI
 * service with CSF) and words the message itself. Import-free, so safe on the server and in the browser.
 * Measured 2026-10-29, see kb/modules/AIX-transport-errors.md.
 */


// Browser fetch - TypeErrors with engine-specific text: the Fetch spec fixes the type, not the text.
// Matched ignoring case and a trailing period, to absorb small wording drift across versions.
// - measured on Chrome 154, Safari 27.2, Firefox 159:
//   before the response: Chromium 'Failed to fetch', WebKit 'Load failed', Gecko 'NetworkError when attempting to fetch resource.'
//   reading the body:    Chromium 'network error',   WebKit 'Load failed', Gecko 'Error in input stream'
// - older WebKit (Safari/iOS before 'Load failed'): NSURLError texts, from field reports - matched, not measured
const BROWSER_FETCH_FAILURE_TEXTS: ReadonlySet<string> = new Set([
  // Chromium: Chrome, Edge, Opera, Samsung Internet, Electron renderers
  'failed to fetch',
  'network error',
  // WebKit: Safari, every iOS browser
  'load failed',
  'the network connection was lost',
  'the internet connection appears to be offline',
  'a server with the specified hostname could not be found',
  'the request timed out',
  // Gecko: Firefox
  'networkerror when attempting to fetch resource',
  'error in input stream',
]);

/** A browser fetch failed. Node fetch throws other texts, so a match also means the code runs in a browser (CSF, or the tRPC client). */
export function isBrowserNetworkError(error: unknown): error is TypeError {
  return error instanceof TypeError && BROWSER_FETCH_FAILURE_TEXTS.has(error.message.trim().replace(/\.$/, '').toLowerCase());
}


// Node fetch (undici) - TypeError('terminated'), from undici's fetch (lib/web/fetch, `terminate()`): the socket closed mid-body.
export function isNodeStreamTerminated(error: unknown): error is TypeError {
  return error instanceof TypeError && error.message === 'terminated';
}


// tRPC client (httpBatchStreamLink) - errors reach the caller bare while the stream is read, or wrapped in a TRPCClientError
// (same message, the original on `.cause`) before the result envelope arrives.

// The JSONL stream ended early: tRPC's own texts, @trpc/server stream/jsonl.ts (jsonlStreamConsumer). Checked against the
// 11.5.1, 11.19.0 and 11.22.1 sources; the first two verified live on 11.22.1. Re-check on every tRPC upgrade.
const TRPC_STREAM_CLOSED_TEXTS = [
  'Stream closed unexpectedly',             // >= 11.20: the body ended mid-stream
  'Stream closed before head was received', // the body ended before its first line (an empty 200); not in 11.5.1, in 11.19.0 and 11.22.1
  'Stream closed',                          // <= 11.5.1: every early close, mid-stream or before the head; gone since 11.6
] as const;

/** A browser fetch failed under tRPC - bare, or as the `.cause` of a TRPCClientError (recognized by name, to stay import-free). */
export function isTRPCNetworkError(error: unknown): boolean {
  return isBrowserNetworkError(error) || (error instanceof Error && error.name === 'TRPCClientError' && isBrowserNetworkError(error.cause));
}

/** tRPC's stream ended early - bare, or as a TRPCClientError (which carries the same message). */
export function isTRPCStreamClosedEarly(error: unknown): boolean {
  return error instanceof Error && TRPC_STREAM_CLOSED_TEXTS.some(text => error.message === text);
}
