// import { createParser as createEventsourceParser, type EventSourceMessage, ParseError } from 'eventsource-parser';
//
// import { AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../api/aix.router';
//
// import type { AixDemuxers } from './stream.demuxers';
//
//
// /**
//  * NOTE: this uses the `eventsource-parser` library, which is compliant, but not fast.
//  * When possible, use the _createFastEventSourceDemuxer
//  *
//  * Creates a parser for an EventSource stream (e.g. OpenAI's format).
//  * Uses the renowned `eventsource-parser` library.
//  *
//  * Note that we only use the 'feed' function and not 'reset', as we recreate the object per-call.
//  */
// export function createEventSourceDemuxer(): AixDemuxers.StreamDemuxer {
//   let buffer: AixDemuxers.DemuxedEvent[] = [];
//   const parser = createEventsourceParser({
//     onEvent: (event: EventSourceMessage) => {
//       buffer.push({ type: 'event', name: event.event || undefined, data: event.data });
//     },
//     onRetry: (interval: number) => {
//       buffer.push({ type: 'reconnect-interval', data: '' + interval });
//     },
//     onError: (error: ParseError) => {
//       console.warn(`stream.demuxers: parser error (${error.type}):`, error.field, error.value, error.line);
//     },
//     onComment: (comment: string) => {
//       if (AIX_SECURITY_ONLY_IN_DEV_BUILDS)
//         console.log('[DEV] stream.demuxers: parser comment (safe to ignore):', comment);
//     },
//   });
//
//   return {
//     demux: (chunk: string) => {
//       parser.feed(chunk);
//       const bufferCopy = buffer;
//       buffer = [];
//       return bufferCopy;
//     },
//     remaining: () => '',
//   };
// }
