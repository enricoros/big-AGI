//
// TTS Core Types
//

export type TTSServiceId = string;

export type TTSVendorId = 'elevenlabs' | 'openai';

/**
 * Audio formats supported by TTS services
 */
export type TTSAudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

/**
 * Voice representation (unified across all vendors)
 */
export interface TTSVoice {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  language?: string;
  category?: string;
}

/**
 * Options for TTS generation (superset of all vendor capabilities)
 */
export interface TTSGenerationOptions {
  // Core parameters (all vendors)
  text: string;
  voiceId?: string;

  // Common optional parameters
  speed?: number;              // 0.25-4.0 (OpenAI TTS)
  format?: TTSAudioFormat;     // Output audio format
  streaming?: boolean;         // Enable streaming

  // Advanced parameters (vendor-specific, optional)
  turbo?: boolean;             // ElevenLabs: use turbo model
  nonEnglish?: boolean;        // ElevenLabs: use multilingual model
}

/**
 * Result of TTS generation
 */
export interface TTSSpeakResult {
  success: boolean;
  audioBase64?: string;        // Available when not streaming
  error?: string;
}

/**
 * TTS Service - configured instance of a TTS vendor
 */
export interface DTTSService<TServiceSettings extends object = {}> {
  id: TTSServiceId;
  label: string;

  // service -> vendor of that service
  vId: TTSVendorId;

  // service-specific settings
  setup: Partial<TServiceSettings>;
}
