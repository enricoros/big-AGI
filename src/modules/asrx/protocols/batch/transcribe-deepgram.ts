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

import { z } from 'zod';

import type { ASRxAccess_Deepgram } from './batch.access';
import type { ASRxCoreTranscribeResult, TranscribeBackendFn } from './transcribe.core';
import type { ASRxDetectedTopic } from '../../asrx.types';

import { ASRX_DEBUG, ASRX_DEFAULTS } from '../../asrx.config';


// Upstream Deepgram response - validated, not trusted; only the fields we read, unknown keys ignored

const DeepgramWire_Listen_Response_schema = z.object({
  results: z.object({
    channels: z.array(z.object({
      alternatives: z.array(z.object({
        transcript: z.string().optional(),
        confidence: z.number().optional(),
        languages: z.array(z.string()).optional(),
        paragraphs: z.object({
          // paragraph-broken text: '\n\n' separators, stray edge newlines, 'Speaker N:' prefixes when diarizing
          transcript: z.string().optional(),
        }).optional(),
      })).optional(),
      detected_language: z.string().optional(),
    })).optional(),
    // topics=true; .catch: auxiliary branch - wire drift degrades to no-labels, never fails the transcript
    topics: z.object({
      segments: z.array(z.object({
        text: z.string().optional(),  // the transcript span the topics were detected in
        start_word: z.number().optional(), // word-index span of `text` within the transcript - 0-based (verified)
        end_word: z.number().optional(),
        topics: z.array(z.object({
          topic: z.string().optional(),
          confidence_score: z.number().optional(),
        })).optional(),
      })).optional(),
    }).optional().catch(undefined),
    // sentiment=true; .catch: same degradation rule
    sentiments: z.object({
      average: z.object({
        sentiment: z.string().optional(),
        sentiment_score: z.number().optional(),
      }).optional(),
    }).optional().catch(undefined),
  }).optional(),
  metadata: z.object({
    duration: z.number().optional(),
    detected_language: z.string().optional(),
    language: z.string().optional(),
  }).optional().catch(undefined),
});


/** `keyterm` is Nova-3/Flux only; earlier models take `keywords` - each 400s on the wrong model. */
function _modelTermBoostParam(model: string): 'keyterm' | 'keywords' {
  return (model.startsWith('nova-3') || model.startsWith('flux')) ? 'keyterm' : 'keywords';
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
  if (profile.topics) queryParams.set('topics', 'true');
  if (profile.sentiment) queryParams.set('sentiment', 'true');

  // user dictionary: one list in the profile, model-split wire param; hard cap guards the URL length
  const keyterms = profile.keyterms?.map(term => term.trim()).filter(Boolean).slice(0, 100);
  if (keyterms?.length) {
    const termParam = _modelTermBoostParam(model);
    for (const term of keyterms) queryParams.append(termParam, term);
  }

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

  // Parse + validate
  let wire: unknown;
  try {
    wire = await response.json();
  } catch (error: any) {
    throw new Error(`Deepgram response parse failed: ${error?.message || 'Unknown error'}`);
  }
  const validated = DeepgramWire_Listen_Response_schema.safeParse(wire);
  if (!validated.success)
    throw new Error(`Deepgram unexpected response: ${validated.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const json = validated.data;

  const primary = json.results?.channels?.[0]?.alternatives?.[0];
  // smart_format runs the paragraphs formatter: prefer its transcript (real paragraph breaks),
  // trimming the stray leading/trailing newlines Deepgram wraps it in
  const text = (primary?.paragraphs?.transcript?.trim() || primary?.transcript) ?? '';
  const confidence = primary?.confidence;
  const detectedLanguage =
    json.metadata?.detected_language
    || json.metadata?.language
    || json.results?.channels?.[0]?.detected_language
    || primary?.languages?.[0];

  // topics: dedupe labels across segments (order of first appearance), keeping the first
  // supporting quote - the transcript span the topic was detected in - and the best score
  let topics: ASRxDetectedTopic[] | undefined;
  if (json.results?.topics?.segments?.length) {
    const byLabel = new Map<string, ASRxDetectedTopic>();
    for (const segment of json.results.topics.segments) {
      const segmentQuote = segment.text?.trim();
      const quote = segmentQuote && segmentQuote.length > 200 ? segmentQuote.slice(0, 200) + '…' : segmentQuote;
      // a segment (one detection span) can carry multiple labels: optionally keep the top-scoring one only
      let entries = segment.topics ?? [];
      if (ASRX_DEFAULTS.DEEPGRAM_TOPICS_BEST_PER_SEGMENT && entries.length > 1)
        entries = [entries.reduce((best, e) => (e.confidence_score ?? 0) > (best.confidence_score ?? 0) ? e : best)];
      for (const entry of entries) {
        const label = entry.topic?.trim();
        if (!label) continue;
        const prev = byLabel.get(label.toLowerCase());
        if (!prev)
          byLabel.set(label.toLowerCase(), {
            label,
            ...(quote ? { quote } : {}),
            ...(entry.confidence_score !== undefined ? { score: entry.confidence_score } : {}),
            // word span rides with the first segment, same as `quote` (best-score updates don't move it)
            ...(segment.start_word !== undefined ? { wordBegin: segment.start_word } : {}),
            ...(segment.end_word !== undefined ? { wordEnd: segment.end_word } : {}),
          });
        else if (entry.confidence_score !== undefined && !(prev.score! >= entry.confidence_score))
          prev.score = entry.confidence_score;
      }
    }
    const detected = [...byLabel.values()].filter(t => t.score === undefined || t.score >= ASRX_DEFAULTS.DEEPGRAM_TOPICS_MIN_CONFIDENCE);
    if (detected.length) topics = detected;
  }

  // sentiment: the whole-audio average (segments are ignored)
  const wireSentiment = json.results?.sentiments?.average;
  const sentiment = wireSentiment?.sentiment ? {
    label: wireSentiment.sentiment,
    ...(typeof wireSentiment.sentiment_score === 'number' ? { score: wireSentiment.sentiment_score } : {}),
  } : undefined;

  const result: ASRxCoreTranscribeResult = {
    text,
    model: `deepgram/${model}`,
    ...(detectedLanguage ? { language: detectedLanguage } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    durationMs: Date.now() - started,
    ...(topics ? { topics } : {}),
    ...(sentiment ? { sentiment } : {}),
  };

  if (ASRX_DEBUG) console.log('[ASRx][Deepgram] response', { chars: text.length, confidence, detectedLanguage, topics, sentiment });

  return result;
};
