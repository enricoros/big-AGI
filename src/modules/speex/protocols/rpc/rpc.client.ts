/**
 * Speex RPC Client
 *
 * Handles communication with speex.router for cloud TTS providers.
 * Resolves credentials from engine configuration and calls the streaming API.
 */

import { apiAsync, apiStream } from '~/common/util/trpc.client';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import { AudioLivePlayer } from '~/common/util/audio/AudioLivePlayer';

import { DSpeexEngine, SpeexSpeakResult } from '../../speex.types';
import type { SpeexWire_Access, SpeexWire_ListVoices_Output, SpeexWire_Voice } from './rpc.wiretypes';
import { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';
import { DLocalAIServiceSettings } from '~/modules/llms/vendors/localai/localai.vendor';


type _DSpeexEngineRPC = DSpeexEngine<'elevenlabs'> | DSpeexEngine<'localai'> | DSpeexEngine<'openai'>;


/**
 * Synthesize speech via speex.router (streaming)
 */
export async function speexSynthesize_RPC(
  engine: _DSpeexEngineRPC,
  text: string,
  options: {
    streaming: boolean;
    playback: boolean;
    returnAudio: boolean;
    languageCode?: string
  },
  callbacks?: {
    onStart?: () => void;
    onChunk?: (chunk: ArrayBuffer) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {

  // engine credentials (DCredentials..) -> wire Access
  const access = _buildWireAccess(engine);
  if (!access) {
    const error = new Error(`Failed to resolve credentials for engine ${engine.engineId}`);
    callbacks?.onError?.(error);
    return { success: false, errorType: 'tts-unconfigured', error: error.message };
  }

  // engine voice -> wire Voice
  // IMPORTANT: TS ensures structural compatibility here between the DVoice* and Voice*_schema types
  const voice: SpeexWire_Voice = engine.voice;


  // audio player for streaming playback
  let audioPlayer: AudioLivePlayer | null = null;
  const audioChunks: ArrayBuffer[] = [];

  const abortController = new AbortController();

  try {

    // call the streaming RPC - whether the backend will stream in chunks or as a whole
    const particleStream = await apiStream.speex.synthesize.mutate(
      { access, text, voice, streaming: options.streaming, languageCode: options.languageCode },
      { signal: abortController.signal },
    );

    // process streaming particles
    for await (const particle of particleStream) {
      switch (particle.t) {
        case 'start':
          callbacks?.onStart?.();
          if (options.playback && options.streaming)
            audioPlayer = new AudioLivePlayer();
          break;

        case 'audio':
          // Decode base64 to ArrayBuffer
          // const audioBuffer = convert_Base64_To_UInt8Array(particle.base64, 'speexSynthesize_RPC audio chunk'); // preload conversion
          const audioBuffer = _base64ToArrayBuffer(particle.base64);

          // Playback
          if (options.playback)
            audioPlayer?.enqueueChunk(audioBuffer);

          // Accumulate for return
          if (options.returnAudio)
            audioChunks.push(audioBuffer);

          // Callback
          callbacks?.onChunk?.(audioBuffer);
          break;

        case 'done':
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
      result.audioBase64 = _arrayBufferToBase64(combined.buffer);
    }

    return result;

  } catch (error: any) {
    // Cleanup
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
export async function speexListVoicesRPC(engine: _DSpeexEngineRPC): Promise<SpeexWire_ListVoices_Output> {
  const access = _buildWireAccess(engine);
  if (!access)
    return { voices: [] };

  try {
    return await apiAsync.speex.listVoices.query({ access });
  } catch (error) {
    // console.log('[DEV] speexListVoicesRPC. Failed to list voices:', error);
    return { voices: [] };
  }
}


// -- private helpers --

function _buildWireAccess({ credentials, vendorType }: _DSpeexEngineRPC): SpeexWire_Access | null {
  // noinspection FallThroughInSwitchStatementJS
  switch (credentials.type) {

    // resolve from inline API keys
    case 'api-key':
      switch (vendorType) {
        case 'elevenlabs':
          return { dialect: 'elevenlabs', apiKey: credentials.apiKey, apiHost: credentials.apiHost };

        case 'localai':
        case 'openai':
          return { dialect: vendorType, apiKey: credentials.apiKey, apiHost: credentials.apiHost /*, orgId: credentials.orgId */ };
      }

    // resolve from LLMs services
    case 'llms-service':
      const service = findModelsServiceOrNull(credentials.serviceId);
      if (!service) return null;
      switch (vendorType) {
        case 'elevenlabs':
          // no linking for ElevenLabs - we shall NOT be here
          return null;

        case 'openai':
          const oai = (service.setup || {}) as DOpenAIServiceSettings;
          return {
            dialect: vendorType,
            ...(oai.oaiKey ? { apiKey: oai.oaiKey } : {}),
            ...(oai.oaiHost ? { apiHost: oai.oaiHost } : {}),
            ...(oai.oaiOrg ? { orgId: oai.oaiOrg } : {}),
          };

        case 'localai':
          const lai = (service.setup || {}) as DLocalAIServiceSettings;
          return {
            dialect: vendorType,
            ...(lai.localAIHost ? { apiHost: lai.localAIHost } : {}),
            ...(lai.localAIKey ? { apiKey: lai.localAIKey } : {}),
          };
      }
  }
}

// Private: Helpers

// TODO: use `blobUtils.ts` functions instead?

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
