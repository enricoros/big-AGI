import { createFastEventSourceDemuxer } from './stream.demuxer.fastsse';


export namespace AixDemuxers {

  /**
   * The format of the stream: 'sse' or 'json-nl'
   * - 'fast-sse' is our own parser, optimized for performance. to be preferred when possible over 'sse' (check for full compatibility with the upstream)
   * - 'json-nl' is used by Ollama
   */
  export type StreamDemuxerFormat = 'fast-sse' | 'json-nl' | null;


  /**
   * Creates a demuxer for a stream of events.
   * The demuxer is stateful and accumulates data until a full event is available.
   */
  export function createStreamDemuxer(format: StreamDemuxerFormat): StreamDemuxer {
    switch (format) {
      case 'fast-sse':
        return createFastEventSourceDemuxer();
      case 'json-nl':
        return _createJsonNlDemuxer();
      case null:
        return _nullStreamDemuxerWarn;
    }
  }


  export type DemuxedEvent = {
    type: 'event' | 'reconnect-interval';
    name?: string;
    data: string; // in case of 'reconnect-interval' this is the string representation of the number (in milliseconds)
    // eventId?: string; // unused
  };

  export type StreamDemuxer = {
    demux: (chunk: string) => DemuxedEvent[];
    remaining: () => string;

    // unused, but may be provided by some demuxers
    lastEventId?: () => string | undefined; // not used for now - SSE defines it for the stream
    reconnectInterval?: () => number | undefined; // not used for now - SSE announces it
  };

}


/**
 * Creates a parser for a 'JSON\n' non-event stream, to be swapped with an EventSource parser.
 * Ollama is the only vendor that uses this format.
 */
function _createJsonNlDemuxer(): AixDemuxers.StreamDemuxer {
  let buffer = '';

  return {
    demux: (chunk: string): AixDemuxers.DemuxedEvent[] => {
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


const _nullStreamDemuxerWarn: AixDemuxers.StreamDemuxer = {
  demux: () => {
    console.warn('Null demuxer called - shall not happen, as it is only created in non-streaming');
    return [];
  },
  remaining: () => '',
};
