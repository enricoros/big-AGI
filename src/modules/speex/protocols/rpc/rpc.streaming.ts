/**
 * Shared streaming utilities for Speex RPC synthesizers
 *
 * Provides common streaming chunk accumulation logic used by
 * ElevenLabs, OpenAI, and LocalAI synthesizers.
 */

import type { SpeexSpeechParticle } from './rpc.wiretypes';


/**
 * Streams audio chunks from a Response, accumulating to minimum size before yielding.
 *
 * @param response - Fetch Response with audio body
 * @param minChunkSize - Minimum bytes to accumulate before yielding (default 4096)
 * @param textLength - Original text length for 'done' particle
 */
export async function* streamAudioChunksOrThrow(
  response: Response,
  minChunkSize: number,
  textLength: number,
): AsyncGenerator<SpeexSpeechParticle> {

  const reader = response.body?.getReader();
  if (!reader)
    return yield { t: 'error', e: 'No stream reader available' };

  try {
    const accumulatedChunks: Uint8Array[] = [];
    let accumulatedSize = 0;
    let totalAudioBytes = 0;

    while (true) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      if (!value) continue;

      // Accumulate chunks
      accumulatedChunks.push(value);
      accumulatedSize += value.length;

      // Yield when accumulated size reaches threshold
      if (accumulatedSize >= minChunkSize) {
        yield { t: 'audio', base64: Buffer.concat(accumulatedChunks).toString('base64'), chunk: true };
        totalAudioBytes += accumulatedSize;
        accumulatedChunks.length = 0;
        accumulatedSize = 0;
      }
    }

    // Yield any remaining data as final chunk
    if (accumulatedSize > 0) {
      yield { t: 'audio', base64: Buffer.concat(accumulatedChunks).toString('base64'), chunk: true /*, final: true*/ };
      totalAudioBytes += accumulatedSize;
    }

    yield { t: 'done', chars: textLength, audioBytes: totalAudioBytes };

  } finally {
    reader.releaseLock();
  }
}


/**
 * Returns entire audio response as a single chunk (non-streaming mode).
 * Includes optional metadata from response headers.
 */
export async function* returnAudioWholeOrThrow(
  response: Response,
  textLength: number,
  audioMeta?: Pick<Extract<SpeexSpeechParticle, { t: 'audio' }>, 'contentType' | 'characterCost' | 'ttsLatencyMs'>,
): AsyncGenerator<SpeexSpeechParticle> {

  const audioArrayBuffer = await response.arrayBuffer();
  yield {
    t: 'audio',
    base64: Buffer.from(audioArrayBuffer).toString('base64'),
    chunk: false,
    ...(audioMeta?.contentType ? { contentType: audioMeta.contentType } : {}),
    ...(audioMeta?.characterCost ? { characterCost: audioMeta.characterCost } : {}),
    ...(audioMeta?.ttsLatencyMs ? { ttsLatencyMs: audioMeta.ttsLatencyMs } : {}),
  };

  yield { t: 'done', chars: textLength, audioBytes: audioArrayBuffer.byteLength };

}
