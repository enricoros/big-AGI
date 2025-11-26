import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


// Speex Vendor Types (supported TTS providers)

export type SpeexVendorType = 'elevenlabs' | 'localai' | 'openai' | 'webspeech';


// Speex Engines - instances of TTS Vendors Types - persisted in store-module-speex

export type DSpeexEngineAny = { [TVt in SpeexVendorType]: DSpeexEngine<TVt> }[SpeexVendorType];

export interface DSpeexEngine<TVt extends SpeexVendorType> {
  engineId: SpeexEngineId;
  vendorType: TVt;
  label: string;
  isAutoDetected: boolean;
  isAutoLinked: boolean;
  isDeleted: boolean;
  credentials: DSpeexCredentials<TVt>;
  voice: DSpeexVoice<TVt>;
}

export type SpeexEngineId = string; // agiUuidV4('speex.engine.instance')

export type SpeexRPCDialect = Exclude<SpeexVendorType, 'webspeech'>;  // wire dialect for tRPC routing (server-side engines only)

// helper for mapping credentials and voice types to the engine type
interface _TypeMap extends Record<SpeexVendorType, { voice: unknown; credentials: unknown }> {
  'elevenlabs': { voice: DVoiceElevenLabs; credentials: DCredentialsApiKey };
  'localai': { voice: DVoiceLocalAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
  'openai': { voice: DVoiceOpenAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
  'webspeech': { voice: DVoiceWebSpeech; credentials: DCredentialsNone };
}


// Voices - a unique, engine-type-specific configuration that produces a repeatable voice output

export type DSpeexVoice<TVt extends SpeexVendorType = SpeexVendorType> = _TypeMap[TVt]['voice'];

export interface DVoiceElevenLabs {
  vendorType: 'elevenlabs';
  ttsModel?: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_turbo_v2_5';
  voiceId?: string;
  // stability?: number;
  // similarityBoost?: number;
  // style?: number;
  // speakerBoost?: boolean;
}

// type LocalAITTSBackend = | 'coqui' | 'bark' | 'piper' | 'transformers-musicgen' | 'vall-e-x'
export interface DVoiceLocalAI {
  vendorType: 'localai';
  // we let the user insert strings (or nothing) for the 2 fields below
  ttsModel?: string;    // Model name (e.g., 'kokoro', 'tts_models/en/ljspeech/glow-tts', 'v2/en_speaker_4' for bark)
  ttsBackend?: string;  // Backend (e.g., 'coqui', 'bark', 'piper', 'transformers-musicgen', 'vall-e-x')
  language?: string;    // Language code for multilingual models (e.g., 'en', 'fr' for xtts_v2)
}

export interface DVoiceOpenAI {
  vendorType: 'openai';
  ttsModel: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  voiceId?: 'alloy' | 'ash' | 'coral' | 'echo' | 'marin' | 'sage' | 'shimmer' | 'fable' | 'onyx' | 'nova' | string;
  // voiceId?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string;
  speed?: number; // 0.25-4.0
  instruction?: string;
}

export interface DVoiceWebSpeech {
  vendorType: 'webspeech';
  ttsVoiceURI?: string;
  rate?: number;
  pitch?: number;
}


// Credentials

export type DSpeexCredentials<TVt extends SpeexVendorType = SpeexVendorType> = _TypeMap[TVt]['credentials'];

export interface DCredentialsApiKey {
  type: 'api-key';
  apiKey: string;
  apiHost?: string; // is missing, assumed to be the default host for the cloud provider
}

export interface DCredentialsLLMSService {
  type: 'llms-service';
  serviceId: DModelsServiceId;
}

export interface DCredentialsNone {
  type: 'none';
}
