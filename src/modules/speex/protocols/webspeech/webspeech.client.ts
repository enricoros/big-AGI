/**
 * Web Speech API Client - Browser-native TTS
 *
 * Client-only speech synthesis using the browser's SpeechSynthesis API.
 * No server RPC required.
 */

import * as React from 'react';

import type { DVoiceWebSpeech, SpeexListVoiceOption, SpeexListVoicesResult, SpeexSpeakResult } from '../../speex.types';

import { SPEEX_DEBUG } from '~/modules/speex/speex.config';


function _webspeechVoicesToVoiceOptions(browserVoices: ReadonlyArray<SpeechSynthesisVoice>): SpeexListVoiceOption[] {
  return browserVoices.map(v => ({
    id: v.voiceURI,
    name: v.name,
    description: `${v.lang}${v.localService ? ' (local)' : ''}`,
  }));
}


// browser support

export function webspeechIsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}


// Smart voice selection for auto-detected WebSpeech engine

/** Preferred voices by name, in priority order */
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Microsoft Zira - English (United States)',
  'Microsoft David - English (United States)',
] as const;

/**
 * Selects the best voice from available voices.
 * Priority: preferred voices → browser language → English → first available
 */
function _selectBestVoice(voices: SpeechSynthesisVoice[]): string | undefined {
  if (!voices.length) return undefined;

  // 1. Preferred voices
  for (const name of PREFERRED_VOICE_NAMES) {
    const match = voices.find(v => v.name === name);
    if (match) return match.voiceURI;
  }

  // 2. Match browser language
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
  const langVoice = voices.find(v => v.lang.toLowerCase().startsWith(lang));
  if (langVoice) return langVoice.voiceURI;

  // 3. Any English voice
  const enVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
  if (enVoice) return enVoice.voiceURI;

  return undefined;
}

/**
 * Sets the best voice, retrying once after voices load if needed.
 * Safe to call at hydration - will update the engine when voices become available.
 */
export function webspeechHBestVoiceDeferred(setter: (voiceURI: string) => void): void {
  if (!webspeechIsSupported()) return;

  // try immediate
  const voices = speechSynthesis.getVoices();
  const b1 = _selectBestVoice(voices);
  if (b1) return setter(b1);

  // retry after voices load (one-shot)
  let timeoutId: ReturnType<typeof setTimeout>;
  const onVoicesChanged = () => {
    clearTimeout(timeoutId);
    speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    const v = speechSynthesis.getVoices();
    const b2 = _selectBestVoice(v);
    if (b2) setter(b2);
  };
  speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

  // fallback timeout in case voiceschanged never fires
  timeoutId = setTimeout(() => {
    speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    const v = speechSynthesis.getVoices();
    const b3 = _selectBestVoice(v);
    if (b3) setter(b3);
  }, 2000);
}


// List Voices - immediate

// NOTE: we deprecated the code below and keep it around just as a warning or reference.
//       To make this correct we shall have a function to be awaited until all voices are loaded.
// TODO: this could be done in the future to fetch voices after first creating the System Voice engine, to auto-select the best voice.
// /**
//  * Synchronously returns the cached list of voices.
//  * Note: On first load, browser may return empty array until voices are loaded.
//  * @deprecated use `useWebSpeechVoices()` hook for reactive voice loading, as voices are mostly configured by the UI.
//  */
// export function speexListVoicesWebSpeech(): SpeechSynthesisVoice[] {
//   return !webspeechIsSupported() ? [] : _webspeechVoicesToVoiceOptions(speechSynthesis.getVoices());
// }


// List Voices - hook

/**
 * React hook for voice listing with async loading support.
 * Handles the browser's async voice loading on first access.
 * Returns normalized SpeexListVoiceOption[] for consistency with cloud providers.
 */
export function useSpeexWebSpeechVoices(enabled: boolean): SpeexListVoicesResult {

  // state
  const [isLoading, setIsLoading] = React.useState(true);
  const [voices, setVoices] = React.useState<SpeexListVoiceOption[]>([]);

  React.useEffect(() => {
    // do nothing if not enabled
    if (!enabled) {
      setIsLoading(false);
      setVoices([]);
      return;
    }

    // not supported - stop
    if (!webspeechIsSupported()) return setIsLoading(false);

    // try to get voices immediately (may be cached)
    const initialVoices = speechSynthesis.getVoices();
    if (initialVoices.length > 0) {
      setVoices(_webspeechVoicesToVoiceOptions(initialVoices));
      return setIsLoading(false);
    }

    // notify of loaded voices
    const handleVoicesChanged = () => {
      setVoices(_webspeechVoicesToVoiceOptions(speechSynthesis.getVoices()));
      setIsLoading(false);
    };

    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    // some browsers fire voiceschanged immediately, some don't - set a timeout to handle browsers that don't fire the event
    const timeoutId = setTimeout(() => {
      const timeoutVoices = speechSynthesis.getVoices();
      if (timeoutVoices.length > 0)
        setVoices(_webspeechVoicesToVoiceOptions(timeoutVoices));
      setIsLoading(false);
    }, 1000);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      clearTimeout(timeoutId);
    };
  }, [enabled]);

  return { voices, isLoading, error: null };
}


// Speech Synthesis

/**
 * Speak text using the Web Speech API.
 * This is a client-only function - no server RPC.
 */
export function speexSynthesize_WebSpeech(
  text: string,
  voice: DVoiceWebSpeech,
  callbacks?: {
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {
  return new Promise((resolve) => {
    if (!webspeechIsSupported()) {
      const error = new Error('Web Speech API not supported');
      callbacks?.onError?.(error);
      resolve({ success: false, errorType: 'tts-no-engine', error: error.message });
      return;
    }

    // cancel any ongoing speech
    speechSynthesis.cancel(); // safe

    // create utterance
    if (SPEEX_DEBUG) console.log(`[Speex][WebSpeech] New utterance (${text.length} chars, voice: ${voice.ttsVoiceURI}, s=${voice.ttsSpeed}, p=${voice.ttsPitch})`);
    const utterance = new SpeechSynthesisUtterance(text);

    // find and set voice by URI
    if (voice.ttsVoiceURI) {
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voice.ttsVoiceURI);
      if (selectedVoice)
        utterance.voice = selectedVoice;
    }

    // set speed and pitch
    if (voice.ttsSpeed !== undefined) utterance.rate = voice.ttsSpeed;
    if (voice.ttsPitch !== undefined) utterance.pitch = voice.ttsPitch;

    // set up event handlers
    utterance.onstart = () => {
      if (SPEEX_DEBUG) console.log(`[Speex][WebSpeech] Utterance started`);
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      if (SPEEX_DEBUG) console.log(`[Speex][WebSpeech] Utterance completed`);
      callbacks?.onComplete?.();
      resolve({ success: true });
    };

    utterance.onerror = (event) => {
      if (SPEEX_DEBUG) console.error(`[Speex][WebSpeech] Utterance error`, event.error);
      const errorMessage = event.error || 'Speech synthesis failed';
      const error = new Error(errorMessage);
      callbacks?.onError?.(error);
      resolve({ success: false, errorType: 'tts-error', error: errorMessage });
    };

    // start speaking
    speechSynthesis.speak(utterance);
  });
}


// Helpers (not used for now, keep them around)

// export function webspeechStop(): void {
//   if (webspeechIsSupported())
//     speechSynthesis.cancel();
// }
//
// export function webspeechPause(): void {
//   if (webspeechIsSupported())
//     speechSynthesis.pause();
// }
//
// export function webspeechResume(): void {
//   if (webspeechIsSupported())
//     speechSynthesis.resume();
// }
//
// export function isWebSpeechSpeaking(): boolean {
//   return webspeechIsSupported() && speechSynthesis.speaking;
// }
