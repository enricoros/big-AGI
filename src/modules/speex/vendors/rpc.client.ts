/**
 * Speex RPC Client
 *
 * Handles communication with speex.router for cloud TTS providers.
 * Resolves credentials from engine configuration and calls the streaming API.
 */

import { apiAsync, apiStream } from '~/common/util/trpc.client';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';

import type { DCredentialsApiKey, DCredentialsLLMSService, DSpeexEngineAny, SpeexRPCDialect } from '../speex.types';
import type { SpeexSpeakResult } from '../speex.client';
import type { SpeexWire_Access, SpeexWire_ListVoices_Output, SpeexWire_Voice } from '../server/speex.wiretypes';


/**
 * Synthesize speech via speex.router (streaming)
 */
export async function speexSynthesizeRPC(
  engine: DSpeexEngineAny,
  text: string,
  options: { streaming: boolean; playback: boolean; returnAudio: boolean },
  callbacks?: {
    onStart?: () => void;
    onChunk?: (chunk: ArrayBuffer) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {

  // Resolve wire access from engine credentials
  const access = _resolveWireAccess(engine);
  if (!access) {
    const error = new Error(`Failed to resolve credentials for engine ${engine.engineId}`);
    callbacks?.onError?.(error);
    return { success: false, error: error.message };
  }

  // Build wire voice from engine voice
  const voice = _buildWireVoice(engine);

  // Create abort controller
  const abortController = new AbortController();

  // Audio player for streaming playback
  let audioPlayer: AudioLivePlayer | null = null;
  const audioChunks: ArrayBuffer[] = [];

  try {
    // Call the streaming RPC
    const particleStream = await apiStream.speex.synthesize.mutate(
      { access, text, voice, streaming: options.streaming },
      { signal: abortController.signal },
    );

    // Process streaming particles
    for await (const particle of particleStream) {
      switch (particle.t) {
        case 'start':
          callbacks?.onStart?.();
          if (options.playback && options.streaming) {
            audioPlayer = new AudioLivePlayer();
          }
          break;

        case 'audio':
          // Decode base64 to ArrayBuffer
          const audioBuffer = _base64ToArrayBuffer(particle.base64);

          // Playback
          if (options.playback && audioPlayer)
            audioPlayer.enqueueChunk(audioBuffer);

          // Accumulate for return
          if (options.returnAudio)
            audioChunks.push(audioBuffer);

          // Callback
          callbacks?.onChunk?.(audioBuffer);
          break;

        case 'done':
          if (audioPlayer)
            audioPlayer.endPlayback();
          break;

        case 'error':
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(particle.e);
      }
    }

    callbacks?.onComplete?.();

    // Build result
    const result: SpeexSpeakResult = { success: true };

    if (options.returnAudio && audioChunks.length > 0) {
      // Concatenate all chunks and convert to base64
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      result.audioBase64 = _arrayBufferToBase64(combined.buffer);
    }

    return result;

  } catch (error: any) {
    // Cleanup
    if (audioPlayer) {
      void audioPlayer.stop();
    }

    const errorMessage = error.message || 'Synthesis failed';
    callbacks?.onError?.(new Error(errorMessage));
    return { success: false, error: errorMessage };
  }
}


/**
 * List voices via speex.router
 */
export async function speexListVoicesRPC(engine: DSpeexEngineAny): Promise<SpeexWire_ListVoices_Output> {
  const access = _resolveWireAccess(engine);
  if (!access) {
    return { voices: [] };
  }

  try {
    return await apiAsync.speex.listVoices.query({ access });
  } catch (error) {
    console.error('Failed to list voices:', error);
    return { voices: [] };
  }
}


// Private: Credential Resolution

function _resolveWireAccess(engine: DSpeexEngineAny): SpeexWire_Access | null {
  const { vendorType, credentials } = engine;

  // webspeech doesn't use RPC
  if (vendorType === 'webspeech') return null;

  const dialect = vendorType as SpeexRPCDialect;

  switch (credentials.type) {
    case 'api-key':
      return _resolveFromApiKey(dialect, credentials);

    case 'llms-service':
      return _resolveFromLLMService(dialect, credentials);

    default:
      // 'none' credentials or unknown type
      return null;
  }
}


function _resolveFromApiKey(dialect: SpeexRPCDialect, credentials: DCredentialsApiKey): SpeexWire_Access | null {
  switch (dialect) {
    case 'elevenlabs':
      if (!credentials.apiKey) return null;
      return {
        dialect: 'elevenlabs',
        apiKey: credentials.apiKey,
        apiHost: credentials.apiHost,
      };

    case 'openai':
      if (!credentials.apiKey) return null;
      return {
        dialect: 'openai',
        apiKey: credentials.apiKey,
        apiHost: credentials.apiHost,
      };

    case 'localai':
      if (!credentials.apiHost) return null;
      return {
        dialect: 'localai',
        apiKey: credentials.apiKey,
        apiHost: credentials.apiHost,
      };
  }
}


function _resolveFromLLMService(dialect: SpeexRPCDialect, credentials: DCredentialsLLMSService): SpeexWire_Access | null {
  const service = findModelsServiceOrNull(credentials.serviceId);
  if (!service) return null;

  // Extract credentials based on LLM vendor type
  const setup = service.setup as Record<string, any> || {};

  switch (dialect) {
    case 'elevenlabs':
      // ElevenLabs doesn't link to LLM services
      return null;

    case 'openai':
      // OpenAI LLM service uses oaiKey, oaiHost, oaiOrg
      return {
        dialect: 'openai',
        apiKey: setup.oaiKey || '',
        apiHost: setup.oaiHost || undefined,
        orgId: setup.oaiOrg || undefined,
      };

    case 'localai':
      // LocalAI LLM service uses host
      // LocalAI vendor uses 'localAIHost' field
      const host = setup.localAIHost || setup.oaiHost || '';
      if (!host) return null;
      return {
        dialect: 'localai',
        apiHost: host,
        apiKey: setup.localAIKey || setup.oaiKey || '',
      };
  }
}


// Private: Voice Building

function _buildWireVoice(engine: DSpeexEngineAny): SpeexWire_Voice {
  const { vendorType, voice } = engine;

  switch (vendorType) {
    case 'elevenlabs':
      return {
        dialect: 'elevenlabs',
        ...(voice.voiceId ? { voiceId: voice.voiceId } : {}),
        ...(voice.ttsModel ? { model: voice.ttsModel } : {}),
      };

    case 'openai':
      return {
        dialect: 'openai',
        ...(voice.voiceId ? { voiceId: voice.voiceId } : {}),
        ...(voice.ttsModel ? { model: voice.ttsModel } : {}),
        ...(voice.speed !== undefined ? { speed: voice.speed } : {}),
        ...(voice.instruction ? { instruction: voice.instruction } : {}),
      };

    case 'localai':
      return {
        dialect: 'localai',
        ...(voice.ttsBackend ? { backend: voice.ttsBackend } : {}),
        ...(voice.ttsModel ? { model: voice.ttsModel } : {}),
        ...(voice.language ? { language: voice.language } : {}),
      };

    case 'webspeech':
      // webspeech doesn't use wire protocol
      throw new Error('webspeech does not use RPC');
  }
}


// Private: Helpers

function _base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function _arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
