/**
 * Inworld AI TTS Synthesizer
 *
 * Implements Inworld's Text-to-Speech API:
 * - Non-streaming: POST /tts/v1/voice
 * - Streaming: POST /tts/v1/voice:stream (newline-delimited JSON)
 * - Authentication: Basic auth with base64-encoded API key
 *
 * API Reference: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech
 */

import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { SpeexSpeechParticle, SpeexWire_Access_Inworld, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './synthesize.core';
import { SPEEX_DEBUG, SPEEX_DEFAULTS } from '../../speex.config';


export namespace InworldWire_TTS_Synthesize {

  /// Request Schema
  // API Reference: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech
  // Note: Request schemas are intentionally loose - server validates constraints

  const _AudioConfig_schema = z.object({
    audioEncoding: z.enum(['LINEAR16', 'MP3', 'OGG_OPUS', 'ALAW', 'MULAW', 'FLAC']).or(z.string()).optional(),
    sampleRateHertz: z.number().optional(), // 8000-48000 Hz
    speakingRate: z.number().optional(),    // 0.5x to 1.5x speed
    bitRate: z.number().optional(),         // for compressed formats
  });

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({
    text: z.string(),                       // max 2000 chars per request
    voiceId: z.string(),
    modelId: z.string(),                    // e.g., 'inworld-tts-1.5-max', 'inworld-tts-1.5-mini'
    temperature: z.number().optional(),     // 0-2, default 1.1
    applyTextNormalization: z.enum(['ON', 'OFF', 'UNSPECIFIED']).or(z.string()).optional(),
    audioConfig: _AudioConfig_schema.optional(),
    timestampType: z.enum(['WORD', 'CHARACTER', 'UNSPECIFIED']).or(z.string()).optional(),
  });


  /// Response Schema (non-streaming)

  const _Usage_schema = z.object({
    processedCharactersCount: z.number().optional(),
    modelId: z.string().optional(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    audioContent: z.string(),                                             // base64-encoded audio (max 16MB)
    usage: _Usage_schema.optional(),
    timestampInfo: z.object({
      wordAlignment: z.unknown().optional(),
      characterAlignment: z.unknown().optional(),
    }).optional(),
    phoneticDetails: z.array(z.unknown()).optional(),                     // TTS 1.5 models only
  });

  /// Streaming Chunk Schema (newline-delimited JSON, wrapped in "result")

  const _StreamChunkResult_schema = z.object({
    audioContent: z.string().optional(),                                  // base64-encoded audio chunk
    usage: _Usage_schema.optional(),
    timestampInfo: z.object({
      wordAlignment: z.unknown().optional(),
    }).optional(),
  });

  export type StreamChunk = z.infer<typeof StreamChunk_schema>;
  export const StreamChunk_schema = z.object({
    result: _StreamChunkResult_schema,
  });

}

export namespace InworldWire_TTS_ListVoices {

  // Voice resource from Voices API
  // API Reference: https://docs.inworld.ai/api-reference/voices/list-voices-in-a-workspace
  // Note: Workspace ID can be omitted from path - derived from API key

  const _Voice_schema = z.object({
    name: z.string().optional(),                                          // Resource name: workspaces/{workspace}/voices/{voice}
    langCode: z.string().optional(), // we won't restrict to known codes
    displayName: z.string().optional(),                                   // Human-readable name (required in API, optional for parsing)
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),                                 // e.g., ['male', 'energetic', 'expressive']
    voiceId: z.string(),                                                  // Globally unique: {workspace}__{voice}
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    voices: z.array(_Voice_schema),
  });

}


function _selectModel(priority: 'fast' | 'balanced' | 'quality' | undefined, languageCode: string | undefined): string {
  const fast = SPEEX_DEFAULTS.INWORLD_MODEL_FAST;
  const quality = SPEEX_DEFAULTS.INWORLD_MODEL;
  return priority === 'fast' ? fast               // lowest latency
    : priority === 'quality' ? quality            // highest quality
      : languageCode?.toLowerCase() === 'en' ? fast : quality; // 'balanced'/undefined
}


export const synthesizeInworld: SynthesizeBackendFn<SpeexWire_Access_Inworld> = async function* (params) {
  const { access, text: inputText, voice, streaming, languageCode, priority, signal } = params;
  if (access.dialect !== 'inworld' || voice.dialect !== 'inworld')
    throw new Error('Mismatched dialect in Inworld synthesize');

  // safety check: trim text that's too long (Inworld max is 2000 chars)
  // NOTE: we shall make sure the caller 'chunker' is aware of the 2000 max
  let text = inputText;
  if (text.length > SPEEX_DEFAULTS.INWORLD_TTS_MAX_LEN) {
    text = text.slice(0, SPEEX_DEFAULTS.INWORLD_TTS_MAX_LEN);
    yield { t: 'log', level: 'info', message: `Text truncated to ${SPEEX_DEFAULTS.INWORLD_TTS_MAX_LEN} characters (Inworld limit)` };
  }

  // request
  const { headers, url } = _inworldAccess(access, streaming ? '/tts/v1/voice:stream' : '/tts/v1/voice');
  const body: InworldWire_TTS_Synthesize.Request = {
    text,
    voiceId: voice.ttsVoiceId || SPEEX_DEFAULTS.INWORLD_VOICE,
    modelId: voice.ttsModel || _selectModel(priority, languageCode),
    ...(voice.ttsTemperature !== undefined && { temperature: voice.ttsTemperature }),
    audioConfig: {
      audioEncoding: 'MP3', // MP3 for browser MediaSource compatibility
      sampleRateHertz: 48000, // also default
      ...(voice.ttsSpeakingRate !== undefined && { speakingRate: voice.ttsSpeakingRate }),
    },
    // applyTextNormalization: ... // defaults to automatically detecting whether to apply text normalization
  } as const;

  // fetch
  let response: Response;
  try {
    if (SPEEX_DEBUG) console.log(`[Speex][Inworld] POST (stream=${streaming})`, { url, headers: { ...headers, Authorization: '[REDACTED]' }, body });
    response = await fetchResponseOrTRPCThrow({ url, method: 'POST', headers, body, signal, name: 'Inworld' });
  } catch (error: any) {
    yield { t: 'error', e: `Inworld fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // stream back S/NS response
  try {
    yield* streaming
      ? _streamInworldChunks(response, text.length)
      : _returnInworldWhole(response, text.length);
  } catch (error: any) {
    yield { t: 'error', e: `Inworld audio error: ${error.message || 'Unknown error'}` };
  }
};


/** Process streaming response (newline-delimited JSON chunks). */
async function* _streamInworldChunks(response: Response, textLength: number): AsyncGenerator<SpeexSpeechParticle> {
  if (!response.body) throw new Error('Inworld streaming response has no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) buffer += '\n'; // on stream end, add newline to flush any remaining buffer

      // JSON: process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parseResult = InworldWire_TTS_Synthesize.StreamChunk_schema.safeParse(JSON.parse(trimmed));
          if (!parseResult.success) {
            if (SPEEX_DEBUG) console.warn('[Speex][Inworld] Invalid streaming chunk:', parseResult.error.message, trimmed.slice(0, 100));
            continue;
          }

          const { result } = parseResult.data;
          if (result.audioContent) {
            const audioBytes = Math.ceil(result.audioContent.length * 3 / 4); // Approximate base64 decoded size
            totalBytes += audioBytes;
            yield {
              t: 'audio',
              chunk: true,
              base64: result.audioContent,
              contentType: 'audio/mpeg',
            };
          }
        } catch {
          // Ignore parse errors (partial/malformed chunks)
        }
      }

      if (done) break;
    }

    yield { t: 'done', chars: textLength, audioBytes: totalBytes };

  } finally {
    reader.releaseLock();
  }
}

/** Process non-streaming response (single JSON with base64 audio). */
async function* _returnInworldWhole(response: Response, textLength: number): AsyncGenerator<SpeexSpeechParticle> {
  const json = InworldWire_TTS_Synthesize.Response_schema.parse(await response.json());

  const audioBytes = Math.ceil(json.audioContent.length * 3 / 4);

  yield {
    t: 'audio',
    chunk: false,
    base64: json.audioContent,
    contentType: 'audio/mpeg',
    characterCost: json.usage?.processedCharactersCount,
  };

  yield { t: 'done', chars: textLength, audioBytes };
}


/**
 * List available voices from Inworld.
 * API: GET /voices/v1/voices (workspace derived from API key)
 */
export async function listVoicesInworld(access: SpeexWire_Access_Inworld): Promise<SpeexWire_ListVoices_Output> {
  const { headers, url } = _inworldAccess(access, '/voices/v1/voices');

  const voicesResponse = InworldWire_TTS_ListVoices.Response_schema.parse(
    await fetchJsonOrTRPCThrow({ url, headers, name: 'Inworld' }),
  );

  const voices = voicesResponse.voices.map(voice => ({
    id: voice.voiceId,
    name: voice.displayName || voice.voiceId,
    description: voice.description || undefined,
    category: voice.tags?.join(', ') || undefined,
  }));

  // ensure default voice is in the list
  const defaultVoiceId = SPEEX_DEFAULTS.INWORLD_VOICE;
  if (!voices.some(v => v.id === defaultVoiceId)) {
    console.error(`[Speex][Inworld] Default voice "${defaultVoiceId}" not found in voice list, adding it manually.`);
    voices.unshift({
      id: defaultVoiceId,
      name: defaultVoiceId,
      description: 'Default voice',
      category: undefined,
    });
  }

  return { voices };
}


// Helpers

function _inworldAccess(access: SpeexWire_Access_Inworld, apiPath: string): { headers: HeadersInit; url: string } {
  const apiKey = (access.apiKey || '').trim();
  if (!apiKey)
    throw new Error('Missing Inworld API key');

  let host = (access.apiHost || 'api.inworld.ai').trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);

  return {
    headers: {
      'Authorization': `Basic ${apiKey}`, // Inworld API key is already base64-encoded
      'Content-Type': 'application/json',
    },
    url: host + apiPath,
  };
}
