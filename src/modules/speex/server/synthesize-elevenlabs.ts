import { env } from '~/server/env.server';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexSpeechParticle, SpeexWire_Access_ElevenLabs, SpeexWire_ListVoices_Output, SpeexWire_Voice } from './speex.wiretypes';


// configuration
const SAFETY_TEXT_LENGTH = 1000;
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel


interface SynthesizeElevenLabsParams {
  access: SpeexWire_Access_ElevenLabs;
  text: string;
  voice: SpeexWire_Voice;
  streaming: boolean;
  signal?: AbortSignal;
}


export async function* synthesizeElevenLabs(params: SynthesizeElevenLabsParams): AsyncGenerator<SpeexSpeechParticle> {
  const { access, text: inputText, voice, streaming, signal } = params;

  // Safety check: trim text that's too long
  let text = inputText;
  if (text.length > SAFETY_TEXT_LENGTH)
    text = text.slice(0, SAFETY_TEXT_LENGTH);

  // Build request
  const voiceId = voice.voiceId || DEFAULT_VOICE_ID;
  const model = voice.model || 'eleven_turbo_v2_5';
  const path = `/v1/text-to-speech/${voiceId}${streaming ? '/stream' : ''}`;
  const { headers, url } = _elevenlabsAccess(access, path);

  const body: ElevenlabsWire_TTSRequest = {
    text,
    model_id: model,
  };

  // Fetch
  let response: Response;
  try {
    response = await fetchResponseOrTRPCThrow({
      url,
      method: 'POST',
      headers,
      body,
      signal,
      name: 'ElevenLabs',
    });
  } catch (error: any) {
    yield { t: 'error', e: `ElevenLabs fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // Non-streaming: return entire audio at once
  if (!streaming) {
    try {
      const audioArrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioArrayBuffer).toString('base64');
      yield { t: 'audio', base64, final: true };
      yield { t: 'done', chars: text.length };
    } catch (error: any) {
      yield { t: 'error', e: `ElevenLabs audio decode failed: ${error.message || 'Unknown error'}` };
    }
    return;
  }

  // Streaming: read chunks
  const reader = response.body?.getReader();
  if (!reader) {
    yield { t: 'error', e: 'ElevenLabs: No stream reader available' };
    return;
  }

  try {
    const accumulatedChunks: Uint8Array[] = [];
    let accumulatedSize = 0;

    while (true) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      if (!value) continue;

      accumulatedChunks.push(value);
      accumulatedSize += value.length;

      // Yield when accumulated size reaches threshold
      if (accumulatedSize >= MIN_CHUNK_SIZE) {
        const base64 = Buffer.concat(accumulatedChunks).toString('base64');
        yield { t: 'audio', base64 };
        accumulatedChunks.length = 0;
        accumulatedSize = 0;
      }
    }

    // Yield any remaining data as final chunk
    if (accumulatedSize > 0) {
      const base64 = Buffer.concat(accumulatedChunks).toString('base64');
      yield { t: 'audio', base64, final: true };
    }

    yield { t: 'done', chars: text.length };

  } catch (error: any) {
    yield { t: 'error', e: `ElevenLabs stream error: ${error.message || 'Unknown error'}` };
  }
}


export async function listVoicesElevenLabs(access: SpeexWire_Access_ElevenLabs): Promise<SpeexWire_ListVoices_Output> {
  const { headers, url } = _elevenlabsAccess(access, '/v1/voices');

  const voicesList = await fetchJsonOrTRPCThrow<ElevenlabsWire_VoicesList>({
    url,
    headers,
    name: 'ElevenLabs',
  });

  // Sort: custom voices first, then premade
  voicesList.voices.sort((a, b) => {
    if (a.category === 'premade' && b.category !== 'premade') return 1;
    if (a.category !== 'premade' && b.category === 'premade') return -1;
    return 0;
  });

  return {
    voices: voicesList.voices.map(voice => ({
      id: voice.voice_id,
      name: voice.name,
      description: voice.description || undefined,
      previewUrl: voice.preview_url || undefined,
      category: voice.category,
    })),
  };
}


// Helpers

function _elevenlabsAccess(access: SpeexWire_Access_ElevenLabs, apiPath: string): { headers: HeadersInit; url: string } {
  const apiKey = (access.apiKey || env.ELEVENLABS_API_KEY || '').trim();
  if (!apiKey)
    throw new Error('Missing ElevenLabs API key');

  let host = (access.apiHost || env.ELEVENLABS_API_HOST || 'api.elevenlabs.io').trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);

  return {
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    url: host + apiPath,
  };
}


// Wire types

interface ElevenlabsWire_TTSRequest {
  text: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
}

interface ElevenlabsWire_VoicesList {
  voices: Array<{
    voice_id: string;
    name: string;
    category: string;
    labels: Record<string, string>;
    description: string;
    preview_url: string;
    settings: {
      stability: number;
      similarity_boost: number;
    };
  }>;
}
