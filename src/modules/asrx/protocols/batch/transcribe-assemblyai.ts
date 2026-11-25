/**
 * AssemblyAI batch transcription adapter: three APIs on one key, picked per take.
 *
 * Sync:         POST {sync}/v1/transcribe - the word-for-word transcript, up to 20 min; the model goes in the
 *               `X-AAI-Model` header (404 without it). Auto's API.
 * Dictation:    POST {dictation}/v1/transcribe - the same transcript (`text`) plus a cleanup (`llm_response`):
 *               fillers removed, punctuation fixed. Up to 20 min. A failed cleanup is still a 200, with
 *               `llm_response: null` and `llm_error` set: the transcript stands in.
 * Pre-recorded: POST {api}/v2/upload (raw bytes) -> POST /v2/transcript -> poll GET /v2/transcript/{id}. Up to
 *               10 h; the only API with speaker labels and language detection; dictionary, context and speaker
 *               labels bill on top of its base rate. The job and its upload stay in the user's AssemblyAI
 *               account: DELETE is not among the methods its CORS allows, so the browser cannot remove them.
 * Routing:      the profile's pick, unless the take needs Pre-recorded: speaker labels, a language outside the
 *               32 of Sync and Dictation, a known length past 20 min, or a 413 from them when it was unknown.
 * Body:         Sync and Dictation take multipart `audio` + a `config` JSON part; unknown config keys 400. The
 *               audio part's Content-Type picks the decoder: `audio/webm;codecs=opus` decodes, a wrong container
 *               label 400s ('malformed webm stream'), `application/octet-stream` 415s.
 * Auth:         the key as is in `Authorization`, on all three.
 */

import { z } from 'zod';

import { abortSignalReason, delayOrAbort } from '~/common/util/abortUtils';
import { fetchJsonOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';

import type { ASRxAccess_AssemblyAI } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';
import type { DProfileAssemblyAI } from '../../asrx.types';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream responses - validated, not trusted; only the fields we read, unknown keys ignored

// Sync and Dictation share it; Dictation adds the cleanup
const AssemblyAIWire_Transcribe_Response_schema = z.object({
  text: z.string(),
  llm_response: z.string().nullish(),
  llm_error: z.string().nullish(),
  confidence: z.number().optional().catch(undefined),
});

const AssemblyAIWire_Upload_Response_schema = z.object({
  upload_url: z.string(),
});

const AssemblyAIWire_Transcript_schema = z.object({
  id: z.string(),
  status: z.string(), // 'queued' | 'processing' | 'completed' | 'error'
  error: z.string().nullish(),
  text: z.string().nullish(),
  // auxiliary facts; .catch: wire drift degrades to fewer facts, never fails the transcript
  utterances: z.array(z.object({ speaker: z.string(), text: z.string() })).nullish().catch(undefined),
  language_code: z.string().nullish().catch(undefined),
  confidence: z.number().nullish().catch(undefined),
  speech_model_used: z.string().nullish().catch(undefined),
});


// Sync and Dictation `language_codes` - anything else 400s; Pre-recorded takes the others (Universal-2)
const _SHORT_API_LANGUAGES: ReadonlySet<string> = new Set([
  'en', 'es', 'de', 'fr', 'it', 'pt', 'tr', 'nl', 'sv', 'no', 'da', 'fi', 'hi', 'vi', 'ar', 'he',
  'ja', 'ur', 'zh', 'ko', 'ca', 'gl', 'ru', 'ro', 'et', 'fa', 'yue', 'af', 'mr', 'zu', 'xh', 'nn',
]);

/** One take, resolved from the profile and the call's overrides. */
interface _Take {
  apiKey: string;
  profile: DProfileAssemblyAI;
  languageCodes: string[];
  keyterms: string[];
  prompt: string | undefined;
  audio: Uint8Array;
  mimeType: string;
  signal?: AbortSignal;
}


export const transcribeAssemblyAI: TranscribeBackendFn<ASRxAccess_AssemblyAI> = async (params) => {

  const { access, profile, audio, mimeType, languageCode, audioDurationMs, signal } = params;

  if (access.dialect !== 'assemblyai' || profile.dialect !== 'assemblyai')
    throw new Error('Mismatched dialect in AssemblyAI transcribe');
  if (!access.apiKey) throw new Error('Missing AssemblyAI API key');

  // a stored region this build does not know falls back to the default routing
  const hosts = ASRX_DEFAULTS.ASSEMBLYAI_HOSTS[profile.region ?? 'default'] ?? ASRX_DEFAULTS.ASSEMBLYAI_HOSTS.default;
  const take: _Take = {
    apiKey: access.apiKey.trim(),
    profile,
    languageCodes: _languageCodes(languageCode ?? profile.language),
    keyterms: _keyterms(profile.keywords),
    prompt: profile.prompt?.trim() || undefined,
    audio,
    mimeType,
    signal,
  };

  // the pick (Auto = Sync), unless the take needs what only Pre-recorded does
  const needsPrerecorded = profile.api === 'prerecorded' || !!profile.diarize
    || take.languageCodes.some(code => !_SHORT_API_LANGUAGES.has(code))
    || (audioDurationMs !== undefined && audioDurationMs > ASRX_DEFAULTS.ASSEMBLYAI_SHORT_MAX_MS);

  if (ASRX_DEBUG) console.log('[ASRx][AssemblyAI] take', { api: needsPrerecorded ? 'prerecorded' : profile.api ?? 'sync', languageCodes: take.languageCodes, bytes: audio.byteLength, audioDurationMs });

  const started = Date.now();
  const result =
    (!needsPrerecorded && await _transcribeShort(profile.api === 'dictation' ? hosts.dictation : hosts.sync, profile.api === 'dictation', take))
    || await _transcribePrerecorded(hosts.prerecorded, take);

  return { ...result, durationMs: Date.now() - started };
};


/** Sync, or Dictation; null when the audio is past their length cap (413), for Pre-recorded to take. */
async function _transcribeShort(host: string, isDictation: boolean, take: _Take): Promise<ASRxCoreTranscribeResult | null> {
  const { apiKey, profile, languageCodes, keyterms, prompt, audio, mimeType, signal } = take;

  // only the keys we set: unknown keys 400, and so does each alias pair (prompt/stt_prompt, keyterms_prompt/keyterms)
  const instruction = isDictation ? profile.instruction?.trim() : undefined;
  const config = {
    ...(languageCodes.length && { language_codes: languageCodes }),
    ...(keyterms.length && { keyterms_prompt: keyterms }),
    ...(prompt && { prompt: prompt.slice(0, 6000) }),
    ...(isDictation && { rewrite_mode: profile.rewriteMode ?? 'fast' }), // always sent: the docs disagree on the default
    ...(instruction && { llm_instruction: instruction }),
  };

  const form = new FormData();
  form.append('config', new Blob([JSON.stringify(config)], { type: 'application/json' }));
  // imports may carry a video container's type (a .webm or .mp4 recording): the audio decoder reads the same bytes
  form.append('audio', new Blob([audio as BlobPart], { type: mimeType.replace(/^video\//, 'audio/') }));

  let wire: object;
  try {
    wire = await fetchJsonOrTRPCThrow({
      url: `${host}/v1/transcribe`,
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        ...(!isDictation && { 'X-AAI-Model': ASRX_DEFAULTS.ASSEMBLYAI_SYNC_MODEL }),
      },
      body: form,
      signal,
      name: 'AssemblyAI',
    });
  } catch (error) {
    if (error instanceof TRPCFetcherError && error.httpStatus === 413)
      return null;
    throw error;
  }
  const json = _validated(AssemblyAIWire_Transcribe_Response_schema, wire);

  if (ASRX_DEBUG && isDictation && json.llm_error) console.log('[ASRx][AssemblyAI] cleanup failed, transcript returned:', json.llm_error);

  return {
    text: (isDictation && json.llm_response?.trim()) || json.text.trim(),
    model: isDictation ? 'assemblyai/dictation' : `assemblyai/${ASRX_DEFAULTS.ASSEMBLYAI_SYNC_MODEL}`,
    ...(json.confidence !== undefined && { confidence: json.confidence }),
  };
}


/** Pre-recorded: upload, submit, poll until the job ends. */
async function _transcribePrerecorded(host: string, take: _Take): Promise<ASRxCoreTranscribeResult> {
  const { apiKey, profile, languageCodes, keyterms, prompt, audio, signal } = take;

  const upload = _validated(AssemblyAIWire_Upload_Response_schema, await fetchJsonOrTRPCThrow({
    url: `${host}/v2/upload`,
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/octet-stream' },
    body: new Blob([audio as BlobPart]),
    signal,
    name: 'AssemblyAI',
  }));

  let job = _validated(AssemblyAIWire_Transcript_schema, await fetchJsonOrTRPCThrow({
    url: `${host}/v2/transcript`,
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: {
      audio_url: upload.upload_url,
      speech_models: ASRX_DEFAULTS.ASSEMBLYAI_PRERECORDED_MODELS,
      // no language: detect it (and report it); one: pin it; several: code switching
      ...(!languageCodes.length ? { language_detection: true }
        : languageCodes.length === 1 ? { language_code: languageCodes[0] }
          : { language_codes: languageCodes }),
      ...(keyterms.length && { keyterms_prompt: keyterms }),
      ...(prompt && { prompt }),
      ...(profile.diarize && { speaker_labels: true }),
    },
    signal,
    name: 'AssemblyAI',
  }));

  // the API allows 60 polls a minute per transcript
  while (job.status === 'queued' || job.status === 'processing') {
    if (await delayOrAbort(1000, signal) === 'aborted') throw abortSignalReason(signal!);
    job = _validated(AssemblyAIWire_Transcript_schema, await fetchJsonOrTRPCThrow({
      url: `${host}/v2/transcript/${job.id}`,
      headers: { 'Authorization': apiKey },
      signal,
      name: 'AssemblyAI',
    }));
  }
  // silence: language detection fails the job, where a pinned language and the other two APIs return ''
  if (job.status === 'error' && !languageCodes.length && /no spoken audio/i.test(job.error ?? ''))
    return { text: '', model: `assemblyai/${job.speech_model_used || 'pre-recorded'}` };
  if (job.status !== 'completed')
    throw new Error(`AssemblyAI transcription ${job.status}: ${job.error || 'no reason given'}`);

  // speaker labels: the utterances as 'Speaker A:' turns, as the OpenAI adapter writes them
  const turns = profile.diarize ? job.utterances?.map(u => `Speaker ${u.speaker}: ${u.text.trim()}`) : undefined;

  return {
    text: turns?.length ? turns.join('\n\n') : (job.text ?? '').trim(),
    model: `assemblyai/${job.speech_model_used || 'pre-recorded'}`,
    ...(job.language_code && { language: job.language_code.replace('_', '-') }), // 'en_us' -> 'en-us'
    ...(typeof job.confidence === 'number' && { confidence: job.confidence }),
  };
}


// --- Helpers ---

/** 'en-US, it' -> ['en', 'it']: tags fold to their language subtag. */
function _languageCodes(language: string | undefined): string[] {
  const codes: string[] = [];
  for (const tag of (language ?? '').toLowerCase().split(/[,\s]+/)) {
    const code = tag.split(/[-_]/)[0];
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** The strictest caps of the three APIs: 100 terms and 8000 characters in all (Sync, Dictation), 6 words a term (Pre-recorded). */
function _keyterms(keywords: string[] | undefined): string[] {
  const terms: string[] = [];
  let chars = 0;
  for (const keyword of keywords ?? []) {
    const term = keyword.trim();
    if (!term || term.split(/\s+/).length > 6) continue;
    if (terms.length >= 100 || chars + term.length > 8000) break;
    terms.push(term);
    chars += term.length;
  }
  return terms;
}

function _validated<T>(schema: z.ZodType<T>, wire: unknown): T {
  const validated = schema.safeParse(wire);
  if (!validated.success)
    throw new Error(`AssemblyAI unexpected response: ${validated.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return validated.data;
}
