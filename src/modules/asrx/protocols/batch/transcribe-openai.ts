/**
 * OpenAI batch transcription adapter.
 *
 * Endpoint: POST {host}/v1/audio/transcriptions
 * Auth:     Authorization: Bearer {apiKey}
 * Body:     multipart/form-data with file + model + options
 * Response: json.text (simple) - `response_format=json` is the default
 *
 * Compatible with OpenAI-compatible proxies that implement the same endpoint.
 */

import type { ASRxAccess_OpenAI } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream OpenAI response (simple JSON)

interface OpenAIWire_Transcription_Response {
  text?: string;
  // verbose_json only:
  language?: string;
  duration?: number;
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

  // Resolve model
  const model = profile.asrModel || ASRX_DEFAULTS.OPENAI_MODEL;
  const language = languageCode ?? profile.language;

  // Build multipart body
  const formData = new FormData();
  formData.append('file', new Blob([audio as BlobPart], { type: mimeType }), _fileNameForMime(mimeType));
  formData.append('model', model);
  if (language) formData.append('language', language);
  if (profile.prompt) formData.append('prompt', profile.prompt);
  if (profile.temperature !== undefined) formData.append('temperature', String(profile.temperature));
  // Default response_format = 'json' - fields: text. We don't request verbose_json here.

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

  // Parse
  let json: OpenAIWire_Transcription_Response;
  try {
    json = await response.json();
  } catch (error: any) {
    throw new Error(`OpenAI response parse failed: ${error?.message || 'Unknown error'}`);
  }

  const text = json.text ?? '';
  const result: ASRxCoreTranscribeResult = {
    text,
    model: `openai/${model}`,
    ...(json.language ? { language: json.language } : {}),
    durationMs: Date.now() - started,
  };

  if (ASRX_DEBUG) console.log('[ASRx][OpenAI] response', { chars: text.length, language: json.language });

  return result;
};


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
