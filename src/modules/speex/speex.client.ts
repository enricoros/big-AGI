/**
 * Speex - Speech Synthesis Module
 *
 * Centralized speech synthesis with provider abstraction.
 * Supports multiple TTS engines: ElevenLabs, OpenAI, LocalAI, Web Speech.
 * Future: NorthBridge integration for queued audio output control.
 */

import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { DSpeexEngineAny, DSpeexVoice, DVoiceWebSpeech, SpeexEngineId, SpeexSpeakOptions, SpeexSpeakResult } from './speex.types';
import { speexFindEngineById, speexFindGlobalEngine, speexFindValidEngineByType } from './store-module-speex';

import { speexSynthesize_RPC } from './protocols/rpc/rpc.client';
import { speexSynthesize_WebSpeech } from './protocols/webspeech/webspeech.client';


// Speech Synthesis API

type _Speak_VoiceSelector =
  | undefined
  | { voice: Partial<DSpeexVoice> } // uses first matching engine for voice.dialect, with voice override
  | { engineId: SpeexEngineId; voice?: Partial<DSpeexVoice> }; // uses specific engine, optionally overriding voice

type _Speak_Callbacks = {
  onStart?: () => void;
  onChunk?: (chunk: ArrayBuffer) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export async function speakText(inputText: string, voiceSelector: _Speak_VoiceSelector, options?: SpeexSpeakOptions, callbacks?: _Speak_Callbacks): Promise<SpeexSpeakResult> {

  const streaming = options?.streaming ?? true;
  const languageCode = options?.languageCode ?? _getUIPreferenceLanguageCode();
  const priority = options?.priority;
  const playback = options?.playback ?? true;
  const returnAudio = options?.returnAudio ?? !streaming;

  // resolve engine from voice selector
  const engine = _engineFromSelector(voiceSelector);
  if (!engine)
    return { success: false, errorType: 'tts-no-engine', error: 'No TTS engine configured. Please configure a TTS engine in Settings.' };

  // apply voice override from selector (merge with engine defaults)
  const effectiveEngine = _engineApplyVoiceOverride(engine, voiceSelector);

  try {
    switch (effectiveEngine.vendorType) {
      // RPC providers: route through speex.router RPC
      case 'elevenlabs':
      case 'openai':
      case 'localai':
        return speexSynthesize_RPC(effectiveEngine, inputText, { streaming, playback, returnAudio, languageCode, priority }, callbacks);

      // Web Speech: client-only, no RPC
      case 'webspeech':
        return speexSynthesize_WebSpeech(inputText, effectiveEngine.voice as DVoiceWebSpeech, callbacks);
    }
  } catch (error) {
    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
    return { success: false, errorType: 'tts-exception', error: error instanceof Error ? error.message : String(error) };
  }
}


// private helpers

function _engineFromSelector(selector: _Speak_VoiceSelector): DSpeexEngineAny | null {
  if (selector) {
    // A. most specific selector: engineId
    if ('engineId' in selector && selector.engineId) {
      const engine = speexFindEngineById(selector.engineId);
      if (engine) return engine;
    }

    // B. voice.dialect - find first matching engine that's probably valid
    if ('voice' in selector && selector.voice?.dialect) {
      const engine = speexFindValidEngineByType(selector.voice.dialect);
      if (engine) return engine;
    }
  }

  // C. fall back to global engine (active or priority-ranked)
  return speexFindGlobalEngine();
}

function _engineApplyVoiceOverride(engine: DSpeexEngineAny, selector: _Speak_VoiceSelector): DSpeexEngineAny {
  return (!selector || !('voice' in selector) || !selector.voice) ? engine : {
    ...engine,
    voice: { ...engine.voice, ...selector.voice },
  } as DSpeexEngineAny;
}

// extract base language code (e.g., 'en-US' -> 'en', 'fr' -> 'fr')
function _getUIPreferenceLanguageCode(): string | undefined {
  const { preferredLanguage } = useUIPreferencesStore.getState();
  return preferredLanguage?.split('-')[0]?.toLowerCase() || undefined;
}
