/*
 * This file contains code to detect features on the client and server side,
 * and exposes hooks to list the availabilities of those features.
 *
 * Client features include:
 *  - speech recognition: availability and correctness of configuration
 *
 * Server features include:
 *  - tba
 */


/// Speech Recognition (browser)

export interface CapabilityBrowserSpeechRecognition {
  mayWork: boolean; // Is the SpeechRecognition API available in the user's browser and device
  isApiAvailable: boolean; // Is the SpeechRecognition API available in the user's browser
  isDeviceNotSupported: boolean; // Is the user's device not supported (e.g., iPhone)
}

export { browserSpeechRecognitionCapability as useCapabilityBrowserSpeechRecognition } from './useSpeechRecognition';


/// Speech Synthesis (ElevenLabs)

export interface CapabilityElevenLabsSpeechSynthesis {
  mayWork: boolean;
  isConfiguredServerSide: boolean;
  isConfiguredClientSide: boolean;
}

export { useCapability as useCapabilityElevenLabs } from '~/modules/elevenlabs/elevenlabs.client';
