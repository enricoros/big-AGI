import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


// Speex Engine

export interface DSpeexEngine<T extends SpeexEngineType = SpeexEngineType> {
  engineId: SpeexEngineId;
  engineType: T;
  label: string;
  isAutoDetected: boolean;
  isAutoLinked: boolean;
  isDeleted: boolean;
  credentials: _TypeMap[T]['credentials'];
  voice: _TypeMap[T]['voice'];
}

export type DSpeexEngine_Any = { [T in SpeexEngineType]: DSpeexEngine<T> }[SpeexEngineType];

export type SpeexEngineId = string; // agiUuidV4('speex.engine.instance')

export type SpeexEngineType = 'elevenlabs' | 'openai' | 'web-speech';

interface _TypeMap extends Record<SpeexEngineType, { voice: unknown; credentials: unknown }> {
  'elevenlabs': { voice: DVoiceElevenLabs; credentials: DCredentialsApiKey };
  'openai': { voice: DVoiceOpenAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
  'web-speech': { voice: DVoiceWebSpeech; credentials: DCredentialsBrowser };
}


// Voices

export type DSpeexVoice = _TypeMap[SpeexEngineType]['voice'];

interface DVoiceElevenLabs {
  engineType: 'elevenlabs';
  model?: string;
  voiceId?: string;
  // stability?: number;
  // similarityBoost?: number;
  // style?: number;
  // speakerBoost?: boolean;
}

interface DVoiceOpenAI {
  engineType: 'openai';
  model?: 'tts-1' | 'tts-1-hd';
  voiceId?: 'alloy' | 'ash' | 'coral' | 'echo' | 'marin' | 'sage' | 'shimmer' | 'fable' | 'onyx' | 'nova' | string;
  // voiceId?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string;
  speed?: number; // 0.25-4.0
  instruction?: string;
}

interface DVoiceWebSpeech {
  engineType: 'web-speech';
  voiceURI?: string;
  rate?: number;
  pitch?: number;
}


// Credentials

export type SpeexCredentials = _TypeMap[SpeexEngineType]['credentials'];

interface DCredentialsApiKey {
  type: 'api-key';
  apiKey: string;
  apiHost?: string;
}

interface DCredentialsBrowser {
  type: 'browser';
}

interface DCredentialsLLMSService {
  type: 'llms-service';
  serviceId: DModelsServiceId;
}
