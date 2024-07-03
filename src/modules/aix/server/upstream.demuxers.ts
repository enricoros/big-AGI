import { createParser as createEventsourceParser } from 'eventsource-parser';

/**
 * Event stream formats
 *  - 'sse' is the default format, and is used by all vendors except Ollama
 *  - 'json-nl' is used by Ollama
 */
type UpstreamDemuxFormat = 'sse' | 'json-nl';

export type DemuxedEvent = {
  type: 'event' | 'reconnect-interval';
  name?: string;
  data: string;
};

type UpstreamDemuxFunction = (chunk: string) => DemuxedEvent[];

type UpstreamDemuxer = {
  demux: UpstreamDemuxFunction;
  remaining: () => string;
};


export function createUpstreamDemuxer(format: UpstreamDemuxFormat) {
  switch (format) {
    case 'sse':
      return _createEventSourceDemuxer();
    case 'json-nl':
      return _createJsonNlDemuxer();
  }
}


/**
 * Creates a parser for an EventSource stream (e.g. OpenAI's format).
 * Uses the renowned `eventsource-parser` library.
 *
 * Note that we only use the 'feed' function and not 'reset', as we create a new parser per-upstream.
 */
function _createEventSourceDemuxer(): UpstreamDemuxer {
  let buffer: DemuxedEvent[] = [];
  const parser = createEventsourceParser((event) => {
    switch (event.type) {
      case 'event':
        buffer.push({ type: 'event', name: event.event || undefined, data: event.data });
        break;
      case 'reconnect-interval':
        buffer.push({ type: 'reconnect-interval', data: '' + event.value });
        break;
    }
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
function _createJsonNlDemuxer(): UpstreamDemuxer {
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
