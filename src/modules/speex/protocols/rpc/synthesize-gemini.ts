/**
 * Gemini TTS Synthesizer (gemini-3.8-flash-tts, gemini-3.8-flash-lite-tts)
 *
 * Synthesis: POST /v1beta/models/{model}:generateContent, responseModalities ['AUDIO'] + speechConfig voice.
 *            Always whole-audio: streamGenerateContent yields headerless L16 PCM chunks, which the MSE live
 *            player (MP3) cannot play. 3.8 returns audio/wav; L16 PCM (3.1 preview) is wrapped into WAV.
 *            No system instruction (400s on 3.8 TTS); language is auto-detected, so no languageCode is sent.
 *            Style prefixes ('Say cheerfully: ...') are unreliable - 'Say in a whisper:' is read aloud (2026-10-06).
 * Voices:    GET /v1beta/voices - the Voice Library (2089 voices in 30 locales, 2026-10-06), paginated. Ids work as
 *            voiceName on 3.8 TTS only (the 3.1 preview 400s on library ids). The 30 classic voices are the dash-less ids.
 * Access:    the isomorphic geminiAccess - header key server-side (env key fallback), `?key=` under CSF.
 */

import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { geminiAccess, GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import { geminiConvertPCM2WAV } from '~/modules/aix/server/dispatch/chatGenerate/parsers/gemini.audioutils';

import { modelPickOrAuto } from '~/common/util/modelPickUtils';

import type { SpeexWire_Access_Gemini, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import type { SynthesizeBackendFn } from './synthesize.core';
import { SPEEX_DEBUG, SPEEX_DEFAULTS, SPEEX_MODELS } from '../../speex.config';


// configuration
const MAX_VOICE_PAGES = 10; // 1000 voices per page


// Upstream Gemini responses - validated, only the fields we read

const GeminiTTS_Response_schema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        inlineData: z.object({
          mimeType: z.string(),
          data: z.string(),
        }).optional(),
      })).optional(),
    }).optional(),
    finishReason: z.string().optional(),
  })).optional(),
});

const GeminiVoices_Response_schema = z.object({
  voices: z.array(z.object({
    id: z.string(),
    display_name: z.string().optional(),
    language_code: z.string().optional(),
    gender: z.string().optional(),
    persona: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  next_page_token: z.string().optional(),
});


export const synthesizeGemini: SynthesizeBackendFn<SpeexWire_Access_Gemini> = async function* (params) {
  const { access, text, voice, priority, signal } = params;
  if (access.dialect !== 'gemini' || voice.dialect !== 'gemini')
    throw new Error('Mismatched dialect in Gemini synthesize');

  // request
  const model = modelPickOrAuto(voice.ttsModel, SPEEX_MODELS.gemini) ?? (priority === 'fast' ? SPEEX_DEFAULTS.GEMINI_MODEL_FAST : SPEEX_DEFAULTS.GEMINI_MODEL);
  const { headers, url } = geminiAccess(_geminiAccessFromWire(access), `models/${model}`, '/v1beta/{model=models/*}:generateContent', false);
  const body = {
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.ttsVoiceId || SPEEX_DEFAULTS.GEMINI_VOICE } } },
    },
  };

  // fetch
  let response: Response;
  try {
    if (SPEEX_DEBUG) console.log(`[Speex][Gemini] POST ${model}`, { body });
    response = await fetchResponseOrTRPCThrow({ url, method: 'POST', headers, body, signal, name: 'Gemini' });
  } catch (error: any) {
    yield { t: 'error', e: `Gemini fetch failed: ${error.message || 'Unknown error'}` };
    return;
  }

  // whole audio -> WAV
  try {
    const json = GeminiTTS_Response_schema.parse(await response.json());
    const candidate = json.candidates?.[0];
    const audio = candidate?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
    if (!audio)
      throw new Error(`no audio returned (${candidate?.finishReason || 'no candidates'})`);

    const isPCM = audio.mimeType.toLowerCase().startsWith('audio/l16');
    const { base64Data, mimeType } = isPCM ? geminiConvertPCM2WAV(audio.mimeType, audio.data) : { base64Data: audio.data, mimeType: audio.mimeType };

    yield { t: 'audio', chunk: false, base64: base64Data, contentType: mimeType };
    yield { t: 'done', chars: text.length, audioBytes: Math.ceil(base64Data.length * 3 / 4) };
  } catch (error: any) {
    yield { t: 'error', e: `Gemini audio error: ${error.message || 'Unknown error'}` };
  }
};


/**
 * List the Voice Library: the 30 classic voices first, then by locale (the accent - any voice speaks any language).
 * Localized display names repeat across locales ('Tutor 2'), so those carry the locale.
 */
export async function listVoicesGemini(access: SpeexWire_Access_Gemini): Promise<SpeexWire_ListVoices_Output> {
  const gemini = _geminiAccessFromWire(access);

  const wireVoices: NonNullable<z.infer<typeof GeminiVoices_Response_schema>['voices']> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_VOICE_PAGES; page++) {
    const { headers, url } = geminiAccess(gemini, null, `/v1beta/voices?page_size=1000${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''}`, false);
    const json = GeminiVoices_Response_schema.parse(await fetchJsonOrTRPCThrow({ url, headers, name: 'Gemini' }));
    wireVoices.push(...(json.voices ?? []));
    pageToken = json.next_page_token;
    if (!pageToken) break;
  }

  const isClassic = (id: string) => !id.includes('-');
  const voices = wireVoices.map(v => ({
    id: v.id,
    name: isClassic(v.id) || !v.language_code ? (v.display_name || v.id) : `${v.display_name || v.id} (${v.language_code})`,
    description: v.description || undefined,
    category: [v.language_code, v.gender, v.persona].filter(Boolean).join(', ') || undefined,
    _sortKey: `${isClassic(v.id) ? '0' : '1'}|${v.language_code || ''}`,
  }));
  voices.sort((a, b) => a._sortKey.localeCompare(b._sortKey) || a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { voices: voices.map(({ _sortKey, ...voice }) => voice) };
}


// Helpers

function _geminiAccessFromWire(access: SpeexWire_Access_Gemini): GeminiAccessSchema {
  return {
    dialect: 'gemini',
    clientSideFetch: access.clientSideFetch,
    geminiKey: access.apiKey || '',
    geminiHost: access.apiHost || '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED', // schema-required; TTS has no safety settings
  };
}
