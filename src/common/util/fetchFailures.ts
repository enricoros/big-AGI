/**
 * Fetch failures - MAGIC CONSTANTS: the texts our runtimes throw when a fetch fails or a stream ends early, as checks over
 * the raw error. Facts only: each caller sits on one leg (browser -> our server, our server -> AI service, browser -> AI
 * service with CSF) and words the message itself. Import-free, so safe on the server and in the browser.
 * Measured 2026-10-29, see kb/modules/AIX-transport-errors.md.
 */


// tRPC client (httpBatchStreamLink) - errors reach the caller bare while the stream is read, or wrapped in a TRPCClientError
// (same message, the original on `.cause`) before the result envelope arrives.

// The JSONL stream ended early: tRPC's own texts, @trpc/server stream/jsonl.ts (jsonlStreamConsumer). Checked against the
// 11.5.1, 11.19.0 and 11.22.1 sources; the first two verified live on 11.22.1. Re-check on every tRPC upgrade.
const TRPC_STREAM_CLOSED_TEXTS = [
  'Stream closed unexpectedly',             // >= 11.20: the body ended mid-stream
  'Stream closed before head was received', // the body ended before its first line (an empty 200); not in 11.5.1, in 11.19.0 and 11.22.1
  'Stream closed',                          // <= 11.5.1: every early close, mid-stream or before the head; gone since 11.6
] as const;

/** tRPC's stream ended early - bare, or as a TRPCClientError (which carries the same message). */
export function isTRPCStreamClosedEarly(error: unknown): boolean {
  return error instanceof Error && TRPC_STREAM_CLOSED_TEXTS.some(text => error.message === text);
}
