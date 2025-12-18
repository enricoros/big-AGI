import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexSpeechParticle, SpeexWire_Access_ElevenLabs, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './rpc.router';
import { SPEEX_DEBUG, SPEEX_DEFAULTS } from '../../speex.config';
import { returnAudioWholeOrThrow, streamAudioChunksOrThrow } from './rpc.streaming';


// configuration
const SAFETY_TEXT_LENGTH = 1000;
const MIN_CHUNK_SIZE = 4096;


const _selectModel = (priority: 'fast' | 'balanced' | 'quality' | undefined, languageCode: string | undefined): string => {
  const fast = SPEEX_DEFAULTS.ELEVENLABS_MODEL_FAST;
  const quality = SPEEX_DEFAULTS.ELEVENLABS_MODEL;
  return priority === 'fast' ? fast               // lowest latency, best for real-time use cases like calls
    : priority === 'quality' ? quality            // multilingual v2 (highest quality)
      : languageCode?.toLowerCase() === 'en' ? fast : quality; // 'balanced'/undefined: English → turbo, non-English → multilingual
};


export const synthesizeElevenLabs: SynthesizeBackendFn<SpeexWire_Access_ElevenLabs> = async function* (params) {

  // destructure and validate
  const { access, text: inputText, voice, streaming, languageCode, priority, signal } = params;
  if (access.dialect !== 'elevenlabs' || voice.dialect !== 'elevenlabs')
    throw new Error('Mismatched dialect in ElevenLabs synthesize');


  // safety check: trim text that's too long
  let text = inputText;
  if (text.length > SAFETY_TEXT_LENGTH) {
    text = text.slice(0, SAFETY_TEXT_LENGTH);
    // -> log.info
    yield { t: 'log', level: 'info', message: `Text truncated to ${SAFETY_TEXT_LENGTH} characters` };
  }

  // build request - narrow to elevenlabs dialect for type safety
  const voiceId = voice.ttsVoiceId /*|| env.ELEVENLABS_VOICE_ID*/ || SPEEX_DEFAULTS.ELEVENLABS_VOICE;
  const model = voice.ttsModel || _selectModel(priority, languageCode);

  const path = `/v1/text-to-speech/${voiceId}${streaming ? '/stream' : ''}`;
  const { headers, url } = _elevenlabsAccess(access, path);

  const body: ElevenLabsWire.TTS_Request = {
    text,
    model_id: model,
  } as const;

  // Fetch
  let response: Response;
  try {
    if (SPEEX_DEBUG) console.log(`[Speex][ElevenLabs] POST (stream=${streaming})`, { url, headers, body });
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

  // Stream or return whole audio (with metadata for non-streaming)
  try {
    yield* streaming
      ? streamAudioChunksOrThrow(response, MIN_CHUNK_SIZE, text.length)
      : returnAudioWholeOrThrow(response, text.length, _parseTTSResponseHeaders(response.headers));
  } catch (error: any) {
    yield { t: 'error', e: `ElevenLabs audio error: ${error.message || 'Unknown error'}` };
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

  // map to output
  const voices = voicesList.voices.map(voice => ({
    id: voice.voice_id,
    name: voice.name,
    description: voice.description || undefined,
    previewUrl: voice.preview_url || undefined,
    category: voice.category,
    // Flatten labels for UI display
    // gender: voice.labels?.gender || undefined,
    // accent: voice.labels?.accent || undefined,
    // age: voice.labels?.age || undefined,
    // language: voice.labels?.language || undefined,
  }));

  // inject Rachel (default voice) if not already in the list
  const rachelId = SPEEX_DEFAULTS.ELEVENLABS_VOICE;
  if (!voices.some(v => v.id === rachelId))
    voices.unshift({
      id: rachelId,
      name: 'Rachel',
      description: 'Matter-of-fact, personable woman. Great for conversational use cases.',
      category: 'premade',
      previewUrl: undefined,
    });

  // sort: custom voices first, then premade
  voices.sort((a, b) => {
    if (a.category === 'premade' && b.category !== 'premade') return 1;
    if (a.category !== 'premade' && b.category === 'premade') return -1;
    return 0;
  });

  return { voices };
}


// Helpers

function _parseTTSResponseHeaders(headers: Headers): Pick<Extract<SpeexSpeechParticle, { t: 'audio' }>, 'contentType' | 'characterCost' | 'ttsLatencyMs'> {
  return {
    contentType: headers.get('content-type') || 'audio/mpeg',
    characterCost: parseInt(headers.get('character-cost') || '0') || undefined,
    ttsLatencyMs: parseInt(headers.get('tts-latency-ms') || '0') || undefined,
  };
}

function _elevenlabsAccess(access: SpeexWire_Access_ElevenLabs, apiPath: string): { headers: HeadersInit; url: string } {
  const apiKey = (access.apiKey /*|| env.ELEVENLABS_API_KEY */ || '').trim();
  if (!apiKey)
    throw new Error('Missing ElevenLabs API key');

  let host = (access.apiHost /*|| env.ELEVENLABS_API_HOST*/ || 'api.elevenlabs.io').trim();
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

  // export type VoicesList = z.infer<typeof VoicesList_schema>;
  export const VoicesList_schema = z.object({
    voices: z.array(z.object({
      voice_id: z.string(),
      name: z.string(),
      category: z.enum(['premade', 'cloned', 'professional']).or(z.string()),
      labels: z.looseObject({
        gender: z.enum(['male', 'female', 'neutral']).or(z.string()).nullish(),
        accent: z.string().nullish(),
        age: z.string().nullish(),
        language: z.string().nullish(),
      }),
      description: z.string().nullish(),
      preview_url: z.string().nullish(),
      settings: z.object({
        stability: z.number(),
        similarity_boost: z.number(),
      }).nullish(),
      // high_quality_base_model_ids: z.array(z.string()).nullish(),
      is_owner: z.boolean().nullish(),
      is_legacy: z.boolean().nullish(),
    })),
  });

  export type TTS_Request = z.infer<typeof TTS_Request_schema>;
  export const TTS_Request_schema = z.object({
    text: z.string(),
    model_id: z.string().optional(),
    voice_settings: z.object({
      stability: z.number(),
      similarity_boost: z.number(),
    }).optional(),
  });

}
