import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


// --- Data Types for persisted Engine setups ---

// ASRx Vendor Types (supported ASR / transcription providers)

export type DASRxVendorType = 'deepgram' | 'openai';


// ASRx Engines - instances of ASRx Vendor Types - persisted in store-module-asrx

export type DASRxEngineAny = { [TVt in DASRxVendorType]: DASRxEngine<TVt> }[DASRxVendorType];

export interface DASRxEngine<TVt extends DASRxVendorType> {
  engineId: DASRxEngineId;
  vendorType: TVt;
  label: string;
  isAutoDetected: boolean;
  isAutoLinked: boolean;
  isDeleted: boolean;
  credentials: DASRxCredentials<TVt>;
  profile: DASRxProfile<TVt>;
  // timestamps for sorting and ZYNC sync
  createdAt: number;
  updatedAt: number;
}

export type DASRxEngineId = string; // agiUuidV4('asrx.engine.instance')

// helper for mapping credentials and profile types to the engine type
interface _TypeMap extends Record<DASRxVendorType, { profile: unknown; credentials: unknown }> {
  'deepgram': { profile: DProfileDeepgram; credentials: DCredentialsApiKey };
  'openai': { profile: DProfileOpenAI; credentials: DCredentialsLLMSService | DCredentialsApiKey };
}


// Profiles - a vendor-specific configuration of model + language + processing features,
// analogous to DSpeexVoice* for TTS. Discriminated union on `dialect`.

export type DASRxProfileAny = { [TVt in DASRxVendorType]: DASRxProfile<TVt> }[DASRxVendorType];

export type DASRxProfile<TVt extends DASRxVendorType> = _TypeMap[TVt]['profile'];

export interface DProfileDeepgram {
  dialect: 'deepgram';
  asrModel?: 'nova-3' | 'nova-2' | string;
  language?: string;       // BCP-47 or 'multi' for multilingual auto-detect
  smartFormat?: boolean;   // numbers, dates, currency, AND punctuation
  diarize?: boolean;       // speaker identification
  utterances?: boolean;    // utterance-level segmentation
  keywords?: string[];     // keyword boosting
}

export interface DProfileOpenAI {
  dialect: 'openai';
  asrModel?: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1';
  language?: string;       // ISO-639-1 (undefined = auto-detect)
  prompt?: string;         // vocabulary/style guidance (especially for whisper-1)
  temperature?: number;    // 0..1 (whisper-1 only; gpt-4o-transcribe ignores)
}


// Credentials

export type DASRxCredentialsAny = { [TVt in DASRxVendorType]: DASRxCredentials<TVt> }[DASRxVendorType];

export type DASRxCredentials<TVt extends DASRxVendorType> = _TypeMap[TVt]['credentials'];

export interface DCredentialsApiKey {
  type: 'api-key';
  apiKey: string;
  apiHost?: string;
}

export interface DCredentialsLLMSService {
  type: 'llms-service';
  serviceId: DModelsServiceId;
}


// --- Function and Callback Types ---

// Profile Selector: how to pick which engine / profile to use for a transcription call

export type ASRxProfileSelector =
  | undefined                                              // use global engine
  | { profile: Partial<DASRxProfileAny> }                  // match by profile.dialect, with profile override
  | { engineId: DASRxEngineId; profile?: Partial<DASRxProfileAny> }; // specific engine, optionally overriding profile


// Batch transcription (upload audio -> transcript)

export interface ASRxTranscribeBatchOptions {
  // language override (wins over engine profile's language, when set)
  languageCode?: string;
  // abort the transcription mid-flight
  signal?: AbortSignal;
  // NorthBridge-style operation metadata (for future use in an ops panel)
  label?: string;
  personaUid?: string; // DPersonaUid;
  conversationId?: DConversationId;
}

export type ASRxBatchResult =
  | {
      success: true;
      text: string;
      model: string;          // `${vendorType}/${asrModel}` - suitable for VoiceTranscript.model
      language?: string;      // detected or confirmed language (when provided by the vendor)
      confidence?: number;    // 0..1, when provided
      durationMs?: number;    // client-measured round-trip (or vendor-reported when available)
    }
  | {
      success: false;
      errorType: ASRxErrorType;
      errorText: string;
    };

export type ASRxErrorType =
  | 'asr-no-engine'       // no engine selected and none available
  | 'asr-unconfigured'    // engine exists but credentials are missing/invalid
  | 'asr-error'           // vendor returned an error status
  | 'asr-exception'       // unexpected exception (network, parsing, ...)
  | 'asr-aborted';        // caller aborted the operation
