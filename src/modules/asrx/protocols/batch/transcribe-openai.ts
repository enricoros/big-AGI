/**
 * OpenAI batch transcription adapter.
 *
 * Endpoint: POST {host}/v1/audio/transcriptions
 * Auth:     Authorization: Bearer {apiKey}
 * Body:     multipart/form-data with file + model + options
 *
 * Per-model request shape (empirically verified 2026-07-25, gpt-transcribe ablation 2026-07-28):
 * - gpt-transcribe:           json + `include[]=logprobs` (like gpt-4o); REJECTS verbose_json
 *   ('json'/'text' only); responds with a `languages: [{code}]` detected-languages array.
 *   ONLY model taking `keywords[]` (term hints, no observed cap) and `languages[]` (validated
 *   codes) - every older model 400s on both; also takes singular `language` but 400s if BOTH
 *   language and languages[] are present, so we only ever send the plural form
 * - gpt-4o-(mini-)transcribe: json + `include[]=logprobs` -> token logprobs (derived confidence).
 *   CAUTION: any `prompt` (even a bare term list) makes this family drop sentences (10/12 in
 *   ablation) - so keywords are NOT folded into its prompt; a user-set prompt is still honored
 * - whisper-1:                `verbose_json` -> language, duration, segment avg_logprob;
 *   prompt is its documented vocabulary channel and is truncation-safe (keywords fold in)
 * - gpt-4o-transcribe-diarize (via profile.diarize): `diarized_json` + REQUIRED chunking_strategy;
 *   REJECTS prompt and keywords[] (400); segments carry speaker letters
 * - gpt-live-transcribe: NOT usable here - realtime transcription sessions only, errors on this endpoint
 *
 * Compatible with OpenAI-compatible proxies that implement the same endpoint.
 */

import { z } from 'zod';

import type { ASRxAccess_OpenAI } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream OpenAI response - validated, not trusted; only the fields we read, unknown keys ignored

const OpenAIWire_Transcription_Response_schema = z.object({
  text: z.string().optional(),
  // whisper-1 verbose_json; .catch: auxiliary branch - wire drift degrades to fewer facts, never fails the transcript
  language: z.string().optional().catch(undefined),
  duration: z.number().optional().catch(undefined),
  // gpt-transcribe json: detected languages, ISO-639-1 codes
  languages: z.array(z.object({
    code: z.string().optional(),
  })).optional().catch(undefined),
  // whisper-1 verbose_json (avg_logprob) and diarize diarized_json (speaker + text) share this array
  segments: z.array(z.object({
    text: z.string().optional(),
    speaker: z.string().optional(),
    avg_logprob: z.number().optional(),
  })).optional().catch(undefined),
  // gpt-4o-(mini-)transcribe with include[]=logprobs
  logprobs: z.array(z.object({
    logprob: z.number().optional(),
  })).optional().catch(undefined),
});


// whisper-1 verbose_json reports full language names - map the common ones to ISO-639-1
const _WHISPER_LANGUAGE_CODES: Record<string, string> = {
  arabic: 'ar', chinese: 'zh', czech: 'cs', danish: 'da', dutch: 'nl', english: 'en', finnish: 'fi',
  french: 'fr', german: 'de', greek: 'el', hebrew: 'he', hindi: 'hi', hungarian: 'hu', indonesian: 'id',
  italian: 'it', japanese: 'ja', korean: 'ko', norwegian: 'no', polish: 'pl', portuguese: 'pt',
  romanian: 'ro', russian: 'ru', spanish: 'es', swedish: 'sv', thai: 'th', turkish: 'tr',
  ukrainian: 'uk', vietnamese: 'vi',
};

/** 0..1 confidence proxy from logprobs: exp of the mean. */
function _confidenceFromLogprobs(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (!nums.length) return undefined;
  return Math.exp(nums.reduce((a, b) => a + b, 0) / nums.length);
}


export const transcribeOpenAI: TranscribeBackendFn<ASRxAccess_OpenAI> = async (params) => {

  const { access, profile, audio, mimeType, languageCode, signal } = params;

  if (access.dialect !== 'openai' || profile.dialect !== 'openai')
    throw new Error('Mismatched dialect in OpenAI transcribe');


  // Resolve host
  let host = (access.apiHost || ASRX_DEFAULTS.OPENAI_HOST).trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/'))
    host = host.slice(0, -1);

  const url = `${host}/v1/audio/transcriptions`;

  // Auth - required for api.openai.com, optional for local/proxy hosts
  const usingDefaultHost = !access.apiHost || access.apiHost.includes('openai.com');
  if (usingDefaultHost && !access.apiKey)
    throw new Error('Missing OpenAI API key');

  const headers: HeadersInit = {
    ...(access.apiKey ? { 'Authorization': `Bearer ${access.apiKey.trim()}` } : {}),
    ...(access.apiOrgId ? { 'OpenAI-Organization': access.apiOrgId } : {}),
    // NOTE: do NOT set Content-Type here - the browser sets it with the multipart boundary
  };

  // Resolve model - diarization is a dedicated model, not a flag
  const useDiarize = !!profile.diarize;
  const model = useDiarize ? 'gpt-4o-transcribe-diarize' : (profile.asrModel || ASRX_DEFAULTS.OPENAI_MODEL);
  const isWhisper = model === 'whisper-1';
  const isGptTranscribe = model.startsWith('gpt-transcribe'); // new-gen STT: keywords[] + languages[] wire params (older models 400 on both)
  const language = languageCode ?? profile.language;
  const languages = language ? language.split(/[,\s]+/).filter(Boolean) : [];
  const keywords = profile.keywords?.map(k => k.trim()).filter(Boolean) ?? [];

  // Build multipart body
  const formData = new FormData();
  formData.append('file', new Blob([audio as BlobPart], { type: mimeType }), _fileNameForMime(mimeType));
  formData.append('model', model);
  if (isGptTranscribe)
    languages.forEach(code => formData.append('languages[]', code)); // never the singular form too: the pair 400s
  else if (languages.length)
    formData.append('language', languages[0]);
  if (profile.temperature !== undefined) formData.append('temperature', String(profile.temperature));
  if (useDiarize) {
    formData.append('response_format', 'diarized_json');
    formData.append('chunking_strategy', 'auto');    // REQUIRED by diarization models beyond short clips
    // prompt and keywords deliberately not sent - the diarization model 400s on both
  } else if (isWhisper) {
    formData.append('response_format', 'verbose_json'); // unlocks language + duration + segment logprobs
    const prompt = _promptWithKeywords(profile.prompt, keywords);
    if (prompt) formData.append('prompt', prompt);
  } else {
    formData.append('include[]', 'logprobs');           // token logprobs (json format only) -> derived confidence
    if (isGptTranscribe) keywords.forEach(k => formData.append('keywords[]', k));
    // gpt-4o family: keywords deliberately not folded - any prompt destabilizes it (see header); user-set prompt honored
    if (profile.prompt) formData.append('prompt', profile.prompt);
  }

  if (ASRX_DEBUG) console.log('[ASRx][OpenAI] POST', { url, model, language, bytes: audio.byteLength });


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
    throw new Error(`OpenAI fetch failed: ${error?.message || 'Unknown error'}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${errorText || response.statusText}`);
  }

  // Parse + validate
  let wire: unknown;
  try {
    wire = await response.json();
  } catch (error: any) {
    throw new Error(`OpenAI response parse failed: ${error?.message || 'Unknown error'}`);
  }
  const validated = OpenAIWire_Transcription_Response_schema.safeParse(wire);
  if (!validated.success)
    throw new Error(`OpenAI unexpected response: ${validated.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const json = validated.data;

  // diarize: rebuild the transcript as speaker-labeled turns (parity with Deepgram's labeled paragraphs)
  let text = json.text?.trim() ?? '';
  if (useDiarize && json.segments?.length) {
    const turns: string[] = [];
    let speaker: string | undefined = undefined;
    for (const segment of json.segments) {
      const segmentText = segment.text?.trim();
      if (!segmentText) continue;
      if (segment.speaker && segment.speaker !== speaker) {
        speaker = segment.speaker;
        turns.push(`Speaker ${speaker}: ${segmentText}`);
      } else if (turns.length)
        turns[turns.length - 1] += ' ' + segmentText;
      else
        turns.push(segmentText);
    }
    if (turns.length) text = turns.join('\n\n');
  }

  // confidence: derived proxy - token logprobs (gpt-4o) or segment avg_logprob (whisper-1)
  const confidence = json.logprobs?.length
    ? _confidenceFromLogprobs(json.logprobs.map(l => l.logprob))
    : (isWhisper && json.segments?.length) ? _confidenceFromLogprobs(json.segments.map(s => s.avg_logprob))
      : undefined;

  // whisper-1 reports full names ('english') - normalize to ISO codes where known;
  // gpt-transcribe reports ISO codes in `languages` (comma-joined when code-switched audio detects several)
  const detectedLanguage = json.language ? (_WHISPER_LANGUAGE_CODES[json.language.trim().toLowerCase()] ?? json.language)
    : (json.languages?.map(l => l.code).filter((c): c is string => !!c).join(',') || undefined);

  const result: ASRxCoreTranscribeResult = {
    text,
    model: `openai/${model}`,
    ...(detectedLanguage ? { language: detectedLanguage } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    durationMs: Date.now() - started,
  };

  if (ASRX_DEBUG) console.log('[ASRx][OpenAI] response', { chars: text.length, language: detectedLanguage, confidence });

  return result;
};


// Helper - whisper-1 has no keywords[] param but takes term hints through the prompt, its documented vocabulary channel

function _promptWithKeywords(prompt: string | undefined, keywords: string[]): string | undefined {
  if (!keywords.length) return prompt;
  const vocabulary = keywords.join(', ');
  return prompt ? `${prompt}\n${vocabulary}` : vocabulary;
}


// Helper - derive a filename with a useful extension from the MIME type (OpenAI infers format from filename)

function _fileNameForMime(mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('flac')) return 'audio.flac';
  return 'audio';
}
