import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';

import type { SpeexWire_VoiceOption } from './protocols/rpc/rpc.wiretypes';


// --- Data Types for persisted Engine setups ---

// Speex Vendor Types (supported TTS providers)

export type DSpeexVendorType = 'elevenlabs' | 'localai' | 'openai' | 'webspeech';


// Speex Engines - instances of TTS Vendors Types - persisted in store-module-speex

export type DSpeexEngineAny = { [TVt in DSpeexVendorType]: DSpeexEngine<TVt> }[DSpeexVendorType];

export interface DSpeexEngine<TVt extends DSpeexVendorType> {
  engineId: SpeexEngineId;
  vendorType: TVt;
  label: string;
  isAutoDetected: boolean;
  isAutoLinked: boolean;
  isDeleted: boolean;
  credentials: DSpeexCredentials<TVt>;
  voice: DSpeexVoice<TVt>;
  // timestamps for sorting and ZYNC sync
  createdAt: number;
  updatedAt: number;
}

export type SpeexEngineId = string; // agiUuidV4('speex.engine.instance')

// helper for mapping credentials and voice types to the engine type
interface _TypeMap extends Record<DSpeexVendorType, { voice: unknown; credentials: unknown }> {
  'elevenlabs': { voice: DVoiceElevenLabs; credentials: DCredentialsApiKey };
  'localai': { voice: DVoiceLocalAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
  'openai': { voice: DVoiceOpenAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
  'webspeech': { voice: DVoiceWebSpeech; credentials: DCredentialsNone };
}


// Voices - a unique, engine-type-specific configuration that produces a repeatable voice output

export type DSpeexVoiceAny = { [TVt in DSpeexVendorType]: DSpeexVoice<TVt> }[DSpeexVendorType];

export type DSpeexVoice<TVt extends DSpeexVendorType> = _TypeMap[TVt]['voice'];

export interface DVoiceElevenLabs {
  dialect: 'elevenlabs';
  ttsModel?: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_turbo_v2_5';
  ttsVoiceId?: string;
  // ttsStability?: number;
  // ttsSimilarityBoost?: number;
  // ttsStyle?: number;
  // ttsS?: boolean;
}

// type LocalAITTSBackend = | 'coqui' | 'bark' | 'piper' | 'transformers-musicgen' | 'vall-e-x'
export interface DVoiceLocalAI {
  dialect: 'localai';
  // we let the user insert strings (or nothing) for the 2 fields below
  ttsBackend?: string;   // Backend (e.g., 'coqui', 'bark', 'piper', 'transformers-musicgen', 'vall-e-x')
  ttsModel?: string;     // Model name (e.g., 'kokoro', 'tts_models/en/ljspeech/glow-tts', 'v2/en_speaker_4' for bark)
  ttsLanguage?: string;  // Language code for multilingual models (e.g., 'en', 'fr' for xtts_v2)
}

export interface DVoiceOpenAI {
  dialect: 'openai';
  ttsModel: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  ttsVoiceId?: 'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer' | string;
  ttsSpeed?: number;       // 0.25-4.0
  ttsInstruction?: string; // voice instructions (gpt-4o-mini-tts only?)
}

export interface DVoiceWebSpeech {
  dialect: 'webspeech';
  ttsVoiceURI?: string;
  ttsSpeed?: number;  // 0.5-2.0
  ttsPitch?: number;  // 0.5-2.0
}


// Credentials

export type DSpeexCredentialsAny = { [TVt in DSpeexVendorType]: DSpeexCredentials<TVt> }[DSpeexVendorType];

export type DSpeexCredentials<TVt extends DSpeexVendorType> = _TypeMap[TVt]['credentials'];

export interface DCredentialsApiKey {
  type: 'api-key';
  apiKey: string;
  apiHost?: string; // is missing, assumed to be the default host for the cloud provider
  // apiOrgId?: string;  // for OpenAI organization ID, if applicable - but won't have it here for manual api key entries
}

export interface DCredentialsLLMSService {
  type: 'llms-service';
  serviceId: DModelsServiceId;
}

export interface DCredentialsNone {
  type: 'none';
}


// --- Function and Callback Types ---

// List Voices

export type SpeexListVoiceOption = SpeexWire_VoiceOption;

export type SpeexListVoicesResult = {
  voices: SpeexListVoiceOption[];
  isLoading: boolean;
  error: string | null;
  refetch?: () => void;
}


// Speak

export type SpeexVoiceSelector =
  | undefined
  | { voice: Partial<DSpeexVoiceAny> } // uses first matching engine for voice.dialect, with voice override
  | { engineId: SpeexEngineId; voice?: Partial<DSpeexVoiceAny> }; // uses specific engine, optionally overriding voice

export type SpeexSpeakOptions = {
  label?: string;           // For NorthBridge queue display
  personaUid?: string;      // For NorthBridge queue icon / controls (if the audio came from a persona)
  // core options
  streaming?: boolean;      // Streaming defaults to True
  languageCode?: string;    // ISO language code (e.g., 'en', 'fr') - auto-detected from preferredLanguage if not provided
  priority?: 'fast' | 'balanced' | 'quality'; // Hint for speed vs quality tradeoff: 'fast' = low latency (turbo models), 'quality' = highest quality
  playback?: boolean;       // Play audio (default: true)
  returnAudio?: boolean;    // Accumulate full audio buffer in result, even if streaming (for save/download)
}

export type SpeexSpeakResult = {
  success: true;
  audioBase64?: string; // available when not streaming or when requested
} | {
  success: false;
  errorType: 'tts-no-engine' | 'tts-unconfigured' | 'tts-error' | 'tts-exception';
  error: string; // if success is false
}
