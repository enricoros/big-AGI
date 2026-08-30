import * as z from 'zod/v4';

import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexSpeechParticle, SpeexWire_Access_Gandr, SpeexWire_VoiceOption } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './synthesize.core';
import { SPEEX_DEBUG, SPEEX_DEFAULTS } from '../../speex.config';
import { returnAudioWholeOrThrow, streamAudioChunksOrThrow } from './rpc.streaming';


// configuration
const MIN_CHUNK_SIZE = 4096;


export const synthesizeGandr: SynthesizeBackendFn<SpeexWire_Access_Gandr> = async function* (params) {

  // destructure and validate
  const { access, text, voice, streaming, signal } = params;
  if (access.dialect !== 'gandr' || voice.dialect !== 'gandr')
    throw new Error('Mismatched dialect in Gandr synthesize');

  // input cap: the API accepts up to 2000 characters per request
  // (client-side text chunking keeps requests below the cap)
  if (text.length > SPEEX_DEFAULTS.GANDR_MAX_LEN)
    throw new Error(`Input exceeds the Gandr maximum of ${SPEEX_DEFAULTS.GANDR_MAX_LEN} characters per request`);

  // build request - narrow to gandr dialect for type safety
  const path = '/v1/audio/speech';
  const { headers, url } = _gandrAccess(access, path);

  const body: GandrWire.TTS_Request = {
    model: voice.ttsModel || SPEEX_DEFAULTS.GANDR_MODEL,
    input: text,
    voice: voice.ttsVoiceId || SPEEX_DEFAULTS.GANDR_VOICE,
    response_format: 'mp3',
  } as const;

  // Fetch
  let response: Response;
  try {
    if (SPEEX_DEBUG) console.log(`[Speex][Gandr] POST (stream=${streaming})`, { url, headers, body });
    response = await fetchResponseOrTRPCThrow({
      url,
      method: 'POST',
      headers,
      body,
      signal,
      name: 'Gandr',
    });
  } catch (error: any) {
    yield { t: 'error', e: `Gandr fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // Stream or return whole audio (with metadata for non-streaming)
  try {
    yield* streaming
      ? streamAudioChunksOrThrow(response, MIN_CHUNK_SIZE, text.length)
      : returnAudioWholeOrThrow(response, text.length, _parseTTSResponseHeaders(response.headers));
  } catch (error: any) {
    yield { t: 'error', e: `Gandr audio error: ${error.message || 'Unknown error'}` };
  }
};


export function listVoicesGandr(): SpeexWire_VoiceOption[] {
  return [
    { id: 'gandr-mia', name: 'Mia', category: 'premade' },
    { id: 'gandr-ava', name: 'Ava', category: 'premade' },
    { id: 'gandr-jenny', name: 'Jenny', category: 'premade' },
    { id: 'gandr-dane', name: 'Dane', category: 'premade' },
    { id: 'gandr-leo', name: 'Leo', category: 'premade' },
    { id: 'gandr-lewis', name: 'Lewis', category: 'premade' },
  ];
}


// Helpers

function _parseTTSResponseHeaders(headers: Headers): Pick<Extract<SpeexSpeechParticle, { t: 'audio' }>, 'contentType' | 'characterCost' | 'ttsLatencyMs'> {
  return {
    contentType: headers.get('content-type') || 'audio/mpeg',
    characterCost: parseInt(headers.get('character-cost') || '0') || undefined,
    ttsLatencyMs: parseInt(headers.get('tts-latency-ms') || '0') || undefined,
  };
}

function _gandrAccess(access: SpeexWire_Access_Gandr, apiPath: string): { headers: HeadersInit; url: string } {
  const apiKey = (access.apiKey /*|| env.GANDR_API_KEY */ || '').trim();
  if (!apiKey)
    throw new Error('Missing Gandr API key');

  let host = (access.apiHost /*|| env.GANDR_API_HOST*/ || 'tts.gandr.ai').trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);

  return {
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    url: host + apiPath,
  };
}


// Wire types for the upstream Gandr API

namespace GandrWire {

  export type TTS_Request = z.infer<typeof TTS_Request_schema>;
  export const TTS_Request_schema = z.object({
    model: z.string(),
    input: z.string(),
    voice: z.string(),
    response_format: z.enum(['mp3', 'wav', 'pcm']).optional(),
  });

}
