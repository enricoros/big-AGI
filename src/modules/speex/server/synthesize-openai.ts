/**
 * OpenAI-compatible TTS Synthesizer
 *
 * Supports both OpenAI and LocalAI dialects using the same protocol.
 * Endpoint: POST /v1/audio/speech
 */

import { fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexSpeechParticle, SpeexWire_Access_OpenAI, SpeexWire_Voice } from './speex.wiretypes';


// configuration
const SAFETY_TEXT_LENGTH = 4096; // OpenAI max
const MIN_CHUNK_SIZE = 4096;
const DEFAULT_VOICE_ID = 'alloy';
const DEFAULT_MODEL = 'tts-1';


interface SynthesizeOpenAIParams {
  access: SpeexWire_Access_OpenAI;
  text: string;
  voice: SpeexWire_Voice;
  streaming: boolean;
  signal?: AbortSignal;
}


/**
 * Synthesize speech using OpenAI-compatible TTS API.
 * Works with both OpenAI and LocalAI dialects.
 */
export async function* synthesizeOpenAIProtocol(params: SynthesizeOpenAIParams): AsyncGenerator<SpeexSpeechParticle> {
  const { access, text: inputText, voice, streaming, signal } = params;

  // Safety check: trim text that's too long
  let text = inputText;
  if (text.length > SAFETY_TEXT_LENGTH)
    text = text.slice(0, SAFETY_TEXT_LENGTH);

  // Resolve host and API key based on dialect
  const { host, apiKey } = _resolveAccess(access);

  // Build request
  const voiceId = voice.voiceId || DEFAULT_VOICE_ID;
  const model = voice.model || DEFAULT_MODEL;
  const url = `${host}/v1/audio/speech`;

  const body: OpenAIWire_TTSRequest = {
    input: text,
    model,
    voice: voiceId,
    // Use wav for streaming (lower latency, no decoding overhead)
    // Use mp3 for non-streaming (smaller size)
    response_format: streaming ? 'wav' : 'mp3',
  };

  // Add optional parameters if present
  if (voice.dialect === 'openai') {
    if (voice.speed !== undefined) body.speed = voice.speed;
    if (voice.instruction) body.instructions = voice.instruction;
  }

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (access.orgId) {
    headers['OpenAI-Organization'] = access.orgId;
  }

  // Fetch
  let response: Response;
  try {
    response = await fetchResponseOrTRPCThrow({
      url,
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

  // Non-streaming: return entire audio at once
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

  // Streaming: read chunks
  const reader = response.body?.getReader();
  if (!reader) {
    yield { t: 'error', e: 'No stream reader available' };
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
    yield { t: 'error', e: `Stream error: ${error.message || 'Unknown error'}` };
  }
}


// Helpers

function _resolveAccess(access: SpeexWire_Access_OpenAI): { host: string; apiKey: string } {
  if (access.dialect === 'openai') {
    // OpenAI: use default host if not specified, API key required
    let host = (access.apiHost || 'https://api.openai.com').trim();
    if (!host.startsWith('http'))
      host = `https://${host}`;
    if (host.endsWith('/'))
      host = host.slice(0, -1);

    return {
      host,
      apiKey: access.apiKey || '',
    };
  }

  // LocalAI: host required, API key optional
  let host = (access.apiHost || '').trim();
  if (!host) throw new Error('LocalAI requires apiHost to be specified');

  if (!host.startsWith('http')) {
    // noinspection HttpUrlsUsage
    host = `http://${host}`; // LocalAI is often local, default to http
  }
  if (host.endsWith('/'))
    host = host.slice(0, -1);

  return {
    host,
    apiKey: access.apiKey || '',
  };
}


// Wire types

interface OpenAIWire_TTSRequest {
  input: string;
  model: string;
  voice: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
  instructions?: string;
}
