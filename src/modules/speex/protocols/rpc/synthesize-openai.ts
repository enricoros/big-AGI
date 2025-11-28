/**
 * OpenAI-compatible/friendly TTS Synthesizer
 */

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexWire_Access_OpenAI, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './rpc.router';
import { SPEEX_DEBUG, SPEEX_DEFAULTS } from '../../speex.config';
import { returnAudioWholeOrThrow, streamAudioChunksOrThrow } from './rpc.streaming';


// configuration
const SAFETY_TEXT_LENGTH = 4096; // OpenAI max
const MIN_CHUNK_SIZE = 4096; // bytes


// OpenAI TTS API: POST /v1/audio/speech
interface OpenAIWire_TTS_Request {
  input: string;
  model: string;          // required: 'tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'
  voice: string;          // required: 'alloy', 'echo', 'fable', etc.
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;         // 0.25-4.0
  instructions?: string;  // voice instructions
}

// LocalAI TTS API: POST /v1/audio/speech
interface LocalAIWire_TTS_Request {
  input: string;
  model?: string;         // optional: e.g., 'kokoro'
  backend?: string;       // optional: 'coqui', 'bark', 'piper', 'transformers-musicgen', 'vall-e-x'
  language?: string;      // optional: for multilingual models
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'; // defaults to 'wav', 'mp3' also seem to work well, with kokoro at least
}

interface LocalAIWire_ListModels_Response {
  object: 'list';
  data: Array<{ id: string; object: 'model' }>;
}


/**
 * Synthesize speech using OpenAI-compatible/similar TTS API.
 */
export const synthesizeOpenAIProtocol: SynthesizeBackendFn<SpeexWire_Access_OpenAI> = async function* (params) {

  const { access, text: inputText, voice, streaming, signal } = params;

  // safety check: trim text that's too long
  let text = inputText;
  if (text.length > SAFETY_TEXT_LENGTH)
    text = text.slice(0, SAFETY_TEXT_LENGTH);


  // request.headers
  const { host, apiKey } = _resolveAccess(access);
  const url = `${host}/v1/audio/speech`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(!apiKey ? {} : { 'Authorization': `Bearer ${apiKey}` }),
    ...(!access.apiOrgId ? {} : { 'OpenAI-Organization': access.apiOrgId }),
  };

  // request.body
  let body: OpenAIWire_TTS_Request | LocalAIWire_TTS_Request;
  switch (access.dialect) {
    case 'localai':
      if (voice.dialect !== 'localai') throw new Error('Voice dialect mismatch for LocalAI access');
      body = {
        input: text,
        ...(voice.ttsBackend ? { backend: voice.ttsBackend } : {}),
        ...(voice.ttsModel ? { model: voice.ttsModel } : {}),
        ...(voice.ttsLanguage ? { language: voice.ttsLanguage } : {}),
        response_format: 'mp3', // MP3 for MediaSource compatibility
        // response_format: streaming ? 'wav' : 'mp3',
      } satisfies LocalAIWire_TTS_Request;
      break;

    case 'openai':
      if (voice.dialect !== 'openai') throw new Error('Voice dialect mismatch for OpenAI access');
      body = {
        input: text,
        model: voice.ttsModel || SPEEX_DEFAULTS.OPENAI_MODEL,
        voice: voice.ttsVoiceId || SPEEX_DEFAULTS.OPENAI_VOICE,
        ...(voice.ttsSpeed !== undefined ? { speed: voice.ttsSpeed } : {}),
        ...(voice.ttsInstruction ? { instructions: voice.ttsInstruction } : {}),
        response_format: 'mp3', // MP3 for MediaSource compatibility
        // response_format: streaming ? 'wav' : 'mp3',
      } satisfies OpenAIWire_TTS_Request;
      break;
  }

  // connect
  const dialectName = access.dialect === 'localai' ? 'LocalAI' : 'OpenAI';
  let response: Response;
  try {
    if (SPEEX_DEBUG) console.log(`[Speex][OpenAI] POST (stream=${streaming})`, { url, headers, body });
    response = await fetchResponseOrTRPCThrow({
      url,
      method: 'POST',
      headers,
      body,
      signal,
      name: dialectName,
    });
  } catch (error: any) {
    yield { t: 'error', e: `${dialectName} TTS fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // Stream or return whole audio
  try {
    yield* streaming
      ? streamAudioChunksOrThrow(response, MIN_CHUNK_SIZE, text.length)
      : returnAudioWholeOrThrow(response, text.length);
  } catch (error: any) {
    yield { t: 'error', e: `${dialectName} audio error: ${error.message || 'Unknown error'}` };
  }
};


//
// List Voices - OpenAI (hardcoded)
//

export function listVoicesOpenAI(): SpeexWire_ListVoices_Output['voices'] {
  // Valid voices per OpenAI API: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer
  return [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
    { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
    { id: 'echo', name: 'Echo', description: 'Clear and resonant' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
    { id: 'sage', name: 'Sage', description: 'Calm and wise' },
    { id: 'shimmer', name: 'Shimmer', description: 'Clear and bright' },
  ];
}


//
// List Voices - LocalAI
//

export async function listVoicesLocalAIOrThrow(access: SpeexWire_Access_OpenAI): Promise<SpeexWire_ListVoices_Output> {
  if (access.dialect !== 'localai')
    throw new Error('listVoicesLocalAI requires localai dialect');

  const { host, apiKey } = _resolveAccess(access);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(!apiKey ? {} : { 'Authorization': `Bearer ${apiKey}` }),
  };

  let modelsResponse: LocalAIWire_ListModels_Response;
  try {
    modelsResponse = await fetchJsonOrTRPCThrow<LocalAIWire_ListModels_Response>({
      url: `${host}/v1/models`,
      headers,
      name: 'LocalAI',
    });
  } catch (error: any) {
    // ok to be user visible
    console.warn('[DEV] Speex: listVoicesLocalAI: Failed to fetch models:', error.message);
    throw error;
  }

  // Filter to known TTS models to provide a better start
  const KNOWN_TTS_MODELS: Record<string, { name: string; description: string }> = {
    'kokoro': { name: 'Kokoro', description: 'High-quality neural TTS' },
    'bark': { name: 'Bark', description: 'Text-to-audio by Suno AI' },
    'piper': { name: 'Piper', description: 'Fast local TTS' },
    'coqui': { name: 'Coqui', description: 'Coqui TTS engine' },
    'vall-e-x': { name: 'VALL-E X', description: 'Zero-shot voice cloning' },
    'tts-1': { name: 'TTS-1', description: 'OpenAI-compatible TTS' },
    'tts-1-hd': { name: 'TTS-1 HD', description: 'High-definition TTS' },
  };
  const ttsModels = modelsResponse.data.filter(model => model.id in KNOWN_TTS_MODELS);

  return {
    voices: ttsModels.map(model => ({
      id: model.id,
      name: KNOWN_TTS_MODELS[model.id].name,
      description: KNOWN_TTS_MODELS[model.id].description,
    })),
  };
}


// Helpers

function _resolveAccess(access: Readonly<SpeexWire_Access_OpenAI>): { host: string; apiKey: string } {

  // determine host
  const isOpenAI = access.dialect === 'openai';
  let host = isOpenAI
    ? (access.apiHost || 'https://api.openai.com').trim()
    : (access.apiHost || '').trim();
  if (!host) throw new Error('LocalAI requires a host URL');
  if (!host.startsWith('http')) {
    // noinspection HttpUrlsUsage
    host = isOpenAI ? `https://${host}` : `http://${host}`; // LocalAI is often local, default to http
  }
  if (host.endsWith('/'))
    host = host.slice(0, -1);

  return { host, apiKey: access.apiKey || '' };
}
