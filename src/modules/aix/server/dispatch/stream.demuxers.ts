import { _createEventSourceDemuxer } from './stream.demuxer.sse';


export namespace AixDemuxers {

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

  export type StreamDemuxer = {
    demux: (chunk: string) => DemuxedEvent[];
    remaining: () => string;
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
