/**
 * OpenAI-compatible TTS Synthesizer
 *
 * Supports both OpenAI and LocalAI dialects using the same protocol.
 * Endpoint: POST /v1/audio/speech
 */

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SynthesizeBackendFn } from './speex.router';
import type { SpeexWire_Access_OpenAI, SpeexWire_ListVoices_Output } from './speex.wiretypes';


// configuration
const SAFETY_TEXT_LENGTH = 4096; // OpenAI max
const MIN_CHUNK_SIZE = 4096; // bytes
const FALLBACK_OPENAI_MODEL = 'tts-1';
const FALLBACK_OPENAI_VOICE_ID = 'alloy';


/** OpenAI TTS API: POST /v1/audio/speech */
interface OpenAIWire_TTSRequest {
  input: string;
  model: string;          // required: 'tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'
  voice: string;          // required: 'alloy', 'echo', 'fable', etc.
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;         // 0.25-4.0
  instructions?: string;  // voice instructions
}

/** LocalAI TTS API: POST /v1/audio/speech (OpenAI-similar) */
interface LocalAIWire_TTSRequest {
  input: string;
  model?: string;         // optional: e.g., 'kokoro'
  backend?: string;       // optional: 'coqui', 'bark', 'piper', 'transformers-musicgen', 'vall-e-x'
  language?: string;      // optional: for multilingual models
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'; // defaults to 'wav', 'mp3' also seem to work well, with kokoro at least
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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(!apiKey ? {} : { 'Authorization': `Bearer ${apiKey}` }),
    ...(!access.orgId ? {} : { 'OpenAI-Organization': access.orgId }),
  };

  // request.body
  let body: OpenAIWire_TTSRequest | LocalAIWire_TTSRequest;
  switch (access.dialect) {
    case 'localai':
      if (voice.dialect !== 'localai') throw new Error('Voice dialect mismatch for LocalAI access');
      body = {
        input: text,
        ...(voice.backend ? { backend: voice.backend } : {}),
        ...(voice.model ? { model: voice.model } : {}),
        ...(voice.language ? { language: voice.language } : {}),
        response_format: 'mp3', // MP3 for MediaSource compatibility
        // response_format: streaming ? 'wav' : 'mp3',
      } satisfies LocalAIWire_TTSRequest;
      break;

    case 'openai':
      if (voice.dialect !== 'openai') throw new Error('Voice dialect mismatch for OpenAI access');
      body = {
        input: text,
        model: voice.model || FALLBACK_OPENAI_MODEL,
        voice: ('voiceId' in voice ? voice.voiceId : undefined) || FALLBACK_OPENAI_VOICE_ID,
        ...(voice.speed !== undefined ? { speed: voice.speed } : {}),
        ...(voice.instruction ? { instructions: voice.instruction } : {}),
        response_format: 'mp3', // MP3 for MediaSource compatibility
        // response_format: streaming ? 'wav' : 'mp3',
      } satisfies OpenAIWire_TTSRequest;
      break;
  }

  // connect
  let response: Response;
  try {
    response = await fetchResponseOrTRPCThrow({
      url: `${host}/v1/audio/speech`,
      method: 'POST',
      headers,
      body,
      signal,
      name: access.dialect === 'localai' ? 'LocalAI' : 'OpenAI',
    });
  } catch (error: any) {
    const dialectName = access.dialect === 'localai' ? 'LocalAI' : 'OpenAI';
    yield { t: 'error', e: `${dialectName} TTS fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // non-streaming: return entire audio at once
  if (!streaming) {
    try {
      const audioArrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioArrayBuffer).toString('base64');
      yield { t: 'audio', base64, final: true };
      yield { t: 'done', chars: text.length };
    } catch (error: any) {
      yield { t: 'error', e: `Audio decode failed: ${error.message || 'Unknown error'}` };
    }
    return;
  }

  // streaming: read chunks
  const reader = response.body?.getReader();
  if (!reader)
    return yield { t: 'error', e: 'No stream reader available' };

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
    yield { t: 'error', e: `Stream error: ${error.message || 'Unknown error'}` };
  }
};


//
// List Voices - OpenAI (hardcoded)
//

const OPENAI_TTS_VOICES: SpeexWire_ListVoices_Output['voices'] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
  { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
  { id: 'echo', name: 'Echo', description: 'Clear and resonant' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
  { id: 'marin', name: 'Marin', description: 'Expressive and confident' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
  { id: 'sage', name: 'Sage', description: 'Calm and wise' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and bright' },
];

export function listVoicesOpenAI(): SpeexWire_ListVoices_Output['voices'] {
  return OPENAI_TTS_VOICES;
}


//
// List Voices - LocalAI
//

const KNOWN_TTS_MODELS: Record<string, { name: string; description: string }> = {
  'kokoro': { name: 'Kokoro', description: 'High-quality neural TTS' },
  'bark': { name: 'Bark', description: 'Text-to-audio by Suno AI' },
  'piper': { name: 'Piper', description: 'Fast local TTS' },
  'coqui': { name: 'Coqui', description: 'Coqui TTS engine' },
  'vall-e-x': { name: 'VALL-E X', description: 'Zero-shot voice cloning' },
  'tts-1': { name: 'TTS-1', description: 'OpenAI-compatible TTS' },
  'tts-1-hd': { name: 'TTS-1 HD', description: 'High-definition TTS' },
};

/** LocalAI GET /v1/models response */
interface LocalAIWire_ModelsResponse {
  object: 'list';
  data: Array<{ id: string; object: 'model' }>;
}

/**
 * List available TTS models from LocalAI instance
 */
export async function listVoicesLocalAI(access: SpeexWire_Access_OpenAI): Promise<SpeexWire_ListVoices_Output> {
  if (access.dialect !== 'localai')
    throw new Error('listVoicesLocalAI requires localai dialect');

  const { host, apiKey } = _resolveAccess(access);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(!apiKey ? {} : { 'Authorization': `Bearer ${apiKey}` }),
  };

  let modelsResponse: LocalAIWire_ModelsResponse;
  try {
    modelsResponse = await fetchJsonOrTRPCThrow<LocalAIWire_ModelsResponse>({
      url: `${host}/v1/models`,
      headers,
      name: 'LocalAI',
    });
  } catch (error: any) {
    console.warn('[listVoicesLocalAI] Failed to fetch models:', error.message);
    return { voices: [] };
  }

  // Filter to known TTS models only
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
