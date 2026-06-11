import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelsService } from '~/common/stores/llms/llms.service.types';

import type { DASRxCredentials, DASRxProfile, DASRxVendorType } from './asrx.types';


export type ASRxProtocol =
  | 'batch'      // record / upload audio -> transcript (REST-like, single response)
  | 'realtime';  // WebSocket: stream audio -> stream partial + final transcripts


/**
 * Descriptions for each ASRx Transcription Vendor.
 * - used for DASRxEngine instances creation, mainly
 *
 * Configuration including credentials and default profile are in DASRxEngine instances
 * in the asrx store.
 *
 * NOTE: Browser Web Speech API is intentionally NOT modeled as an ASRx vendor:
 * it owns the microphone itself (sealed capture+transcription), so it doesn't
 * fit the "feed me audio, I return text" contract every ASRx vendor obeys.
 * It remains at src/common/components/speechrecognition/ for inline dictation.
 */
export interface IASRxVendor<TVt extends DASRxVendorType> {
  readonly vendorType: TVt;
  readonly name: string;
  readonly protocols: ReadonlySet<ASRxProtocol>;
  readonly priority: number;  // display priority (lower = higher): deepgram=10, openai=20

  // auto-detection info: if a configured LLM service matches one of these vendor ids,
  // an auto-linked ASRx engine is created using that service's credentials
  readonly autoFromLlmVendorIds?: ModelVendorId[];

  // optional secondary qualifier: after vendor-id match, return false to skip
  // auto-linking for this specific service. Used e.g. by OpenAI to avoid
  // auto-linking proxies (custom oaiHost) that may not implement /v1/audio/transcriptions.
  readonly shouldAutoLinkFromLLMSource?: (source: DModelsService) => boolean;

  // capabilities (informational - for UI rendering and feature gating)
  readonly capabilities: {
    languageDetection: boolean; // vendor reports the detected language
    diarization: boolean;       // speaker identification / labeling
    interimResults: boolean;    // realtime only: partial transcripts during streaming
    wordTimestamps: boolean;    // per-word start/end times
  };

  // defaults for creating new engines

  getDefaultCredentials(): DASRxCredentials<TVt>;

  getDefaultProfile(): DASRxProfile<TVt>;
}

export type IASRxVendorAny = { [TVt in DASRxVendorType]: IASRxVendor<TVt> }[DASRxVendorType];
