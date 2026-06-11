/**
 * Deepgram batch transcription adapter.
 *
 * Endpoint: POST {host}/v1/listen
 * Auth:     Authorization: Token {apiKey}
 * Body:     raw audio bytes (Content-Type = mimeType)
 * Response: json.results.channels[0].alternatives[0].transcript
 *
 * Query parameters carry the profile (model, language, smart_format, ...).
 */

import type { ASRxAccess_Deepgram } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream Deepgram response shape (only the fields we read)

interface DeepgramWire_Listen_Response {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        languages?: string[];        // may be present when multilingual detection runs
      }>;
      detected_language?: string;    // some responses
    }>;
  };
  metadata?: {
    duration?: number;                // seconds
    detected_language?: string;
    language?: string;
  };
}


export const transcribeDeepgram: TranscribeBackendFn<ASRxAccess_Deepgram> = async (params) => {

  const { access, profile, audio, mimeType, languageCode, signal } = params;

  if (access.dialect !== 'deepgram' || profile.dialect !== 'deepgram')
    throw new Error('Mismatched dialect in Deepgram transcribe');


  // Resolve host
  let host = (access.apiHost || ASRX_DEFAULTS.DEEPGRAM_HOST).trim();
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/'))
    host = host.slice(0, -1);

  // Resolve model (default to config)
  const model = profile.asrModel || ASRX_DEFAULTS.DEEPGRAM_MODEL;

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('model', model);

  const language = languageCode ?? profile.language ?? ASRX_DEFAULTS.DEEPGRAM_LANGUAGE;
  if (language) queryParams.set('language', language);

  if (profile.smartFormat !== undefined) queryParams.set('smart_format', String(profile.smartFormat));
  if (profile.diarize !== undefined) queryParams.set('diarize', String(profile.diarize));
  if (profile.utterances !== undefined) queryParams.set('utterances', String(profile.utterances));
  if (profile.keywords?.length)
    for (const kw of profile.keywords) queryParams.append('keywords', kw);

  const url = `${host}/v1/listen?${queryParams.toString()}`;

  // Auth & content headers
  if (!access.apiKey) throw new Error('Missing Deepgram API key');
  const headers: HeadersInit = {
    'Authorization': `Token ${access.apiKey.trim()}`,
    'Content-Type': mimeType || 'application/octet-stream',
  };

  if (ASRX_DEBUG) console.log('[ASRx][Deepgram] POST', { url, mimeType, bytes: audio.byteLength });


  // Fetch
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: new Blob([audio as BlobPart], { type: mimeType }),
      signal,
    });
  } catch (error: any) {
    throw new Error(`Deepgram fetch failed: ${error?.message || 'Unknown error'}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Deepgram ${response.status}: ${errorText || response.statusText}`);
  }

  // Parse
  let json: DeepgramWire_Listen_Response;
  try {
    json = await response.json();
  } catch (error: any) {
    throw new Error(`Deepgram response parse failed: ${error?.message || 'Unknown error'}`);
  }

  const primary = json.results?.channels?.[0]?.alternatives?.[0];
  const text = primary?.transcript ?? '';
  const confidence = primary?.confidence;
  const detectedLanguage =
    json.metadata?.detected_language
    || json.metadata?.language
    || json.results?.channels?.[0]?.detected_language
    || primary?.languages?.[0];

  const result: ASRxCoreTranscribeResult = {
    text,
    model: `deepgram/${model}`,
    ...(detectedLanguage ? { language: detectedLanguage } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    durationMs: Date.now() - started,
  };

  if (ASRX_DEBUG) console.log('[ASRx][Deepgram] response', { chars: text.length, confidence, detectedLanguage });

  return result;
};
