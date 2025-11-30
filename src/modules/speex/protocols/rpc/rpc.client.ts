/**
 * Speex RPC Client
 *
 * Handles communication with speex.router for cloud TTS providers.
 * Resolves credentials from engine configuration and calls the streaming API.
 */

import { apiAsync, apiStream } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array, convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';
import { stripUndefined } from '~/common/util/objectUtils';

import type { DLocalAIServiceSettings } from '~/modules/llms/vendors/localai/localai.vendor';
import type { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';

import type { DSpeexEngine, SpeexListVoiceOption, SpeexSpeakResult } from '../../speex.types';
import type { SpeexWire_Access, SpeexWire_Voice } from './rpc.wiretypes';
import { SPEEX_DEBUG } from '../../speex.config';


type _DSpeexEngineRPC = DSpeexEngine<'elevenlabs'> | DSpeexEngine<'localai'> | DSpeexEngine<'openai'>;


/**
 * Synthesize speech via speex.router (streaming)
 */
export async function speexSynthesize_RPC(
  engine: _DSpeexEngineRPC,
  text: string,
  options: {
    streaming: boolean;
    languageCode?: string;
    priority?: 'fast' | 'balanced' | 'quality';
    playback: boolean;
    returnAudio: boolean;
  },
  callbacks?: {
    onStart?: () => void;
    onChunk?: (chunk: ArrayBuffer) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {

  // engine credentials (DCredentials..) -> wire Access
  if (SPEEX_DEBUG) console.log(`[Speex RPC] Synthesize request (engine: ${engine.engineId}, ${text.length} chars) - options:`, options);
  const access = stripUndefined(_buildRPCWireAccess(engine));
  if (!access) {
    const error = new Error(`Failed to resolve credentials for engine ${engine.engineId}`);
    callbacks?.onError?.(error);
    return { success: false, errorType: 'tts-unconfigured', error: error.message };
  }

  // engine voice -> wire Voice
  // IMPORTANT: TS ensures structural compatibility here between the DVoice* and Voice*_schema types
  const voice: SpeexWire_Voice = stripUndefined(engine.voice);


  // audio player for streaming playback
  let audioPlayer: AudioLivePlayer | null = null;
  const audioChunks: ArrayBuffer[] = [];

  const abortController = new AbortController();

  try {

    // call the streaming RPC - whether the backend will stream in chunks or as a whole
    const particleStream = await apiStream.speex.synthesize.mutate({
      access,
      text,
      voice,
      streaming: options.streaming,
      ...(options.languageCode && { languageCode: options.languageCode }),
      ...(options.priority && { priority: options.priority }),
    }, {
      signal: abortController.signal,
    });

    // process streaming particles
    for await (const particle of particleStream) {
      if (SPEEX_DEBUG) console.log('[Speex RPC] <-', particle);
      switch (particle.t) {
        case 'start':
          callbacks?.onStart?.();
          if (options.playback && options.streaming)
            audioPlayer = new AudioLivePlayer();
          break;

        case 'audio':
          // Decode base64 to ArrayBuffer
          const audioData = convert_Base64_To_UInt8Array(particle.base64, 'speex.rpc.client');

          // Accumulate for return (copy bytes before playback may transfer/detach the buffer)
          if (options.returnAudio)
            audioChunks.push(audioData.slice().buffer);

          // Playback: streaming uses AudioLivePlayer for chunked playback,
          // non-streaming uses AudioPlayer for single-buffer playback
          if (options.playback) {
            if (particle.chunk) {
              // create the player on-demand, however in the near future we'll migrate to
              // Northbridge AudioPlayer for all playback needs
              if (!audioPlayer)
                audioPlayer = new AudioLivePlayer();

              audioPlayer.enqueueChunk(audioData.buffer);
            } else {
              // also consider merging LiveAudioPlayer into AudioPlayer - note this will throw on malformed base64 data
              void AudioPlayer.playBuffer(audioData.buffer); // fire-and-forget for whole audio
            }
          }

          // Callback
          callbacks?.onChunk?.(audioData.buffer);
          break;

        case 'log':
          // intended to be user visible
          console.log(`[Speex] (${particle.level})`, particle.message);
          break;

        case 'done':
          const { chars, audioBytes, durationMs } = particle;
          if (SPEEX_DEBUG) console.log(`[Speex RPC] Synthesis done: ${chars} chars, ${audioBytes} bytes, ${durationMs} ms`);

          // NOTE: calling this will end the sound abruptly if the final chunk is still playing, so we don't do it for now
          audioPlayer?.endPlayback();
          break;

        case 'error':
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(particle.e);
      }
    }

    callbacks?.onComplete?.();

    // build result
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
      result.audioBase64 = convert_UInt8Array_To_Base64(combined, 'speex.rpc.client');
    }

    return result;

  } catch (error: any) {
    if (SPEEX_DEBUG) console.error('[Speex RPC] Synthesis error:', { error });

    // cleanup
    if (audioPlayer)
      void audioPlayer.stop();

    const errorMessage = error.message || 'Synthesis failed';
    callbacks?.onError?.(new Error(errorMessage));
    return { success: false, errorType: 'tts-exception', error: errorMessage };
  }
}


/**
 * List voices via speex.router
 */
export async function speexListVoices_RPC_orThrow(engine: _DSpeexEngineRPC): Promise<SpeexListVoiceOption[]> {
  const access = _buildRPCWireAccess(engine);
  if (!access)
    return [];

  return (await apiAsync.speex.listVoices.query({ access })).voices;
}


// -- private helpers --

function _buildRPCWireAccess({ credentials: c, vendorType }: _DSpeexEngineRPC): SpeexWire_Access | null {
  switch (c.type) {

    // resolve from inline API keys
    case 'api-key':
      switch (vendorType) {
        case 'elevenlabs':
          return {
            dialect: 'elevenlabs',
            apiKey: c.apiKey,
            ...(c.apiHost && { apiHost: c.apiHost }),
          };

        case 'localai':
        case 'openai':
          return {
            dialect: vendorType,
            ...(c.apiKey && { apiKey: c.apiKey }),
            ...(c.apiHost && { apiHost: c.apiHost }),
            // ...(c.apiOrgId && { apiOrgId: c.apiOrgId }),
          };

        default:
          const _exhaustiveCheck: never = vendorType;
          return null;
      }

    // resolve from LLMs services
    case 'llms-service':
      const service = findModelsServiceOrNull(c.serviceId);
      if (!service) return null;
      switch (vendorType) {
        case 'elevenlabs':
          // no linking for ElevenLabs - we shall NOT be here
          return null;

        case 'openai':
          const oai = (service.setup || {}) as DOpenAIServiceSettings;
          return {
            dialect: vendorType,
            ...(oai.oaiKey && { apiKey: oai.oaiKey }),
            ...(oai.oaiHost && { apiHost: oai.oaiHost }),
            ...(oai.oaiOrg && { apiOrgId: oai.oaiOrg }),
          };

        case 'localai':
          const lai = (service.setup || {}) as DLocalAIServiceSettings;
          return {
            dialect: vendorType,
            ...(lai.localAIKey && { apiKey: lai.localAIKey }),
            ...(lai.localAIHost && { apiHost: lai.localAIHost }),
          };

        default:
          const _exhaustiveCheck: never = vendorType;
          return null;
      }
  }
}
