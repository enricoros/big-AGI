import { createParser as createEventsourceParser, type EventSourceMessage, ParseError } from 'eventsource-parser';

/**
 * The format of the stream: 'sse' or 'json-nl'
 * - 'sse' is the default format, and is used by all vendors except Ollama
 * - 'json-nl' is used by Ollama
 */
export type StreamDemuxerFormat = 'sse' | 'json-nl' | null;


/**
 * Creates a demuxer for a stream of events.
 * The demuxer is stateful and accumulates data until a full event is available.
 */
export function createStreamDemuxer(format: StreamDemuxerFormat): StreamDemuxer {
  switch (format) {
    case 'sse':
      return _createEventSourceDemuxer();
    case 'json-nl':
      return _createJsonNlDemuxer();
    case null:
      return _nullStreamDemuxerWarn;
  }
}


export type DemuxedEvent = {
  type: 'event' | 'reconnect-interval';
  name?: string;
  data: string;
};

type StreamDemuxer = {
  demux: (chunk: string) => DemuxedEvent[];
  remaining: () => string;
};


/**
 * Creates a parser for an EventSource stream (e.g. OpenAI's format).
 * Uses the renowned `eventsource-parser` library.
 *
 * Note that we only use the 'feed' function and not 'reset', as we recreate the object per-call.
 */
function _createEventSourceDemuxer(): StreamDemuxer {
  let buffer: DemuxedEvent[] = [];
  const parser = createEventsourceParser({
    onEvent: (event: EventSourceMessage) => {
      buffer.push({ type: 'event', name: event.event || undefined, data: event.data });
    },
    onRetry: (interval: number) => {
      buffer.push({ type: 'reconnect-interval', data: '' + interval });
    },
    onError: (error: ParseError) => {
      console.warn(`stream.demuxers: parser error (${error.type}):`, error.field, error.value, error.line);
    },
    onComment: (comment: string) => {
      if (process.env.NODE_ENV === 'development')
        console.log('[DEV] stream.demuxers: parser comment (safe to ignore):', comment);
    },
  });

  return {
    demux: (chunk: string) => {
      parser.feed(chunk);
      const bufferCopy = buffer;
      buffer = [];
      return bufferCopy;
    },
    remaining: () => '',
  };
}

/**
 * Creates a parser for a 'JSON\n' non-event stream, to be swapped with an EventSource parser.
 * Ollama is the only vendor that uses this format.
 */
function _createJsonNlDemuxer(): StreamDemuxer {
  let buffer = '';

  return {
    demux: (chunk: string): DemuxedEvent[] => {
      buffer += chunk;
      if (!buffer.endsWith('\n')) return [];

      const jsonFullLines = buffer.split('\n').filter(line => !!line);
      buffer = '';

      return jsonFullLines.map(jsonString => ({
        type: 'event',
        data: jsonString,
      }));
    },

    remaining: () => buffer,
  };
}


const _nullStreamDemuxerWarn: StreamDemuxer = {
  demux: () => {
    console.warn('Null demuxer called - shall not happen, as it is only created in non-streaming');
    return [];
  },
  remaining: () => '',
};
