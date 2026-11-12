/**
 * AssemblyAI Dictation batch transcription adapter.
 *
 * Endpoint: POST {host}/v1/transcribe
 * Auth:     Authorization: {apiKey}   (raw key, no scheme)
 * Body:     multipart/form-data: `config` (JSON, optional) + `audio` (bare container type)
 * Response: `text` (verbatim transcript) + `llm_response` (the rewrite: filler removed, punctuation,
 *           self-corrections resolved), 80 ms to 20 min of audio, 256 MB
 *
 * The rewrite always runs and bills (one flat rate, 2026-09: $0.62 per audio hour): the profile's `mode`
 * only picks which of the two texts comes back. A failed rewrite is still a 200 with `llm_response: null`
 * and `llm_error` set (`timeout` is the common one, the rewrite has an internal deadline), so smart mode
 * falls back to the transcript. No model parameter exists (Universal-3.6 Pro behind the endpoint).
 *
 * '/v1/transcribe/live' (upload while recording, 120 s, WAV/PCM only) is a different protocol: not used.
 */

import { z } from 'zod';

import type { ASRxAccess_AssemblyAI } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';
import { asrxAudioBareMimeType, asrxAudioFileName } from './batch.audio';


// Upstream AssemblyAI response - validated, not trusted; only the fields we read, unknown keys ignored

const AssemblyAIWire_Transcribe_Response_schema = z.object({
  text: z.string(),
  llm_response: z.string().nullable().optional(),
  llm_error: z.string().nullable().optional(),
  // auxiliary facts; .catch: wire drift degrades to fewer facts, never fails the transcript
  confidence: z.number().optional().catch(undefined),
  audio_duration_ms: z.number().optional().catch(undefined),
  session_id: z.string().optional().catch(undefined),
});

// Two error body shapes: {status,title,detail} (401, 413, 415, 429, config validation) and {error,error_code} (400, 502, 503, 504)
const AssemblyAIWire_Error_schema = z.object({
  detail: z.string().optional(),
  title: z.string().optional(),
  error: z.string().optional(),
  error_code: z.string().optional(),
});


// language_codes enum (32 codes, 2026-11): anything else 400s, so unknown codes are dropped client-side
const _ASSEMBLYAI_LANGUAGE_CODES = new Set([
  'en', 'es', 'de', 'fr', 'it', 'pt', 'tr', 'nl', 'sv', 'no', 'da', 'fi', 'hi', 'vi', 'he', 'ur',
  'ko', 'ca', 'gl', 'ru', 'ro', 'et', 'fa', 'yue', 'af', 'mr', 'zu', 'xh', 'nn', 'ar', 'ja', 'zh',
]);

/** 'en-US, it' -> ['en', 'it']: BCP-47 tags fold to their language subtag, codes outside the enum are dropped. */
function _languageCodes(language: string | undefined): string[] {
  const codes: string[] = [];
  for (const tag of (language ?? '').toLowerCase().split(/[,\s]+/)) {
    if (!tag) continue;
    const code = _ASSEMBLYAI_LANGUAGE_CODES.has(tag) ? tag : tag.split(/[-_]/)[0];
    if (_ASSEMBLYAI_LANGUAGE_CODES.has(code) && !codes.includes(code))
      codes.push(code);
  }
  return codes;
}

/** Vendor caps: 100 terms and 8000 characters in total - over either, the request 400s. */
function _keyterms(keywords: string[] | undefined): string[] {
  const terms: string[] = [];
  let chars = 0;
  for (const keyword of keywords ?? []) {
    const term = keyword.trim();
    if (!term) continue;
    if (terms.length >= 100 || chars + term.length > 8000) break;
    terms.push(term);
    chars += term.length;
  }
  return terms;
}


export const transcribeAssemblyAI: TranscribeBackendFn<ASRxAccess_AssemblyAI> = async (params) => {

  const { access, profile, audio, mimeType, languageCode, signal } = params;

  if (access.dialect !== 'assemblyai' || profile.dialect !== 'assemblyai')
    throw new Error('Mismatched dialect in AssemblyAI transcribe');


  // Resolve host
  let host = (access.apiHost || ASRX_DEFAULTS.ASSEMBLYAI_HOST).trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/'))
    host = host.slice(0, -1);

  const url = `${host}/v1/transcribe`;

  // Auth - the raw key, no 'Bearer'/'Token' scheme
  if (!access.apiKey) throw new Error('Missing AssemblyAI API key');
  const headers: HeadersInit = {
    'Authorization': access.apiKey.trim(),
    // NOTE: do NOT set Content-Type here - the browser sets it with the multipart boundary
  };

  // Build the config part - only the keys we set: unknown keys 400, and so does each alias pair
  // (stt_prompt/prompt, keyterms_prompt/keyterms/word_boost, llm_instruction/llm)
  const verbatim = profile.mode === 'verbatim';
  const languageCodes = _languageCodes(languageCode ?? profile.language);
  const keyterms = _keyterms(profile.keywords);
  const prompt = profile.prompt?.trim().slice(0, 6000);
  const instruction = verbatim ? undefined : profile.instruction?.trim();
  const config: Record<string, unknown> = {
    ...(languageCodes.length ? { language_codes: languageCodes } : {}),
    ...(keyterms.length ? { keyterms_prompt: keyterms } : {}),
    ...(prompt ? { stt_prompt: prompt } : {}),
    ...(instruction ? { llm_instruction: instruction } : {}),
    ...(profile.rewriteMode && !verbatim ? { rewrite_mode: profile.rewriteMode } : {}),
  };

  // Build the multipart body - the audio part carries the bare container type (docs list 'audio/webm', not 'audio/webm;codecs=opus')
  const audioMimeType = asrxAudioBareMimeType(mimeType);
  const formData = new FormData();
  formData.append('config', new Blob([JSON.stringify(config)], { type: 'application/json' }));
  formData.append('audio', new Blob([audio as BlobPart], { type: audioMimeType }), asrxAudioFileName(audioMimeType));

  if (ASRX_DEBUG) console.log('[ASRx][AssemblyAI] POST', { url, config, audioMimeType, bytes: audio.byteLength });


  // Fetch
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });
  } catch (error: any) {
    throw new Error(`AssemblyAI fetch failed: ${error?.message || 'Unknown error'}`);
  }

  if (!response.ok)
    throw new Error(`AssemblyAI ${response.status}: ${await _errorMessage(response)}`);

  // Parse + validate
  let wire: unknown;
  try {
    wire = await response.json();
  } catch (error: any) {
    throw new Error(`AssemblyAI response parse failed: ${error?.message || 'Unknown error'}`);
  }
  const validated = AssemblyAIWire_Transcribe_Response_schema.safeParse(wire);
  if (!validated.success)
    throw new Error(`AssemblyAI unexpected response: ${validated.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const json = validated.data;

  // smart: the rewrite, unless it failed (llm_response null, llm_error set) or came back empty - then the transcript
  const transcript = json.text.trim();
  const rewrite = json.llm_response?.trim();
  const text = (!verbatim && rewrite) ? rewrite : transcript;

  const result: ASRxCoreTranscribeResult = {
    text,
    model: 'assemblyai/dictation',
    // no language: the response does not report which of the 32 it heard
    ...(json.confidence !== undefined ? { confidence: json.confidence } : {}),
    durationMs: Date.now() - started,
  };

  if (ASRX_DEBUG) console.log('[ASRx][AssemblyAI] response', { chars: text.length, verbatim, rewriteFailed: json.llm_error ?? null, confidence: json.confidence, audioMs: json.audio_duration_ms, sessionId: json.session_id });

  return result;
};


// Helper - the error message out of either body shape: `detail` first, then `error`, then the raw text
// (401 'Invalid API key', 413 'Audio Too Large' past 20 minutes, 400 on a bad config field)

async function _errorMessage(response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => '');
  try {
    const body = AssemblyAIWire_Error_schema.safeParse(JSON.parse(bodyText));
    if (body.success) {
      const message = body.data.detail || body.data.error || body.data.title;
      if (message) return body.data.error_code ? `${message} (${body.data.error_code})` : message;
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return bodyText || response.statusText;
}
