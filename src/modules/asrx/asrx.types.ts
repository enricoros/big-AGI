import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


// --- Data Types for persisted Engine setups ---

// ASRx Vendor Types (supported ASR / transcription providers)

export type DASRxVendorType = 'deepgram' | 'gemini' | 'openai';


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
  'gemini': { profile: DProfileGemini; credentials: DCredentialsLLMSService | DCredentialsApiKey };
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
  smartFormat?: boolean;   // numbers, dates, currency, punctuation AND paragraph breaks
  diarize?: boolean;       // speaker identification
  utterances?: boolean;    // utterance-level segmentation
  keyterms?: string[];     // user dictionary: names/jargon boosting - wire param is model-split (keyterm vs keywords, see adapter)
  topics?: boolean;        // topic detection (Deepgram audio intelligence)
  sentiment?: boolean;     // sentiment analysis (Deepgram audio intelligence)
}

export interface DProfileGemini {
  dialect: 'gemini';
  asrModel?: 'gemini-3.5-transcribe' | (string & {});
  mode?: 'smart' | 'verbatim'; // smart: vendor-formatted punctuation + paragraphs (attested formatting); verbatim: literal
  language?: string;       // BCP-47, comma-separated list allowed -> language_codes[] (undefined = auto-detect, 85+ languages; detection is not reported back)
  keywords?: string[];     // user dictionary -> custom_vocabulary wire param (vendor cap 1000 terms; API-incompatible with diarization/timestamps, which v1 doesn't expose)
}

export interface DProfileOpenAI {
  dialect: 'openai';
  asrModel?: 'gpt-transcribe' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1';
  language?: string;       // ISO-639-1, comma-separated list allowed - gpt-transcribe accepts several expected languages, older models use the first (undefined = auto-detect)
  prompt?: string;         // free-form context/style guidance (rejected by the diarize model)
  keywords?: string[];     // user dictionary: literal terms expected in the audio - gpt-transcribe wire param; folded into whisper-1's prompt; unused by gpt-4o models and diarize (see adapter)
  temperature?: number;    // 0..1 (whisper-1 only; the gpt transcribe models ignore it)
  diarize?: boolean;       // speaker labels - swaps the request onto the gpt-4o-transcribe-diarize model
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
  // topic detection: undefined honors the engine profile's policy; true/false overrides it (applied only where the vendor supports it - Deepgram)
  topicsHint?: boolean;
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
      topics?: ASRxDetectedTopic[]; // vendor-detected topics (deduped, only when non-empty)
      sentiment?: ASRxDetectedSentiment; // vendor-average sentiment, when analysis ran
    }
  | {
      success: false;
      errorType: ASRxErrorType;
      errorText: string;
    };

/** A detected topic, with the transcript span that triggered the detection as evidence. */
export interface ASRxDetectedTopic {
  label: string;
  quote?: string;         // truncated transcript span the vendor attributed the topic to
  score?: number;         // vendor confidence 0..1 (best across segments)
  wordBegin?: number;     // 0-based word index of the quote's span start (Deepgram start_word, verified 0-based), same segment as `quote`
  wordEnd?: number;       // 0-based word index of the quote's span end, inclusive (Deepgram end_word)
}

/** Average sentiment of the whole audio, as reported by the vendor's analysis pass. */
export interface ASRxDetectedSentiment {
  label: 'positive' | 'neutral' | 'negative' | (string & {}); // hinted known values, open set
  score?: number;         // vendor-reported average (Deepgram: -1..1)
}

export type ASRxErrorType =
  | 'asr-no-engine'       // no engine selected and none available
  | 'asr-unconfigured'    // engine exists but credentials are missing/invalid
  | 'asr-error'           // vendor returned an error status
  | 'asr-exception'       // unexpected exception (network, parsing, ...)
  | 'asr-aborted';        // caller aborted the operation
