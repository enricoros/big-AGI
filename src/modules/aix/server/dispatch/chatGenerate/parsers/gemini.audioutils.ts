import { convert_Base64_To_UInt8Array, convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';


export interface AudioFormat {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
}

interface ConvertedAudio {
  mimeType: string;
  base64Data: string;
  durationMs: number;
}


/** Convert Gemini PCM audio to WAV format */
export function geminiConvertPCM2WAV(mimeType: string, base64PCMData: string): ConvertedAudio {
  const format = parseGeminiAudioMimeType(mimeType);
  const pcmBytes = convert_Base64_To_UInt8Array(base64PCMData, 'gemini.audioutils');

  const wavBytes = createWAVFromPCM(pcmBytes, format);
  const durationMs = calculateDurationMs(pcmBytes.length, format);

  return {
    mimeType: 'audio/wav',
    base64Data: convert_UInt8Array_To_Base64(wavBytes, 'gemini.audioutils'),
    durationMs,
  };
}


/**
 * Parse Gemini audio MIME type to extract format parameters
 * Example: "audio/L16;codec=pcm;rate=24000" -> { channels: 1, sampleRate: 24000, bitsPerSample: 16 }
 */
function parseGeminiAudioMimeType(mimeType: string): AudioFormat {

  const [baseType, ...params] = mimeType.split(';').map(s => s.trim());

  // Initialize default format
  const format: AudioFormat = {
    channels: 1, // Default to mono
    sampleRate: 24000, // Default for Gemini
    bitsPerSample: 16, // Default
  };

  // Parse format from base type (e.g., "L16" -> 16 bits)
  const [, formatPart] = baseType.split('/');
  if (formatPart?.startsWith('L')) {
    const bits = parseInt(formatPart.slice(1), 10);
    if (!isNaN(bits))
      format.bitsPerSample = bits;
  }

  // Parse parameters
  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    switch (key) {
      case 'codec':
        if (value !== 'pcm')
          throw new Error('Unsupported codec: PCM. Gemini audio should be in PCM format.');
        break;
      case 'rate':
        const rate = parseInt(value, 10);
        if (!isNaN(rate)) format.sampleRate = rate;
        break;
      case 'channels':
        const channels = parseInt(value, 10);
        if (!isNaN(channels)) format.channels = channels;
        break;
      default:
        console.warn(`[DEV] geminiConvertPCM2WAV: unknown audio parameter: ${key}=${value}`);
        break;
    }
  }

  return format;
}

/**
 * Create WAV file from raw PCM data - runtime-portable (no Buffer): Uint8Array + DataView
 */
export function createWAVFromPCM(pcmData: Uint8Array, format: AudioFormat): Uint8Array {
  const { channels, sampleRate, bitsPerSample } = format;

  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < tag.length; i++)
      wav[offset + i] = tag.charCodeAt(i);
  };

  // RIFF header
  writeTag(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeTag(8, 'WAVE');

  // fmt chunk
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // Audio format (1 = PCM)
  view.setUint16(22, channels, true);      // Number of channels
  view.setUint32(24, sampleRate, true);    // Sample rate
  view.setUint32(28, byteRate, true);      // Byte rate
  view.setUint16(32, blockAlign, true);    // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample

  // data chunk
  writeTag(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM payload
  wav.set(pcmData, 44);
  return wav;
}

/** Calculate audio duration in milliseconds */
export function calculateDurationMs(dataSize: number, format: AudioFormat): number {
  const { channels, sampleRate, bitsPerSample } = format;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = dataSize / (channels * bytesPerSample);
  return Math.round((totalSamples / sampleRate) * 1000);
}
