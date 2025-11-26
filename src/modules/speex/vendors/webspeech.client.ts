/**
 * Web Speech API Client - Browser-native TTS
 *
 * Client-only speech synthesis using the browser's SpeechSynthesis API.
 * No server RPC required.
 */

import * as React from 'react';

import type { DVoiceWebSpeech } from '../speex.types';
import type { SpeexSpeakResult, SpeexVoiceInfo } from '../speex.client';


// browser support

export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}


// Voice Listing

/**
 * Synchronously returns the cached list of voices.
 * Note: On first load, browser may return empty array until voices are loaded.
 * @deprecated use `useWebSpeechVoices()` hook for reactive voice loading, as voices are mostly configured by the UI.
 */
export function speexListVoicesWebSpeech(): SpeechSynthesisVoice[] {
  if (!isWebSpeechSupported()) return [];
  return speechSynthesis.getVoices();
}


/**
 * React hook for voice listing with async loading support.
 * Handles the browser's async voice loading on first access.
 * Returns normalized SpeexVoiceInfo[] for consistency with cloud providers.
 */
export function useSpeexWebSpeechVoices(): {
  voices: SpeexVoiceInfo[];
  isLoading: boolean;
} {
  const [voices, setVoices] = React.useState<SpeexVoiceInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isWebSpeechSupported()) {
      setIsLoading(false);
      return;
    }

    const normalizeVoices = (browserVoices: SpeechSynthesisVoice[]): SpeexVoiceInfo[] =>
      browserVoices.map(v => ({
        id: v.voiceURI,
        name: v.name,
        description: `${v.lang}${v.localService ? ' (local)' : ''}`,
      }));

    // Try to get voices immediately (may be cached)
    const initialVoices = speechSynthesis.getVoices();
    if (initialVoices.length > 0) {
      setVoices(normalizeVoices(initialVoices));
      setIsLoading(false);
      return;
    }

    // Listen for voiceschanged event (fired when voices are loaded)
    const handleVoicesChanged = () => {
      setVoices(normalizeVoices(speechSynthesis.getVoices()));
      setIsLoading(false);
    };

    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    // Some browsers fire voiceschanged immediately, some don't
    // Set a timeout to handle browsers that don't fire the event
    const timeoutId = setTimeout(() => {
      const timeoutVoices = speechSynthesis.getVoices();
      if (timeoutVoices.length > 0)
        setVoices(normalizeVoices(timeoutVoices));
      setIsLoading(false);
    }, 1000);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      clearTimeout(timeoutId);
    };
  }, []);

  return { voices, isLoading };
}


// Speech Synthesis

/**
 * Speak text using the Web Speech API.
 * This is a client-only function - no server RPC.
 */
export function speexSynthesizeWebSpeech(
  text: string,
  voice: DVoiceWebSpeech,
  callbacks?: {
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<SpeexSpeakResult> {
  return new Promise((resolve) => {
    if (!isWebSpeechSupported()) {
      const error = new Error('Web Speech API not supported');
      callbacks?.onError?.(error);
      resolve({ success: false, error: error.message });
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Find and set voice by URI
    if (voice.ttsVoiceURI) {
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voice.ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // Set rate and pitch
    if (voice.rate !== undefined) utterance.rate = voice.rate;
    if (voice.pitch !== undefined) utterance.pitch = voice.pitch;

    // Set up event handlers
    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      callbacks?.onComplete?.();
      resolve({ success: true });
    };

    utterance.onerror = (event) => {
      const errorMessage = event.error || 'Speech synthesis failed';
      const error = new Error(errorMessage);
      callbacks?.onError?.(error);
      resolve({ success: false, error: errorMessage });
    };

    // Speak
    speechSynthesis.speak(utterance);
  });
}


// Helpers

/**
 * Stop any ongoing speech synthesis.
 */
export function stopWebSpeech(): void {
  if (isWebSpeechSupported()) {
    speechSynthesis.cancel();
  }
}

/**
 * Pause ongoing speech synthesis.
 */
export function pauseWebSpeech(): void {
  if (isWebSpeechSupported()) {
    speechSynthesis.pause();
  }
}

/**
 * Resume paused speech synthesis.
 */
export function resumeWebSpeech(): void {
  if (isWebSpeechSupported()) {
    speechSynthesis.resume();
  }
}

/**
 * Check if speech synthesis is currently speaking.
 */
export function isWebSpeechSpeaking(): boolean {
  return isWebSpeechSupported() && speechSynthesis.speaking;
}
