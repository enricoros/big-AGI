/**
 * Speex - Speech Synthesis Module
 *
 * Centralized speech synthesis with provider abstraction.
 * Future: NorthBridge integration for queued audio output control.
 */

import type { DPersonaUid } from '~/common/stores/persona/persona.types';

import type { DSpeexVoice, SpeexEngineId } from './speex.types';

// ElevenLabs backend
import { elevenLabsSpeakText, isElevenLabsEnabled, useCapability as useElevenLabsCapability } from '~/modules/elevenlabs/elevenlabs.client';
import { getElevenLabsData } from '~/modules/elevenlabs/store-module-elevenlabs';


// Capability API

export interface SpeexCapability {
  mayWork: boolean;
  isConfiguredServerSide: boolean;
  isConfiguredClientSide: boolean;
}

export function useSpeexCapability(): SpeexCapability {
  const cap = useElevenLabsCapability();
  return {
    mayWork: cap.mayWork,
    isConfiguredServerSide: cap.isConfiguredServerSide,
    isConfiguredClientSide: cap.isConfiguredClientSide,
  };
}

export function isSpeexEnabled(): boolean {
  const { elevenLabsApiKey } = getElevenLabsData();
  return isElevenLabsEnabled(elevenLabsApiKey);
}


// Speech Synthesis API

type SpeexVoiceSelector =
  | undefined
  | { voice: DSpeexVoice } // uses the first voice.engineType engine, potentially overriding its voice settings
  | { engineId: SpeexEngineId, voice?: DSpeexVoice }; // selects a specific engine instance, potentially overriding its voice settings

type SpeexSpeakResult = {
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

  // Resolve instance: instanceId → providerType → active instance
  // Currently: single ElevenLabs instance, all paths resolve to it
  // Future: lookup from instance registry, handle cross-device fallback

  callbacks?.onStart?.();

  // FOR NOW - we only have a hardcoded ElevenLabs backend
  try {

    // Extract voiceId from the voice selector
    let elevenVoiceId: string | undefined;
    if (voice) {
      const voiceConfig = 'voice' in voice ? voice.voice : undefined;
      if (voiceConfig && 'voiceId' in voiceConfig && voiceConfig.voiceId)
        elevenVoiceId = voiceConfig.voiceId;
    }

    // Currently only ElevenLabs implemented
    // Future: dispatch based on resolved engine's engineType
    const result = await elevenLabsSpeakText(
      inputText,
      elevenVoiceId,
      streaming && playback,  // only stream if also playing
      true,                   // turbo mode
    );

    callbacks?.onComplete?.();

    return {
      success: result.success,
      audioBase64: returnAudio ? result.audioBase64 : undefined,
    };
  } catch (error) {
    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
