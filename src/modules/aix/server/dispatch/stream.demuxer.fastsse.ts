import type { AixDemuxers } from './stream.demuxers';
import { AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../api/aix.security';


/**
 * High-performance hand-roller parser for EventSource streams.
 *
 * Acknowledgements: thanks to the great `eventsource-parser` library for the inspiration and code [2].
 *
 * NOTE: we follow the spec for parsing, but not for event dispatching, which happens in our format. Breaks from spec:
 * - Non-Standard output format
 * - Retry (reconnect timeout): parsed but not used (applies to the whole stream, not individual events)
 * - Last Event Handling: not really implemented
 *
 * SSE information [1]:
 * - UTF-8 encoded, may start with a BOM (U+FEFF)
 * - default event type is 'message'
 * - mime is text/event-stream'
 *
 * [1]: https://html.spec.whatwg.org/multipage/server-sent-events.html
 * [2]: https://github.com/rexxars/eventsource-parser
 */
export function createFastEventSourceDemuxer(): AixDemuxers.StreamDemuxer {

  // accumulator
  let buffer = '';
  let checkForBom = true;
  let eolSearchIndex = 0;

  // parsed stream fields
  let streamLastEventId: string | undefined = undefined; // unused
  let streamReconnectTime: number | undefined = undefined;

  // parsed event block fields. [1]: They must be initialized to the empty string.
  let eventData: string = '';
  let eventId: string = '';
  let eventType: string = '';

  return {
    demux: (chunk: string): AixDemuxers.DemuxedEvent[] => {

      // fast-out
      if (!chunk) return [];

      /**
       * Strip the BOM if present in the very first packet.
       * NOTE: this assumes a String, UTF-8 encoded (obtained from new TextDecoder('utf-8').decode(...)), not
       * a Uint8Array, which would have 3 bytes (0xEF,0xBB,0xBF) at the start and would require a .slice(3) instead.
       *
       */
      if (checkForBom) {
        if (chunk.startsWith('\uFEFF'))
          chunk = chunk.slice(1);
        checkForBom = false;
      }

      // concatenate the new chunk to the buffer
      buffer += chunk;


      /// Fast Line Splitting

      /**
       * Fast-split the buffer into lines (hand optimized)
       *
       * From the spec:
       *   The stream must then be parsed by reading everything line by line, with:
       * - a U+000D CARRIAGE RETURN U+000A LINE FEED (CRLF) character pair
       * - a single U+000A LINE FEED (LF) character not preceded by a U+000D CARRIAGE RETURN (CR) character
       * - a single U+000D CARRIAGE RETURN (CR) character not followed by a U+000A LINE FEED (LF) character
       * being the ways in which a line can end.
       */
      const lines = [];
      do {
        let lfIndex = buffer.indexOf('\n', eolSearchIndex);
        if (lfIndex !== -1) {
          // we have a LF, let's check if it's a standalone LF or a CRLF
          if (lfIndex === 0) // ^LF
            lines.push('');
          else if (buffer[lfIndex - 1] === '\r') // CRLF
            lines.push(buffer.slice(eolSearchIndex, lfIndex - 1));
          else // LF
            lines.push(buffer.slice(eolSearchIndex, lfIndex));
          eolSearchIndex = lfIndex + 1;
        } else {
          // no LF found, let's check for a CR
          let crIndex = buffer.indexOf('\r', eolSearchIndex);
          if (crIndex !== -1) {
            // we have a CR, and it is not followed by a LF in the chunk
            // NOTE: we make the assumption that the CR *WILL NOT* be followed by a LF in the next chunk (same as eventsource-parser)
            //       however even if it is, worst case we'll get 2 empty lines, which will be de-duped later
            lines.push(buffer.slice(eolSearchIndex, crIndex));
            eolSearchIndex = crIndex + 1;
          } else {
            // no EOL found, we're done with this chunk
            break;
          }
        }
      } while (eolSearchIndex < buffer.length);

      // nothing found
      if (!lines.length) return [];

      // update the buffer - note that we could even avoid this and the algo would work, however we are reducing memory size but increasing memory thrashing here
      buffer = eolSearchIndex === buffer.length ? '' : buffer.slice(eolSearchIndex);
      eolSearchIndex = 0;


      /// Line-by-Line Processing

      const events: AixDemuxers.DemuxedEvent[] = [];

      for (const line of lines) {

        // blank line: Dispatch
        if (line === '') {
          // set the event source Last Event Id to the event Id (unused)
          streamLastEventId = eventId || streamLastEventId;

          if (eventData) {
            // **NOTE**: this is our unified 'DemuxEvent' format, which is different from the spec.
            //           As we build this for speed, we are already adopting the destination format rather than
            //           the event dispatch format of [1] ({ id: eventId, event: eventType || undefined, data: eventData.endsWith() ? ... }).
            events.push({
              type: 'event',
              name: eventType || undefined,
              data: eventData.endsWith('\n') ? eventData.slice(0, -1) : eventData, // [2] thanks
              // eventId: eventId || undefined, // unused
            });
          }

          // Reset for the next event
          eventId = '';
          eventData = '';
          eventType = '';

          continue; // Dispatch queued
        }

        // non-blank line: Parse
        // if the line starts with a colon, ignore
        const colonIndex = line.indexOf(':');
        if (colonIndex === 0) {
          // [OpenRouter, 2025-10-28] sends many processing strings that we may ignore here
          if (AIX_SECURITY_ONLY_IN_DEV_BUILDS && line !== ': OPENROUTER PROCESSING')
            console.log('[DEV] fast-sse-demuxer: SSE Comment (may ignore):', line.slice(line.startsWith(': ') ? 2 : 1));
          continue;
        }

        // Process the line as a (field, value) pair
        let field, value;
        if (colonIndex > 0) {
          // if the line contains a colon, parse the field
          field = line.slice(0, colonIndex);
          value = line.slice(colonIndex + (line[colonIndex + 1] === ' ' ? 2 : 1));
        } else {
          // use the whole line as the field name, and an empty string as the field value
          field = line;
          value = '';
        }

        // Process the field
        switch (field) {
          case 'event':
            eventType = value;
            break;

          case 'data':
            eventData += value + '\n';
            break;

          case 'id':
            if (!value.includes('\0'))
              eventId = value;
            break;

          case 'retry':
            if (/^\d+$/.test(value))
              streamReconnectTime = parseInt(value, 10);
            else if (AIX_SECURITY_ONLY_IN_DEV_BUILDS)
              console.warn('[DEV] fast-sse-demuxer: Invalid `retry` value:', value, line);
            break;

          default:
            // [1] Otherwise the field is ignored
            if (AIX_SECURITY_ONLY_IN_DEV_BUILDS)
              console.warn('[DEV] fast-sse-demuxer: Ignoring unknown field:', field, value, line);
            break;
        }
      }

      return events;
    },

    /**
     * Recover events from unflushed buffer at stream end.
     * Some servers don't send proper \n\n terminators between SSE events, causing
     * data to accumulate without dispatching. This applies lenient parsing to
     * extract JSON payloads from the remaining buffer.
     */
    flushRemaining: (): AixDemuxers.DemuxedEvent[] => {
      // capture pending event type before clearing state
      const pendingEventType = eventType || undefined;

      // combine both sources: eventData first (no prefixes), then buffer (raw SSE)
      const combined = ((eventData ? eventData + '\n' : '') + buffer).trim();

      // clear state
      buffer = '';
      eventData = '';
      eventType = '';
      eolSearchIndex = 0;

      if (!combined)
        return [];

      // extract JSON events with lenient parsing
      const { events, skippedParts } = _extractJsonEventsFromSSE(combined, pendingEventType);

      // warn about recovery for protocol debugging
      if (events.length > 0 || skippedParts.length > 0)
        console.warn(`[AIX] SSE demuxer: recovered ${events.length} event(s) from unterminated stream`, {
          skippedParts: skippedParts.length,
          combinedLen: combined.length,
          combinedSample: combined.length <= 300 ? combined : combined.slice(0, 300) + '...',
          ...(skippedParts.length > 0 && { skipped: skippedParts }),
        });

      return events;
    },

    reconnectInterval: () => streamReconnectTime,
    lastEventId: () => streamLastEventId,
  };
}


/**
 * Extract complete JSON objects from SSE buffer remnants.
 * Handles `event:` and `data:` prefixes, tracks brace depth and string context.
 */
function _extractJsonEventsFromSSE(input: string, initialEventName: string | undefined): {
  events: AixDemuxers.DemuxedEvent[];
  skippedParts: string[];
} {
  const events: AixDemuxers.DemuxedEvent[] = [];
  const skippedParts: string[] = [];
  let i = 0;
  let currentEventName = initialEventName;

  while (i < input.length) {
    // skip whitespace
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    // check for `event:` line (SSE event name, used by Anthropic format)
    if (input.slice(i, i + 6) === 'event:') {
      i += 6;
      while (i < input.length && input[i] === ' ') i++;
      const lineEnd = input.indexOf('\n', i);
      currentEventName = input.slice(i, lineEnd === -1 ? undefined : lineEnd).trim();
      i = lineEnd === -1 ? input.length : lineEnd + 1;
      continue;
    }

    // check for `data:` prefix and skip it
    if (input.slice(i, i + 5) === 'data:') {
      i += 5;
      while (i < input.length && input[i] === ' ') i++;
      // check for [DONE] marker
      if (input.slice(i, i + 6) === '[DONE]') {
        i += 6;
        continue;
      }
    }

    // look for start of JSON object
    if (input[i] !== '{') {
      const lineEnd = input.indexOf('\n', i);
      const skipped = input.slice(i, lineEnd === -1 ? undefined : lineEnd).trim();
      if (skipped && skipped !== '[DONE]')
        skippedParts.push(skipped.length > 100 ? skipped.slice(0, 100) + '...' : skipped);
      i = lineEnd === -1 ? input.length : lineEnd + 1;
      continue;
    }

    // parse JSON object by tracking brace depth and string context
    const start = i;
    let depth = 0;
    let inString = false;
    let escaped = false;

    while (i < input.length) {
      const char = input[i];
      if (escaped) {
        escaped = false;
      } else if (char === '\\' && inString) {
        escaped = true;
      } else if (char === '"') {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            events.push({ type: 'event', name: currentEventName, data: input.slice(start, i + 1) });
            currentEventName = undefined; // reset for next event
            i++;
            break;
          }
        }
      }
      i++;
    }

    // incomplete JSON at end
    if (depth !== 0) {
      const partial = input.slice(start);
      skippedParts.push(partial.length > 100 ? partial.slice(0, 100) + '...' : partial);
      break;
    }
  }

  return { events, skippedParts };
}
