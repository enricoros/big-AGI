/**
 * Gemini batch transcription adapter (gemini-3.5-transcribe).
 *
 * Endpoint: POST {host}/v1beta/interactions - the ONLY working surface: `generateContent` is also
 *           listed, but accepts + bills the audio and returns an empty part (verified 2026-08-28).
 *           Synchronous: the POST completes with the transcript (44-min audio -> ~20s).
 * Access:   isomorphic `geminiAccess` in CSF form (`?key=` + JSON Content-Type only, CORS-verified).
 *           Multi-key (GH #653) is pinned to ONE key for the whole run - a file uploaded under one
 *           project's key is invisible to another's.
 * Audio:    inline base64 up to GEMINI_INLINE_MAX_BYTES (quick dictations: one request, no
 *           server-side file); above it, the shared `geminiFileUpload` (raw bytes, mechanics
 *           documented there) then `{type:'audio', uri}`. `audio/webm;codecs=opus` is accepted
 *           verbatim. The uploaded file is deleted after the run (48h retention otherwise).
 * Privacy:  `store: false` - the interaction record is not retained (GET 404s after).
 * Response: transcript is in `steps[].content[].text` of `model_output` steps; `output_text` is
 *           ALWAYS empty. Silence completes with zero content items. No detected-language, no
 *           confidence.
 * Config:   `mode` takes 'smart' | 'verbatim' as plain strings; `language_codes` (BCP-47) and
 *           `custom_vocabulary` (<=1000 terms; 400s with diarization/timestamps - v1 exposes neither).
 * Limits:   audio bills at 25 tok/s against the 98,304-token input cap -> ~65 minutes; over-cap
 *           fails with a generic `Invalid input received.` (61 min passes, 88 min fails).
 */

import { z } from 'zod';

import { geminiAccess, GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { geminiFileDelete, geminiFileUpload } from '~/modules/llms/vendors/gemini/geminiFiles.client';
import { llmsRandomKeyFromMultiKey } from '~/modules/llms/server/openai/openai.access';

import { convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';

import type { ASRxAccess_Gemini } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream Gemini responses - validated, not trusted; only the fields we read, unknown keys ignored

const GeminiWire_Interaction_Response_schema = z.object({
  status: z.string().optional(),
  // transcript home: model_output steps' text content (`output_text` is always empty - see header)
  steps: z.array(z.object({
    type: z.string().optional(),
    content: z.array(z.object({
      type: z.string().optional(),
      text: z.string().optional(),
    })).optional(),
  })).optional(),
});

export const asrxTranscribeGemini: TranscribeBackendFn<ASRxAccess_Gemini> = async (params) => {

  const { access, profile, audio, mimeType, languageCode, signal } = params;

  if (access.dialect !== 'gemini' || profile.dialect !== 'gemini')
    throw new Error('Mismatched dialect in Gemini transcribe');

  // CSF access with the run's ONE pinned key (see header); an empty key throws in geminiAccess
  const gemini: GeminiAccessSchema = {
    dialect: 'gemini',
    clientSideFetch: true,
    geminiKey: llmsRandomKeyFromMultiKey((access.apiKey || '').trim()),
    geminiHost: access.apiHost || '',
    minSafetyLevel: 'OFF', // schema-required; transcription has no safety knob
  };

  // Resolve model and profile
  const model = profile.asrModel || ASRX_DEFAULTS.GEMINI_MODEL;
  const mode = profile.mode ?? 'smart';
  const language = languageCode ?? profile.language;
  const languageCodes = language ? language.split(/[,\s]+/).filter(Boolean) : [];
  const vocabulary = profile.keywords?.map(k => k.trim()).filter(Boolean).slice(0, 1000) ?? [];
  const mime = mimeType || 'audio/webm'; // recorder default when the caller has no mime

  if (ASRX_DEBUG) console.log('[ASRx][Gemini] transcribe', { model, mode, languageCodes, bytes: audio.byteLength, mime });

  const started = Date.now();

  // Audio input part: inline for quick dictations, Files API above the threshold
  const uploaded = audio.byteLength > ASRX_DEFAULTS.GEMINI_INLINE_MAX_BYTES
    ? await geminiFileUpload(gemini, audio, mime, 'asrx-audio', signal) : null;
  const audioInput = uploaded
    ? { type: 'audio', uri: uploaded.uri, mime_type: mime }
    : { type: 'audio', data: convert_UInt8Array_To_Base64(audio, 'asrx-gemini-inline'), mime_type: mime };

  try {

    // Interactions request
    const { headers, url } = geminiAccess(gemini, null, '/v1beta/interactions', false);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          store: false, // privacy: no server-side interaction record (verified: GET 404s after)
          input: [audioInput],
          generation_config: {
            transcription_config: {
              mode: mode,
              ...(languageCodes.length ? { language_codes: languageCodes } : {}),
              ...(vocabulary.length ? { custom_vocabulary: vocabulary } : {}),
            },
          },
        }),
        signal,
      });
    } catch (error: any) {
      throw new Error(`Gemini fetch failed: ${error?.message || 'Unknown error'}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      // over-cap audio (~65 min at 25 tok/s) fails with this generic message - annotate the likely cause
      const lengthHint = errorText.includes('Invalid input received') ? ` (audio may exceed the model's ~65 minute limit)` : '';
      throw new Error(`Gemini ${response.status}: ${errorText || response.statusText}${lengthHint}`);
    }

    // Parse + validate
    let wire: unknown;
    try {
      wire = await response.json();
    } catch (error: any) {
      throw new Error(`Gemini response parse failed: ${error?.message || 'Unknown error'}`);
    }
    const validated = GeminiWire_Interaction_Response_schema.safeParse(wire);
    if (!validated.success)
      throw new Error(`Gemini unexpected response: ${validated.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    const json = validated.data;

    if (json.status !== 'completed')
      throw new Error(`Gemini transcription ${json.status || 'returned no status'}`);

    // Assemble transcript from the model_output steps (silence -> zero items -> '')
    const text = (json.steps ?? [])
      .filter(step => step.type === 'model_output')
      .flatMap(step => step.content ?? [])
      .map(content => content.text?.trim())
      .filter((t): t is string => !!t)
      .join('\n\n');

    const result: ASRxCoreTranscribeResult = {
      text,
      model: `gemini/${model}`,
      durationMs: Date.now() - started,
      // no language: auto-detection is not reported back; no confidence either
    };

    if (ASRX_DEBUG) console.log('[ASRx][Gemini] response', { chars: text.length, durationMs: result.durationMs });

    return result;

  } finally {
    // release the uploaded audio (48h retention otherwise) - best-effort, also after abort/error
    if (uploaded)
      void geminiFileDelete(gemini, uploaded.name).catch(() => { /* expiry is the fallback */ });
  }
};
