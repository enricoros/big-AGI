/**
 * Resolved Access types for the batch transcription adapters.
 *
 * "Resolved" means the `DCredentialsLLMSService` indirection from the store
 * has been dereferenced: Access only carries concrete apiKey/apiHost/apiOrgId
 * values. `asrxTranscribeBatch` builds these from `DASRxEngine.credentials`
 * before dispatching to a vendor adapter.
 *
 * Plain TypeScript types - no Zod. All ASRx transcription runs client-side
 * (CSF) today, so runtime validation would be redundant. If we ever add a
 * server-side endpoint, add Zod schemas alongside these types at that point.
 */


export type ASRxAccess = ASRxAccess_Deepgram | ASRxAccess_OpenAI;

export interface ASRxAccess_Deepgram {
  dialect: 'deepgram';
  apiKey: string;
  apiHost?: string;   // defaults to api.deepgram.com
}

export interface ASRxAccess_OpenAI {
  dialect: 'openai';
  apiKey?: string;    // required for hosted openai.com; optional for compat proxies
  apiHost?: string;   // defaults to api.openai.com
  apiOrgId?: string;
}
