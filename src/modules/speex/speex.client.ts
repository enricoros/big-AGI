/**
 * Speex - Speech Synthesis Module
 *
 * Centralized speech synthesis with provider abstraction.
 * Supports multiple TTS engines: ElevenLabs, OpenAI, LocalAI, Web Speech.
 *
 * Future: NorthBridge integration for single-place queuing across TTS(s) and ASR.
 */

import { AudioAutoPlayer } from '~/common/util/audio/AudioAutoPlayer';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import type { DSpeexEngineAny, SpeexSpeakTextOptions, SpeexSpeakTextResult, SpeexSynthesizeOptions, SpeexSynthesizeResult, SpeexVoiceSelector } from './speex.types';
import { speexFindEngineById, speexFindGlobalEngine, speexFindValidEngineByType } from './store-module-speex';
import { speex_splitTextIntoChunks, speex_textApplyCharLimit, speex_textCleanupUnspoken } from './speex.processing';

import { SPEEX_DEBUG } from './speex.config';
import { speexSynthesize_RPC } from './protocols/rpc/rpc.client';
import { speexSynthesize_WebSpeech, speexSynthesize_WebSpeechStop } from './protocols/webspeech/webspeech.client';


interface _ChunkedCallbacks {
  onChunkStart?: (progress: _ChunkedProgress) => void;
  onChunkEnd?: (progress: _ChunkedProgress) => void;
  onChunkError?: (error: Error, progress: _ChunkedProgress) => void;
  onComplete?: (aborted: boolean) => void;
}

interface _ChunkedProgress {
  chunkIndex: number;      // current chunk (0-based)
  totalChunks: number;     // total chunks
  currentChunkStart: string; // first ~100 chars of current chunk (for display)
}


/**
 * Speaks text with automatic chunking, preprocessing, and abort support.
 * Synthesizes and plays each chunk sequentially, waiting for playback to complete before the next.
 * Breaks on error to avoid wasting API credits on repeated failures.
 */
export async function speakText(
  inputText: string,
  voiceSelector: SpeexVoiceSelector,
  options?: SpeexSpeakTextOptions & SpeexSynthesizeOptions,
  signal?: AbortSignal,
  chunkedCallbacks?: _ChunkedCallbacks,
): Promise<SpeexSpeakTextResult> {

  // preprocess text unless disabled
  if (!options?.disableUnspeakable)
    inputText = speex_textCleanupUnspoken(inputText);
  if (!options?.disableCharLimit)
    inputText = speex_textApplyCharLimit(inputText);

  // chunk text unless disabled
  const chunks = options?.maxChunkLength === false || options?.maxChunkLength === 0 ? [inputText]
    : speex_splitTextIntoChunks(inputText, options?.maxChunkLength /* 500 if missing */);
  if (!chunks.length) {
    chunkedCallbacks?.onComplete?.(false);
    return { success: true, aborted: false, chunksSpoken: 0, totalChunks: 0 };
  }

  let chunksSpoken = 0;
  let currentHandle: _SpeexSpeakHandle | null = null;
  let firstError: { errorType: SpeexSpeakTextResult['errorType'], errorText: string } | undefined;

  // wire up abort to stop current playback
  const onAbort = () => currentHandle?.stop();
  signal?.addEventListener('abort', onAbort);

  try {
    for (let i = 0; i < chunks.length && !signal?.aborted; i++) {
      const chunkText = chunks[i];
      const progress: _ChunkedProgress = {
        chunkIndex: i,
        totalChunks: chunks.length,
        currentChunkStart: chunkText.slice(0, 100),
      };
      chunkedCallbacks?.onChunkStart?.(progress);

      currentHandle = speakRawText_withHandle(chunkText, voiceSelector, options);

      // wait for both playback and synthesis to complete
      const [playbackCompleted, synthesisResult] = await Promise.all([
        currentHandle.playbackComplete, // for a boolean
        currentHandle.synthesisComplete, // for the SpeexSpeakResult
      ]);

      currentHandle = null;

      // check for synthesis errors - break to avoid wasting credits on repeated failures
      if (!synthesisResult.success) {
        firstError = firstError || {
          errorType: synthesisResult.errorType,
          errorText: synthesisResult.errorText,
        };
        chunkedCallbacks?.onChunkError?.(new Error(synthesisResult.errorText), progress);
        break;
      }

      // check if stopped or aborted
      if (!playbackCompleted || signal?.aborted)
        break;

      chunksSpoken++;
      chunkedCallbacks?.onChunkEnd?.(progress);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  const aborted = signal?.aborted ?? false;
  chunkedCallbacks?.onComplete?.(aborted);

  return {
    success: !firstError && !aborted && chunksSpoken === chunks.length,
    aborted,
    chunksSpoken,
    totalChunks: chunks.length,
    ...firstError,
  };
}


/**
 * Handle returned by speakTextWithHandle() for controlled playback.
 * Allows waiting for playback completion and stopping mid-playback.
 */
interface _SpeexSpeakHandle {
  readonly synthesisComplete: Promise<SpeexSynthesizeResult>;
  readonly playbackComplete: Promise<boolean>;

  /** Stops both synthesis and playback immediately */
  stop(): void;
}

/**
 * Speak text with a handle for controlled playback.
 *
 * Returns a _SpeexSpeakHandle that allows:
 * - Awaiting synthesis completion (synthesisComplete)
 * - Awaiting playback completion (playbackComplete)
 * - Stopping both synthesis and playback mid-stream (stop())
 *
 * @example
 * ```typescript
 * // Fire and forget (ignores handle)
 * speakTextWithHandle('Hello world');
 *
 * // Wait for playback to complete
 * const handle = speakTextWithHandle('Hello world');
 * await handle.playbackComplete;
 *
 * // Stop early
 * const handle = speakTextWithHandle('Long text...');
 * handle.stop();
 * ```
 */
export function speakRawText_withHandle(
  rawText: string, // this won't be processed - use speakText for chunking, cleanup, etc.
  voiceSelector: SpeexVoiceSelector,
  rpcOptions?: SpeexSynthesizeOptions,
): _SpeexSpeakHandle {

  // resolve engine from voice selector
  const engine = _engineFromSelector(voiceSelector);
  if (!engine)
    return {
      synthesisComplete: Promise.resolve({ success: false, errorType: 'tts-no-engine', errorText: 'No TTS engine configured. Please configure a TTS engine in Settings.' } satisfies SpeexSynthesizeResult),
      playbackComplete: Promise.resolve(false), // no engine = not completed
      stop: () => {
      },
    };

  // apply voice override from selector (merge with engine defaults)
  const effectiveEngine = _engineApplyVoiceOverride(engine, voiceSelector);
  if (SPEEX_DEBUG) console.log(`[Speex] speakRawText: Using effective engine ${effectiveEngine.engineId} (vendor: ${effectiveEngine.vendorType})`, { length: rawText.length, voiceSelector });

  const {
    rpcDisableStreaming = false,
    disablePlayback = false,
    disableLivePlayback = false,
    rpcReturnAudio = false,
    languageCode = _getUIPreferenceLanguageCode(),
    priority,
  } = rpcOptions || {};


  let isStopped = false;

  switch (effectiveEngine.vendorType) {
    // RPC providers: route through speex.router RPC
    case 'elevenlabs':
    case 'inworld':
    case 'openai':
    case 'localai': {

      const abortController = new AbortController();
      let audioPlayer: AudioAutoPlayer | undefined;
      const createAudioPlayer = disablePlayback ? undefined
        : () => audioPlayer = new AudioAutoPlayer(disableLivePlayback);

      // deferred resolver for the promise (so stop and the end don't race with awaiting the promise)
      let playbackCompleteResolve: (completed: boolean) => void;
      const playbackComplete = new Promise<boolean>(resolve => playbackCompleteResolve = resolve);

      const synthesisComplete = speexSynthesize_RPC(
        effectiveEngine,
        rawText,
        { dataStreaming: !rpcDisableStreaming, languageCode, returnAudioBuffer: rpcReturnAudio, priority },
        abortController,
        createAudioPlayer,
      ).then(async (result) => {

        // wait for playback to complete (unless stopped already)
        if (!isStopped && audioPlayer)
          await audioPlayer.waitForPlaybackEnd();

        // resolves the playback completion promise
        playbackCompleteResolve(!isStopped);

        // return synthesis result for the synthesis completion promise
        return result;

      }).catch((error) => {
        // ensure playbackComplete resolves even on unexpected errors
        playbackCompleteResolve(false);
        return { success: false, errorType: 'tts-exception', errorText: error?.message || 'Unexpected synthesis error' } satisfies SpeexSynthesizeResult;
      });

      // _SpeexSpeakHandle
      return {
        synthesisComplete,
        playbackComplete, // resolves just a tad earlier than synthesisComplete
        stop: () => {
          isStopped = true;
          abortController.abort();
          audioPlayer?.stop();
          playbackCompleteResolve(false);
        },
      };
    }

    // Web Speech: client-only, no RPC
    case 'webspeech': {

      // if we disable playback, we have nothing to do here, really, as Web Speech API is playback-centric
      if (disablePlayback) {
        return {
          synthesisComplete: Promise.resolve({ success: false, errorType: 'tts-playback-disabled', errorText: 'Playback is disabled for Web Speech synthesis.' } satisfies SpeexSynthesizeResult),
          playbackComplete: Promise.resolve(false), // playback disabled = not completed
          stop: () => {
            // no-op
          },
        };
      }

      const synthesisComplete = speexSynthesize_WebSpeech(rawText, effectiveEngine.voice);
      // playbackComplete: true if finished normally, false if stopped or error
      const playbackComplete = synthesisComplete.then(() => !isStopped).catch(() => false);

      // _SpeexSpeakHandle
      return {
        synthesisComplete,
        playbackComplete,
        stop: () => {
          isStopped = true;
          speexSynthesize_WebSpeechStop();
        },
      };
    }
  }
}


// -- Private helpers --

function _engineFromSelector(selector: SpeexVoiceSelector): DSpeexEngineAny | null {
  if (selector) {
    // A. most specific selector: engineId
    if ('engineId' in selector && selector.engineId) {
      const engine = speexFindEngineById(selector.engineId, false /* force through */);
      if (engine) return engine;
    }

    // B. voice.dialect - find first matching engine that's probably valid
    if ('voice' in selector && selector.voice?.dialect) {
      const engine = speexFindValidEngineByType(selector.voice.dialect);
      if (engine) return engine;
    }
  }

  // C. fall back to global engine (active or priority-ranked)
  return speexFindGlobalEngine();
}

function _engineApplyVoiceOverride(engine: DSpeexEngineAny, selector: SpeexVoiceSelector): DSpeexEngineAny {
  // No voice override in selector - use engine's default voice
  if (!selector || !('voice' in selector) || !selector.voice)
    return engine;

  // IMPORTANT: Don't apply voice override if dialects don't match - this prevents
  // "Voice dialect mismatch" errors when e.g. an ElevenLabs persona voice falls back
  // to an OpenAI engine because ElevenLabs isn't configured
  if (selector.voice.dialect && selector.voice.dialect !== engine.vendorType)
    return engine;

  // Apply voice override
  return {
    ...engine,
    voice: { ...engine.voice, ...selector.voice },
  } as DSpeexEngineAny;
}

// extract base language code (e.g., 'en-US' -> 'en', 'fr' -> 'fr')
function _getUIPreferenceLanguageCode(): string | undefined {
  const { preferredLanguage } = useUIPreferencesStore.getState();
  return preferredLanguage?.split('-')[0]?.toLowerCase() || undefined;
}
