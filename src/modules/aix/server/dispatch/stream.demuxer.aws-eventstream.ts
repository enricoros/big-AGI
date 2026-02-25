/**
 * AWS EventStream Binary -> SSE Text TransformStream
 *
 * Transforms AWS EventStream binary protocol (used by Bedrock InvokeModelWithResponseStream)
 * into standard SSE text format that the existing fast-sse demuxer can parse.
 *
 * EventStream binary frame format (per Smithy spec):
 *   [4B total_length][4B headers_length][4B prelude_CRC]
 *   [variable headers][variable payload]
 *   [4B message_CRC]
 *
 * For Bedrock InvokeModelWithResponseStream, the payload JSON contains:
 *   { "chunk": { "bytes": "<base64-encoded-anthropic-event>" } }
 *
 * The base64-decoded bytes contain native Anthropic event JSON (message_start,
 * content_block_delta, message_stop, etc.) which this transform emits as SSE:
 *   event: {type}\ndata: {json}\n\n
 *
 * This allows the downstream fast-sse demuxer and Anthropic parser to work unchanged.
 */


// --- EventStream frame parser ---

const PRELUDE_LENGTH = 12; // 4 (total_length) + 4 (headers_length) + 4 (prelude_crc)
const MESSAGE_CRC_LENGTH = 4;

interface EventStreamFrame {
  headers: Map<string, string>;
  payload: Uint8Array;
}

/**
 * Parse a complete EventStream frame from a buffer at the given offset.
 * Returns the frame and the number of bytes consumed, or null if not enough data.
 */
function _parseFrame(buffer: Uint8Array, offset: number): { frame: EventStreamFrame; bytesConsumed: number } | null {
  const remaining = buffer.length - offset;
  if (remaining < PRELUDE_LENGTH) return null;

  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, remaining);
  const totalLength = view.getUint32(0); // big-endian
  const headersLength = view.getUint32(4); // big-endian

  if (remaining < totalLength) return null;

  // Parse headers
  const headers = new Map<string, string>();
  let headerOffset = PRELUDE_LENGTH;
  const headersEnd = PRELUDE_LENGTH + headersLength;

  while (headerOffset < headersEnd) {
    // Header name
    const nameLength = buffer[offset + headerOffset];
    headerOffset += 1;
    const name = new TextDecoder().decode(buffer.slice(offset + headerOffset, offset + headerOffset + nameLength));
    headerOffset += nameLength;

    // Header value type (7 = string for EventStream)
    const valueType = buffer[offset + headerOffset];
    headerOffset += 1;

    if (valueType === 7) {
      // String value: 2-byte length prefix
      const valueLength = new DataView(buffer.buffer, buffer.byteOffset + offset + headerOffset, 2).getUint16(0);
      headerOffset += 2;
      const value = new TextDecoder().decode(buffer.slice(offset + headerOffset, offset + headerOffset + valueLength));
      headerOffset += valueLength;
      headers.set(name, value);
    } else {
      // Skip unknown types - for robustness, just break out
      // In practice, Bedrock EventStream only uses string headers
      break;
    }
  }

  // Extract payload (between headers and message CRC)
  const payloadStart = PRELUDE_LENGTH + headersLength;
  const payloadEnd = totalLength - MESSAGE_CRC_LENGTH;
  const payload = buffer.slice(offset + payloadStart, offset + payloadEnd);

  return {
    frame: { headers, payload },
    bytesConsumed: totalLength,
  };
}


// --- Base64 decoder ---

/** Decode base64 string to UTF-8 string (Edge Runtime compatible) */
function _base64Decode(base64: string): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}


// --- TransformStream factory ---

/**
 * Creates a TransformStream that converts AWS EventStream binary (Uint8Array)
 * into SSE-formatted text (Uint8Array).
 *
 * After piping through this transform, the stream looks like a standard Anthropic
 * SSE stream, compatible with the fast-sse demuxer and Anthropic parser.
 */
export function createEventStreamToSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  let buffer = new Uint8Array(0);
  const encoder = new TextEncoder();

  return new TransformStream<Uint8Array, Uint8Array>({

    transform(chunk, controller) {
      // Append new chunk to buffer
      const newBuffer = new Uint8Array(buffer.length + chunk.length);
      newBuffer.set(buffer);
      newBuffer.set(chunk, buffer.length);
      buffer = newBuffer;

      // Parse as many complete frames as possible
      let offset = 0;
      while (offset < buffer.length) {
        const result = _parseFrame(buffer, offset);
        if (!result) break; // Not enough data for a complete frame

        const { frame, bytesConsumed } = result;
        offset += bytesConsumed;

        // Process the frame
        const eventType = frame.headers.get(':event-type');
        const messageType = frame.headers.get(':message-type');

        // Handle error frames
        if (messageType === 'exception' || messageType === 'error') {
          const errorPayload = new TextDecoder().decode(frame.payload);
          // Emit as a synthetic Anthropic error event
          const errorSSE = `event: error\ndata: ${errorPayload}\n\n`;
          controller.enqueue(encoder.encode(errorSSE));
          continue;
        }

        // Handle 'chunk' events (the normal data path)
        if (eventType === 'chunk') {
          try {
            // Parse the wrapper: { "chunk": { "bytes": "base64..." } }
            const wrapper = JSON.parse(new TextDecoder().decode(frame.payload));
            const base64Bytes = wrapper?.chunk?.bytes || wrapper?.bytes;

            if (base64Bytes) {
              // Decode the base64 payload -> native Anthropic event JSON
              const anthropicEventJson = _base64Decode(base64Bytes);

              // Extract the event type from the JSON (e.g. "message_start", "content_block_delta")
              // We do a lightweight parse here since the parser will re-parse downstream
              let anthropicEventType = 'event';
              try {
                const parsed = JSON.parse(anthropicEventJson);
                if (parsed.type) anthropicEventType = parsed.type;
              } catch {
                // If we can't parse the type, use generic 'event' - the parser will handle it
              }

              // Emit as SSE
              const sse = `event: ${anthropicEventType}\ndata: ${anthropicEventJson}\n\n`;
              controller.enqueue(encoder.encode(sse));
            }
          } catch (error) {
            // On parse error, emit the raw payload as an error event
            const rawPayload = new TextDecoder().decode(frame.payload);
            console.warn('[EventStream->SSE] Failed to parse frame payload:', rawPayload.slice(0, 200));
            const errorSSE = `event: error\ndata: {"type":"error","error":{"type":"transform_error","message":"Failed to decode EventStream frame"}}\n\n`;
            controller.enqueue(encoder.encode(errorSSE));
          }
          continue;
        }

        // Handle model stream errors (Bedrock-specific error events)
        if (eventType === 'modelStreamErrorException' || eventType === 'internalServerException' ||
          eventType === 'modelTimeoutException' || eventType === 'throttlingException' ||
          eventType === 'validationException' || eventType === 'serviceUnavailableException') {
          const errorPayload = new TextDecoder().decode(frame.payload);
          // Emit as Anthropic-formatted error
          const errorSSE = `event: error\ndata: {"type":"error","error":{"type":"${eventType}","message":${JSON.stringify(errorPayload)}}}\n\n`;
          controller.enqueue(encoder.encode(errorSSE));
          continue;
        }

        // Unknown event type - log and skip
        if (eventType)
          console.warn(`[EventStream->SSE] Unknown event type: ${eventType}`);
      }

      // Compact buffer: keep only unprocessed bytes
      if (offset > 0) {
        buffer = buffer.slice(offset);
      }
    },

    flush(_controller) {
      if (buffer.length > 0)
        console.warn(`[EventStream->SSE] ${buffer.length} bytes remaining in buffer at stream end`);
      // Don't enqueue remaining buffer - it's an incomplete frame
    },
  });
}
