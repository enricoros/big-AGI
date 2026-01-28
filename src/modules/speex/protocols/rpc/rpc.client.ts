/**
 * Speex RPC Client
 *
 * Handles communication with speex.router for cloud TTS providers.
 *
 * Supports both tRPC (server-routed) and CSF (client-side fetch) modes.
 * CSF if is essential for local services (LocalAI, Ollama) that are unreachable
 * from cloud deployments like Vercel.
 */

import { apiAsync, apiStream } from '~/common/util/trpc.client';
import { combine_ArrayBuffers_To_Uint8Array, convert_Base64_To_UInt8Array, convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';
import { isLocalUrl } from '~/common/util/urlUtils';
import { stripUndefined } from '~/common/util/objectUtils';

import type { DLocalAIServiceSettings } from '~/modules/llms/vendors/localai/localai.vendor';
import type { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';

import type { AudioAutoPlayer } from '~/common/util/audio/AudioAutoPlayer';

import type { DSpeexEngine, SpeexListVoiceOption, SpeexSynthesizeResult } from '../../speex.types';
import type { SpeexWire_Access, SpeexWire_Voice } from './rpc.wiretypes';
import { SPEEX_DEBUG } from '../../speex.config';


// --- CSF: cached dynamic import for client-side fetch, unbundled ---

let _speexCsfModule: typeof import('./synthesize.core') | null = null;

async function _getSpeexCsfModule() {
  if (!_speexCsfModule)
    _speexCsfModule = await import('./synthesize.core');
  return _speexCsfModule;
}

// --- /CSF


type _DSpeexEngineRPC = DSpeexEngine<'elevenlabs'> | DSpeexEngine<'inworld'> | DSpeexEngine<'localai'> | DSpeexEngine<'openai'>;


/**
 * Synthesize speech via speex.router (streaming)
 */
export async function speexSynthesize_RPC(
  engine: _DSpeexEngineRPC,
  text: string,
  options: {
    dataStreaming: boolean; // data streaming
    returnAudioBuffer: boolean; // yes: heavy, will accumulate audio as a single base64 results
    languageCode?: string;
    priority?: 'fast' | 'balanced' | 'quality';
  },
  abortController: AbortController,
  createAudioPlayer?: () => AudioAutoPlayer,
): Promise<SpeexSynthesizeResult> {

  // engine credentials (DCredentials..) -> wire Access
  if (SPEEX_DEBUG) console.log(`[Speex RPC] Synthesize request (engine: ${engine.engineId}, ${text.length} chars) - options:`, options);
  const access = stripUndefined(_buildRPCWireAccess(engine));
  if (!access)
    return { success: false, errorType: 'tts-unconfigured', errorText: `Failed to resolve credentials for engine ${engine.engineId}` };

  // engine voice -> wire Voice
  // IMPORTANT: TS ensures structural compatibility here between the DVoice* and Voice*_schema types
  const voice: SpeexWire_Voice = stripUndefined(engine.voice);


  // if !!createAudioPlayer, we stream audio to it as we receive it
  let audioPlayer: AudioAutoPlayer | undefined;

  // if options.returnAudioBuffer, we accumulate audio chunks here
  const returnedAudioChunks: ArrayBuffer[] = [];

  try {

    // call the streaming RPC - whether the backend will stream in chunks or as a whole
    const synthInput = {
      access,
      text,
      voice,
      streaming: options.dataStreaming,
      ...(options.languageCode && { languageCode: options.languageCode }),
      ...(options.priority && { priority: options.priority }),
    };
    const particleStream = !_shouldUseCSF(engine)
      ? await apiStream.speex.synthesize.mutate(synthInput, { signal: abortController.signal })
      : (await _getSpeexCsfModule()).speexRpcCoreSynthesize(synthInput, abortController.signal);

    // process streaming particles
    for await (const particle of particleStream) {
      if (SPEEX_DEBUG) console.log('[Speex RPC] <-', particle);
      switch (particle.t) {
        case 'start':
          if (createAudioPlayer)
            audioPlayer = createAudioPlayer();
          break;

        case 'audio':
          // Decode base64 to ArrayBuffer
          const audioData = convert_Base64_To_UInt8Array(particle.base64, 'speex.rpc.client');

          // Accumulate for return (copy bytes before playback may transfer/detach the buffer)
          if (options.returnAudioBuffer)
            returnedAudioChunks.push(audioData.slice().buffer);

          // Play if requested, in both chunked and full modes
          if (particle.chunk)
            audioPlayer?.enqueueChunk(audioData.buffer);
          else
            audioPlayer?.playFullBuffer(audioData.buffer);
          break;

        case 'log':
          // intended to be user visible
          console.log(`[Speex] (${particle.level})`, particle.message);
          break;

        case 'done':
          if (SPEEX_DEBUG) console.log(`[Speex RPC] Synthesis done: ${particle.chars} chars, ${particle.audioBytes} bytes, ${particle.durationMs} ms`);
          audioPlayer?.endPlayback();
          break;

        case 'error':
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(particle.e);
      }
    }

    // build result
    const result: SpeexSynthesizeResult = { success: true };

    if (options.returnAudioBuffer && returnedAudioChunks.length > 0) {
      // Concatenate all chunks and convert to base64
      const combined = combine_ArrayBuffers_To_Uint8Array(returnedAudioChunks);
      result.audioBase64 = convert_UInt8Array_To_Base64(combined, 'speex.rpc.client');
    }

    return result;

  } catch (error: any) {
    if (SPEEX_DEBUG) console.error('[Speex RPC] Synthesis error:', { error });
    audioPlayer?.stop();
    return { success: false, errorType: 'tts-exception', errorText: error.message || 'Synthesis failed' };
  }
}


/**
 * List available voices for an engine.
 */
export async function speexListVoices_RPC_orThrow(engine: _DSpeexEngineRPC): Promise<SpeexListVoiceOption[]> {
  const access = stripUndefined(_buildRPCWireAccess(engine));
  if (!access)
    return [];

  try {
    const results = !_shouldUseCSF(engine)
      ? await apiAsync.speex.listVoices.query({ access })
      : await (await _getSpeexCsfModule()).speexRpcCoreListVoices(access);

    return results.voices;
  } catch (error) {
    if (SPEEX_DEBUG) console.error('[Speex RPC] List voices error:', { error });
    throw error;
  }
}


// -- private helpers --

function _buildRPCWireAccess({ credentials: c, vendorType }: _DSpeexEngineRPC): SpeexWire_Access | null {
  switch (c.type) {

    // resolve from inline API keys
    case 'api-key':
      switch (vendorType) {
        case 'elevenlabs':
        case 'inworld':
          return {
            dialect: vendorType,
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
        case 'inworld':
          // no linking for ElevenLabs or Inworld - we shall NOT be here
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

/**
 * Determine if CSF should be used - separate from access building.
 * CSF is a client routing decision based on:
 * - Local URLs (unreachable from cloud servers like Vercel)
 * - Explicit CSF setting in linked LLM service
 */
function _shouldUseCSF({ credentials: c, vendorType }: _DSpeexEngineRPC): boolean {
  switch (c.type) {
    case 'api-key':
      // Auto-enable CSF for local URLs (LocalAI typically runs locally)
      switch (vendorType) {
        case 'inworld':
          return false; // Inworld has blocked CORS policy - never CSF

        case 'localai':
          return isLocalUrl(c.apiHost);

        default:
          const _exhaustiveCheck: never = vendorType;
        // fallthrough
        case 'elevenlabs':
        case 'openai':
          break;
      }
      // NOTE: we should have a switch or something
      return false;

    case 'llms-service':
      const service = findModelsServiceOrNull(c.serviceId);
      if (!service) return false;

      switch (vendorType) {
        case 'localai':
          const lai = (service.setup || {}) as DLocalAIServiceSettings;
          return lai.csf || isLocalUrl(lai.localAIHost);

        case 'openai':
          const oai = (service.setup || {}) as DOpenAIServiceSettings;
          return !!oai.csf;

        default:
          return false;
      }
  }
}
