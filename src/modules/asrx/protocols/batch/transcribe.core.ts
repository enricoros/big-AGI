/**
 * ASRx Batch Transcription Core - vendor dispatcher.
 *
 * One entry point, `asrxBatchCoreTranscribe`, that validates dialect
 * consistency and routes to the appropriate vendor adapter. Used by
 * `asrxTranscribeBatch` via a dynamic import so this module (and its
 * vendor adapters) stay out of the main bundle until needed.
 */

import type { ASRxAccess } from './batch.access';
import type { DASRxProfileAny } from '../../asrx.types';
import { transcribeDeepgram } from './transcribe-deepgram';
import { transcribeOpenAI } from './transcribe-openai';


// Result shape returned by every vendor adapter (internal to the batch protocol).
// The public `ASRxBatchResult` in asrx.types.ts wraps this with success/failure discrimination.
export interface ASRxCoreTranscribeResult {
  text: string;
  model: string;            // `${vendorType}/${asrModel}` for display / RambleTranscript.model
  language?: string;        // detected or confirmed language, when provided by the vendor
  confidence?: number;      // 0..1, when provided
  durationMs?: number;      // client-measured round-trip (or vendor-reported)
}


// Backend function spec - parameterized on the access dialect

export interface TranscribeBackendFnParams<TAccess extends ASRxAccess> {
  access: TAccess;
  profile: DASRxProfileAny;
  audio: Uint8Array;
  mimeType: string;
  languageCode?: string;
  signal?: AbortSignal;
}

export type TranscribeBackendFn<TAccess extends ASRxAccess> =
  (params: TranscribeBackendFnParams<TAccess>) => Promise<ASRxCoreTranscribeResult>;


/**
 * Core transcription dispatcher. Validates that the access and profile
 * dialects agree, then calls the matching vendor adapter.
 */
export async function asrxBatchCoreTranscribe(params: {
  access: ASRxAccess;
  profile: DASRxProfileAny;
  audio: Uint8Array;
  mimeType: string;
  languageCode?: string;
  signal?: AbortSignal;
}): Promise<ASRxCoreTranscribeResult> {
  const { access, profile, audio, mimeType, languageCode, signal } = params;

  switch (access.dialect) {
    case 'deepgram':
      if (profile.dialect !== 'deepgram')
        throw new Error(`Profile dialect '${profile.dialect}' does not match access dialect 'deepgram'`);
      return await transcribeDeepgram({ access, profile, audio, mimeType, languageCode, signal });

    case 'openai':
      if (profile.dialect !== 'openai')
        throw new Error(`Profile dialect '${profile.dialect}' does not match access dialect 'openai'`);
      return await transcribeOpenAI({ access, profile, audio, mimeType, languageCode, signal });

    default:
      const _exhaustiveCheck: never = access;
      throw new Error(`Unknown ASRx dialect: ${(access as any)?.dialect}`);
  }
}
