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

const DEBUG_TRANSFORM = false;
const PRELUDE_LENGTH = 12; // 4 (total_length) + 4 (headers_length) + 4 (prelude_crc)
const MESSAGE_CRC_LENGTH = 4;
const MIN_MESSAGE_LENGTH = PRELUDE_LENGTH + MESSAGE_CRC_LENGTH; // 16 bytes: smallest valid frame (no headers, no payload)
const MAX_MESSAGE_LENGTH = 25 * 1024 * 1024; // 25 MB: EventStream spec max message size

// Byte sizes for each header value type (per Smithy EventStream spec, types 0-9)
// Types 6 (byte_array) and 7 (string) use 2-byte length prefix, handled separately
const HEADER_VALUE_FIXED_SIZES: Record<number, number> = {
  0: 0,  // bool_true
  1: 0,  // bool_false
  2: 1,  // byte (int8)
  3: 2,  // short (int16)
  4: 4,  // integer (int32)
  5: 8,  // long (int64)
  8: 8,  // timestamp (int64 millis)
  9: 16, // uuid (128-bit)
} as const;

interface EventStreamFrame {
  headers: Map<string, string>;
  payload: Uint8Array;
}

/**
 * Parse a complete EventStream frame from a buffer at the given offset.
 * Returns the frame and the number of bytes consumed, or null if not enough data.
 */
function _parseFrame(buffer: Uint8Array, offset: number, td: TextDecoder): { frame: EventStreamFrame; bytesConsumed: number } | null {
  const remaining = buffer.length - offset;
  if (remaining < PRELUDE_LENGTH) return null;

  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, remaining);
  const totalLength = view.getUint32(0); // big-endian
  const headersLength = view.getUint32(4); // big-endian

  // Sanity check: reject obviously malformed frames (prevents stalling on corrupted totalLength)
  if (totalLength < MIN_MESSAGE_LENGTH || totalLength > MAX_MESSAGE_LENGTH)
    throw new Error(`[EventStream] Invalid frame total_length: ${totalLength} (expected ${MIN_MESSAGE_LENGTH}..${MAX_MESSAGE_LENGTH})`);

  if (remaining < totalLength) return null;

  // Parse headers
  const headers = new Map<string, string>();
  let headerOffset = PRELUDE_LENGTH;
  const headersEnd = PRELUDE_LENGTH + headersLength;

  while (headerOffset < headersEnd) {
    // Header name
    const nameLength = buffer[offset + headerOffset];
    headerOffset += 1;
    const name = td.decode(buffer.slice(offset + headerOffset, offset + headerOffset + nameLength));
    headerOffset += nameLength;

    // Header value type (per Smithy spec: 0-9)
    const valueType = buffer[offset + headerOffset];
    headerOffset += 1;

    if (valueType === 7) {
      // String value: 2-byte big-endian length prefix + UTF-8 data
      const valueLength = new DataView(buffer.buffer, buffer.byteOffset + offset + headerOffset, 2).getUint16(0);
      headerOffset += 2;
      const value = td.decode(buffer.slice(offset + headerOffset, offset + headerOffset + valueLength));
      headerOffset += valueLength;
      headers.set(name, value);
    } else if (valueType === 6) {
      // Byte array: 2-byte big-endian length prefix + raw bytes (skip, not needed)
      const valueLength = new DataView(buffer.buffer, buffer.byteOffset + offset + headerOffset, 2).getUint16(0);
      headerOffset += 2 + valueLength;
    } else if (valueType in HEADER_VALUE_FIXED_SIZES) {
      // Fixed-size types: bool_true(0), bool_false(1), byte(2), short(3), int(4), long(5), timestamp(8), uuid(9)
      headerOffset += HEADER_VALUE_FIXED_SIZES[valueType];
    } else {
      // Truly unknown type - can't determine size, must stop
      console.warn(`[EventStream] Unknown header value type ${valueType} for header '${name}', stopping header parse`);
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
function _base64Decode(base64: string, td: TextDecoder): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);
  return td.decode(bytes);
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
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let _dbg_chunkCount = 0;
  let _dbg_frameCount = 0;

  return new TransformStream<Uint8Array, Uint8Array>({

    transform(chunk, controller) {

      // Append new chunk to buffer
      const newBuffer = new Uint8Array(buffer.length + chunk.length);
      newBuffer.set(buffer);
      newBuffer.set(chunk, buffer.length);
      buffer = newBuffer;
      if (DEBUG_TRANSFORM)
        console.log(`[EventStream] chunk #${++_dbg_chunkCount}: +${chunk.length}B, buffer: ${buffer.length}B`);

      // Parse as many complete frames as possible
      let offset = 0;
      let framesInChunk = 0;
      while (offset < buffer.length) {
        const result = _parseFrame(buffer, offset, decoder);
        if (!result) break; // Not enough data for a complete frame

        const { frame, bytesConsumed } = result;
        offset += bytesConsumed;
        framesInChunk++;
        _dbg_frameCount++;

        // Process the frame
        const eventType = frame.headers.get(':event-type');
        const messageType = frame.headers.get(':message-type');

        // Handle error frames
        if (messageType === 'exception' || messageType === 'error') {
          const errorPayload = decoder.decode(frame.payload);
          if (DEBUG_TRANSFORM)
            console.log(`[EventStream] frame #${_dbg_frameCount}: ${messageType} (${bytesConsumed}B):`, errorPayload.slice(0, 200));
          const errorSSE = `event: error\ndata: ${errorPayload}\n\n`;
          controller.enqueue(encoder.encode(errorSSE));
          continue;
        }

        // Handle 'chunk' events (the normal data path)
        if (eventType === 'chunk') {
          try {
            const wrapper = JSON.parse(decoder.decode(frame.payload));
            const base64Bytes = wrapper?.chunk?.bytes || wrapper?.bytes;

            if (base64Bytes) {
              // Decode the base64 payload -> native Anthropic event JSON
              const anthropicEventJson = _base64Decode(base64Bytes, decoder);

              // Extract the event type from the JSON (e.g. "message_start", "content_block_delta")
              // We do a lightweight parse here since the parser will re-parse downstream
              let anthropicEventType = 'event';
              try {
                const parsed = JSON.parse(anthropicEventJson);
                if (parsed.type) anthropicEventType = parsed.type;
              } catch {
                // If we can't parse the type, use generic 'event' - the parser will handle it
              }

              if (DEBUG_TRANSFORM)
                console.log(`[EventStream] frame #${_dbg_frameCount}: ${anthropicEventType} (${bytesConsumed}B)`, anthropicEventJson.slice(0, 120));

              // Emit as SSE
              const sse = `event: ${anthropicEventType}\ndata: ${anthropicEventJson}\n\n`;
              controller.enqueue(encoder.encode(sse));
            }
          } catch (error) {
            // On parse error, emit the raw payload as an error event
            const rawPayload = decoder.decode(frame.payload);
            console.warn('[EventStream] Failed to parse frame payload:', rawPayload.slice(0, 200));
            const errorSSE = `event: error\ndata: {"type":"error","error":{"type":"transform_error","message":"Failed to decode EventStream frame"}}\n\n`;
            controller.enqueue(encoder.encode(errorSSE));
          }
          continue;
        }

        // Handle model stream errors (Bedrock-specific error events)
        if (eventType === 'modelStreamErrorException' || eventType === 'internalServerException' ||
          eventType === 'modelTimeoutException' || eventType === 'throttlingException' ||
          eventType === 'validationException' || eventType === 'serviceUnavailableException') {
          const errorPayload = decoder.decode(frame.payload);
          if (DEBUG_TRANSFORM)
            console.log(`[EventStream] frame #${_dbg_frameCount}: Bedrock error ${eventType}:`, errorPayload.slice(0, 200));
          const errorSSE = `event: error\ndata: {"type":"error","error":{"type":"${eventType}","message":${JSON.stringify(errorPayload)}}}\n\n`;
          controller.enqueue(encoder.encode(errorSSE));
          continue;
        }

        // Handle Converse stream events (payload is direct JSON, not base64-wrapped)
        if (eventType === 'messageStart' || eventType === 'contentBlockStart'
          || eventType === 'contentBlockDelta' || eventType === 'contentBlockStop'
          || eventType === 'messageStop' || eventType === 'metadata') {
          const payloadJson = decoder.decode(frame.payload);
          if (DEBUG_TRANSFORM)
            console.log(`[EventStream] frame #${_dbg_frameCount}: converse event ${eventType} (${bytesConsumed}B)`, payloadJson.slice(0, 120));
          const sse = `event: ${eventType}\ndata: ${payloadJson}\n\n`;
          controller.enqueue(encoder.encode(sse));
          continue;
        }

        // Unknown event type - log and skip
        if (DEBUG_TRANSFORM || eventType)
          console.warn(`[EventStream] frame #${_dbg_frameCount}: unknown event type: ${eventType}, message type: ${messageType}`);
      }

      // Compact buffer: keep only unprocessed bytes
      if (offset > 0)
        buffer = buffer.slice(offset);

      if (DEBUG_TRANSFORM && (framesInChunk > 0 || buffer.length > 0))
        console.log(`[EventStream] chunk #${_dbg_chunkCount} done: ${framesInChunk} frames parsed, ${buffer.length}B residual`);
    },

    flush(_controller) {
      if (DEBUG_TRANSFORM || buffer.length > 0)
        console.warn(`[EventStream] flush: ${_dbg_frameCount} total frames, ${buffer.length}B remaining`);
    },
  });
}
