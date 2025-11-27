import * as z from 'zod/v4';
import { env } from '~/server/env.server';
import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexWire_Access_ElevenLabs, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './rpc.router';


// configuration
const SAFETY_TEXT_LENGTH = 1000;
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const DEFAULT_MODEL_ENGLISH = 'eleven_turbo_v2_5';
const DEFAULT_MODEL_MULTILINGUAL = 'eleven_multilingual_v2';


const _selectModelForLanguage = (languageCode: string | undefined): string =>
  languageCode?.toLowerCase() === 'en' ? DEFAULT_MODEL_ENGLISH : DEFAULT_MODEL_MULTILINGUAL;


export const synthesizeElevenLabs: SynthesizeBackendFn<SpeexWire_Access_ElevenLabs> = async function* (params) {

  // destructure and validate
  const { access, text: inputText, voice, streaming, languageCode, signal } = params;
  if (access.dialect !== 'elevenlabs' || voice.dialect !== 'elevenlabs')
    throw new Error('Mismatched dialect in ElevenLabs synthesize');


  // safety check: trim text that's too long
  let text = inputText;
  if (text.length > SAFETY_TEXT_LENGTH)
    text = text.slice(0, SAFETY_TEXT_LENGTH);


  // build request - narrow to elevenlabs dialect for type safety
  const voiceId = (voice.dialect === 'elevenlabs' ? voice.voiceId : undefined) || DEFAULT_VOICE_ID;

  // Model selection: use explicit model if provided, otherwise auto-select based on language
  const explicitModel = voice.dialect === 'elevenlabs' ? voice.model : undefined;
  const model = explicitModel || _selectModelForLanguage(languageCode);

  const path = `/v1/text-to-speech/${voiceId}${streaming ? '/stream' : ''}`;
  const { headers, url } = _elevenlabsAccess(access, path);

  const body: ElevenLabsWire.TTS_Request = {
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
};


export async function listVoicesElevenLabs(access: SpeexWire_Access_ElevenLabs): Promise<SpeexWire_ListVoices_Output> {
  const { headers, url } = _elevenlabsAccess(access, '/v1/voices');

  // fetch voices
  const voicesList = ElevenLabsWire.VoicesList_schema.parse(
    await fetchJsonOrTRPCThrow({
      url,
      headers,
      name: 'ElevenLabs',
    }),
  );

  // sort: custom voices first, then premade
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


// Wire types for the upstream ElevenLabs API

namespace ElevenLabsWire {

  export type TTS_Request = z.infer<typeof TTS_Request_schema>;
  export const TTS_Request_schema = z.object({
    text: z.string(),
    model_id: z.string().optional(),
    voice_settings: z.object({
      stability: z.number(),
      similarity_boost: z.number(),
    }).optional(),
  });

  // export type VoicesList = z.infer<typeof VoicesList_schema>;
  export const VoicesList_schema = z.object({
    voices: z.array(z.object({
      voice_id: z.string(),
      name: z.string(),
      category: z.string(),
      labels: z.record(z.string(), z.string()),
      description: z.string(),
      preview_url: z.string(),
      settings: z.object({
        stability: z.number(),
        similarity_boost: z.number(),
      }),
    })),
  });

}
