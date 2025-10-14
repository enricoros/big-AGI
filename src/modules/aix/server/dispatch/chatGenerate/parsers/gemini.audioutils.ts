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
  const pcmBuffer = Buffer.from(base64PCMData, 'base64');

  const wavBuffer = createWAVFromPCM(pcmBuffer, format);
  const durationMs = calculateDurationMs(pcmBuffer.length, format);

  return {
    mimeType: 'audio/wav',
    base64Data: wavBuffer.toString('base64'),
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
 * Create WAV file from raw PCM data
 */
export function createWAVFromPCM(pcmData: Buffer, format: AudioFormat): Buffer {
  const { channels, sampleRate, bitsPerSample } = format;

  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // PCM chunk size
  header.writeUInt16LE(1, 20);            // Audio format (1 = PCM)
  header.writeUInt16LE(channels, 22);     // Number of channels
  header.writeUInt32LE(sampleRate, 24);   // Sample rate
  header.writeUInt32LE(byteRate, 28);     // Byte rate
  header.writeUInt16LE(blockAlign, 32);   // Block align
  header.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/** Calculate audio duration in milliseconds */
export function calculateDurationMs(dataSize: number, format: AudioFormat): number {
  const { channels, sampleRate, bitsPerSample } = format;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = dataSize / (channels * bytesPerSample);
  return Math.round((totalSamples / sampleRate) * 1000);
}
