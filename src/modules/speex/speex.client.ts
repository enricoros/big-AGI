/**
 * Speex - Speech Synthesis Module
 *
 * Centralized speech synthesis with provider abstraction.
 * Supports multiple TTS engines: ElevenLabs, OpenAI, LocalAI, Web Speech.
 * Future: NorthBridge integration for queued audio output control.
 */

import type { DPersonaUid } from '~/common/stores/persona/persona.types';

// Legacy ElevenLabs capability check - fallback only, to be removed once fully ported
import { useCapabilityElevenlabs } from '~/modules/elevenlabs/elevenlabs.client';

import type { DSpeexEngineAny, DSpeexVoice, DVoiceWebSpeech, SpeexEngineId, SpeexVendorType } from './speex.types';
import { listWebSpeechVoices, speakWebSpeech } from './vendors/webspeech.client';
import { speexAreCredentialsValid, speexFindEngineById, speexFindGlobalEngine, speexFindValidEngineByType, useSpeexStore } from './store-module-speex';
import { speexListVoicesRPC, speexSynthesizeRPC } from './speex.rpc-client';


// Capability API

export interface SpeexCapability {
  mayWork: boolean;
  activeEngineId: SpeexEngineId | null;
  activeVendorType: SpeexVendorType | null;
  // Do we need these?
  // isConfiguredServerSide: boolean;
  // isConfiguredClientSide: boolean;
}

export function useSpeexCapability(): SpeexCapability {

  // external state
  const { engines, activeEngineId } = useSpeexStore();
  const legacy11Cap = useCapabilityElevenlabs(); // backwards compatibility - to be REMOVED


  // find active engine - may be null, even if soft deleted and the active ID still points to it
  const { engineId = null, vendorType = null } = engines.find(e => e.engineId === activeEngineId && !e.isDeleted) ?? {};

  return {
    // NOTE: the 'mayWork' logic may be wrong, will need to check how the callers use this value, as it's detached from the active engine
    mayWork: legacy11Cap.mayWork || engines.some(e => speexAreCredentialsValid(e.credentials)),
    activeEngineId: engineId,
    activeVendorType: vendorType,
    // isConfiguredServerSide: legacy11Cap.isConfiguredServerSide,
    // isConfiguredClientSide: legacy11Cap.isConfiguredClientSide || engines.some(e => _isSpeexEngineValid(e)),
  };
}

// Commented out - this immediate function does not seem to be used
// export function isSpeexEnabled(): boolean {
//   // check legacy ElevenLabs first
//   const { elevenLabsApiKey } = getElevenLabsData();
//   if (isElevenLabsEnabled(elevenLabsApiKey))
//     return true;
//
//   // check store-based engines
//   return speexResolveEngine() !== null;
// }


// Speech Synthesis API

export type SpeexVoiceSelector =
  | undefined
  | { voice: DSpeexVoice } // uses first matching engine for voice.vendorType
  | { engineId: SpeexEngineId; voice?: Partial<DSpeexVoice> }; // uses specific engine, optionally overriding voice

export type SpeexSpeakResult = {
  success: boolean;
  audioBase64?: string; // available when not streaming or when requested
  error?: string; // if success is false
}


export async function speakText(
  inputText: string,
  voice: SpeexVoiceSelector,
  options?: {
    label?: string;           // For NorthBridge queue display
    personaUid?: DPersonaUid; // For NorthBridge queue icon / controls (if the audio came from a persona)
    streaming?: boolean;      // Streaming defaults to True
    playback?: boolean;       // Play audio (default: true)
    returnAudio?: boolean;    // Accumulate full audio buffer in result, even if streaming (for save/download)
  },
  callbacks?: {
    onStart?: () => void;
    onChunk?: (chunk: ArrayBuffer) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {

  const streaming = options?.streaming ?? true;
  const playback = options?.playback ?? true;
  const returnAudio = options?.returnAudio ?? !streaming;

  // Resolve engine from voice selector
  // - priority: explicit engineId > voice.vendorType > store active > priority-ordered available
  const engine = _resolveEngineFromSelector(voice);

  callbacks?.onStart?.();

  // route based on engine
  try {

    switch (engine?.vendorType) {
      // Web Speech: client-only, no RPC
      case 'webspeech':
        return speakWebSpeech(inputText, engine.voice as DVoiceWebSpeech, callbacks);

      // RPC providers: route through speex.router RPC
      case 'elevenlabs':
      case 'openai':
      case 'localai':
        return speexSynthesizeRPC(engine, inputText, { streaming, playback, returnAudio }, callbacks);
    }

    // No engine found - return error
    return {
      success: false,
      error: 'No TTS engine configured. Please configure a TTS engine in Settings.',
    };
  } catch (error) {
    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


// Private: Engine resolution

function _resolveEngineFromSelector(selector: SpeexVoiceSelector): DSpeexEngineAny | null {
  if (!selector) return null;

  // A. most specific selector: engineId
  if ('engineId' in selector && selector.engineId) {
    const engine = speexFindEngineById(selector.engineId);
    if (engine) return engine;
  }

  // B. voice.vendorType - find first matching engine that's probably valid
  if ('voice' in selector && selector.voice?.vendorType) {
    const engine = speexFindValidEngineByType(selector.voice.vendorType);
    if (engine) return engine;
  }

  // C. fall back to priority-based
  return speexFindGlobalEngine();
}


// Voice Listing API

export interface SpeexVoiceInfo {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  category?: string;
}

/**
 * List available voices for an engine.
 * For cloud providers, this calls the speex.router RPC.
 * For webspeech, this uses the browser API.
 */
export async function speexListVoicesForEngine(engine: DSpeexEngineAny): Promise<SpeexVoiceInfo[]> {
  switch (engine.vendorType) {
    case 'webspeech':
      // Use browser API - synchronous but may need async loading
      const browserVoices = listWebSpeechVoices();
      return browserVoices.map(v => ({
        id: v.voiceURI,
        name: v.name,
        description: `${v.lang}${v.localService ? ' (local)' : ''}`,
      }));

    case 'elevenlabs':
    case 'openai':
    case 'localai':
      // Use RPC
      const result = await speexListVoicesRPC(engine);
      return result.voices;
  }
}
