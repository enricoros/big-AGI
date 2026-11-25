/**
 * ASRx engine test - transcribes a clip of known text through one engine and grades the transcript.
 *
 * Grading is word error rate, lenient where correct engines legitimately differ: case, punctuation,
 * hyphens ('word-for-word'), and the spellings of the brand ('Big AGI', 'BigAGI', 'Big A.G.I.').
 * The test overrides only what would fail a correct engine on an English clip - a pinned non-English
 * language, speaker labels, topics - and keeps the rest of the profile (model, mode, dictionary).
 */

import type { DASRxEngineAny, DASRxProfileAny } from './asrx.types';
import { ASRX_TEST_CLIPS, ASRX_TEST_MAX_WORD_ERROR } from './asrx.config';
import { asrxTranscribeBatch } from './protocols/batch/batch.client';


// --- Grading ---

/** A word of the clip's text aligned with the transcript, in transcript order. */
export type ASRxTestWord =
  | { op: 'ok'; heard: string }
  | { op: 'swap'; heard: string; expected: string }
  | { op: 'extra'; heard: string }
  | { op: 'missing'; expected: string };

export interface ASRxTestGrade {
  words: ASRxTestWord[];
  wordsOff: number;   // word edit distance
  wordsTotal: number; // words in the clip's text
  pass: boolean;
}

// captures 'Big-AGI', 'Big AGI', 'BigAGI', 'Big A.G.I.', 'big a g i' - not a mishearing such as 'Big AGY' or 'BDGI'
const _BRAND_SPLIT = /(\bbig[\s-]*a\.?\s*g\.?\s*i\b\.?)/i;

function _words(text: string): { shown: string; norm: string }[] {
  const words: { shown: string; norm: string }[] = [];
  // split's capture group puts the brand spellings at the odd indices
  text.split(_BRAND_SPLIT).forEach((part, index) => {
    if (index % 2) {
      words.push({ shown: part.trim(), norm: 'bigagi' });
      return;
    }
    for (const shown of part.split(/[\s‐-―-]+/)) {
      const norm = shown.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (norm) words.push({ shown, norm });
    }
  });
  return words;
}

function _gradeTranscript(expectedText: string, heardText: string): ASRxTestGrade {
  const expected = _words(expectedText);
  const heard = _words(heardText);
  const cost = (i: number, j: number) => expected[i - 1].norm === heard[j - 1].norm ? 0 : 1;

  // word-level edit distance table, then a walk back from the end labels each word
  const d = Array.from({ length: expected.length + 1 }, (_, i) =>
    Array.from({ length: heard.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= expected.length; i++)
    for (let j = 1; j <= heard.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost(i, j));

  const words: ASRxTestWord[] = [];
  let i = expected.length, j = heard.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + cost(i, j)) {
      words.push(cost(i, j) ? { op: 'swap', heard: heard[j - 1].shown, expected: expected[i - 1].shown } : { op: 'ok', heard: heard[j - 1].shown });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1)
      words.push({ op: 'extra', heard: heard[--j].shown });
    else
      words.push({ op: 'missing', expected: expected[--i].shown });
  }
  words.reverse();

  const wordsOff = d[expected.length][heard.length];
  return {
    words,
    wordsOff,
    wordsTotal: expected.length,
    pass: expected.length > 0 && wordsOff / expected.length <= ASRX_TEST_MAX_WORD_ERROR,
  };
}


// --- Run ---

export type ASRxEngineTestResult =
  | { outcome: 'graded'; grade: ASRxTestGrade; heardText: string; model: string; latencyMs: number; languageForced: boolean }
  | { outcome: 'error'; errorText: string }
  | { outcome: 'aborted' };

// rotation from a random start: consecutive tests hear different lines
let _nextClip = Math.floor(Math.random() * ASRX_TEST_CLIPS.length);

/** Never throws. The clip is fetched per test (the browser caches it), so its bytes stay out of the bundle. */
export async function asrxTestEngine(engine: DASRxEngineAny, signal: AbortSignal): Promise<ASRxEngineTestResult> {
  const clip = ASRX_TEST_CLIPS[_nextClip++ % ASRX_TEST_CLIPS.length];
  const languageCode = _testLanguageOverride(engine.profile);
  try {
    const response = await fetch(clip.url, { signal });
    if (!response.ok)
      return { outcome: 'error', errorText: `Test clip unavailable (HTTP ${response.status})` };
    const audio = await response.blob();

    const started = performance.now();
    const result = await asrxTranscribeBatch(audio, clip.mimeType, { engineId: engine.engineId }, {
      languageCode,
      diarizeHint: false, // 'Speaker 0:' labels are not words of the clip
      topicsHint: false,
      signal,
      label: 'Engine test',
    });
    if (!result.success)
      return result.errorType === 'asr-aborted' ? { outcome: 'aborted' } : { outcome: 'error', errorText: result.errorText };

    return {
      outcome: 'graded',
      grade: _gradeTranscript(clip.text, result.text),
      heardText: result.text,
      model: result.model,
      latencyMs: result.durationMs ?? Math.round(performance.now() - started),
      languageForced: !!languageCode,
    };
  } catch (error: any) {
    if (signal.aborted) return { outcome: 'aborted' };
    return { outcome: 'error', errorText: error?.message || 'Test failed' };
  }
}

/** 'en' when the profile pins languages without English; auto-detect, Deepgram 'multi' and lists with English run as set. */
function _testLanguageOverride(profile: DASRxProfileAny): 'en' | undefined {
  const pinned = profile.language?.toLowerCase().split(/[,\s]+/).filter(Boolean) ?? [];
  return pinned.length && !pinned.some(code => code === 'multi' || code.startsWith('en')) ? 'en' : undefined;
}
