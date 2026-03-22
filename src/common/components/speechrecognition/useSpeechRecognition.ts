import * as React from 'react';

import { Is, isBrowser } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { CapabilityBrowserSpeechRecognition } from '../useCapabilities';

import { AudioRecorderEngine } from './AudioRecorderEngine';
import { getSpeechRecognitionClass, WebSpeechApiEngine } from './WebSpeechApiEngine';

// configuration
export const PLACEHOLDER_INTERIM_TRANSCRIPT = 'Listening...';

// ────────────────────────────────────────────────────────────────────────────
// When true, ALL speech recognition is routed through the server-side
// transcription endpoint (AudioRecorderEngine → /api/stt/transcribe)
// instead of the browser's Web Speech API.
//
// Set to false to restore the original Web Speech API behaviour.
// ────────────────────────────────────────────────────────────────────────────
const FORCE_SERVER_STT = true;

function resolveEngineType(requested: RecognitionEngineType): RecognitionEngineType {
  if (FORCE_SERVER_STT && requested === 'webSpeechApi')
    return 'audioRecorder';
  return requested;
}

function hasMediaRecorderSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}


/// Capability interface

let cachedCapability: CapabilityBrowserSpeechRecognition | null = null;

export const browserSpeechRecognitionCapability = (): CapabilityBrowserSpeechRecognition => {
  if (!cachedCapability) {
    const isApiAvailable = FORCE_SERVER_STT
      ? hasMediaRecorderSupport()
      : !!getSpeechRecognitionClass();

    const isDeviceNotSupported = false;

    cachedCapability = {
      mayWork: isApiAvailable && !isDeviceNotSupported,
      isApiAvailable,
      isDeviceNotSupported,
      warnings: Is.OS.iOS ? ['Not tested on this browser/device.'] : [],
    };
  }
  return cachedCapability;
};


// Interfaces used by Engines

type RecognitionEngineType = 'webSpeechApi' | 'audioRecorder';

export interface IRecognitionEngine {
  engineType: RecognitionEngineType;
  start: () => void;
  stop: (reason: SpeechDoneReason, sendOnDone: boolean) => void;
  dispose: () => void;
  isBetweenBeginEnd: () => boolean;
  updateConfiguration: (language: string, softStopTimeout: number, onResultCallback: SpeechResultCallback) => void;
}

export interface SpeechResult {
  transcript: string;
  interimTranscript: string;
  done: boolean;
  doneReason: SpeechDoneReason;
  flagSendOnDone: boolean | undefined;
}

export function createSpeechRecognitionResults(): SpeechResult {
  return {
    transcript: '',
    interimTranscript: PLACEHOLDER_INTERIM_TRANSCRIPT,
    done: false,
    doneReason: undefined,
    flagSendOnDone: undefined,
  };
}

export type SpeechDoneReason =
  | undefined
  | 'manual'
  | 'continuous-deadline'
  | 'api-unknown-timeout'
  | 'api-error'
  | 'api-no-speech'
  | 'switch-engine'
  | 'react-unmount';

export interface SpeechRecognitionState {
  isAvailable: boolean;
  isActive: boolean;
  hasAudio: boolean;
  hasSpeech: boolean;
  errorMessage: string | null;
  currentEngine: RecognitionEngineType;
}

type SpeechResultCallback = (result: SpeechResult) => void;


/**
 * Hook for speech recognition that supports switching between engines.
 */
export const useSpeechRecognition = (
  engineType: RecognitionEngineType,
  onResultCallback: SpeechResultCallback,
  softStopTimeout: number,
) => {

  const resolvedInitial = resolveEngineType(engineType);

  // state
  const [recognitionState, setRecognitionState] = React.useState<SpeechRecognitionState>({
    isAvailable: false,
    isActive: false,
    hasAudio: false,
    hasSpeech: false,
    errorMessage: null,
    currentEngine: resolvedInitial,
  });

  // external state
  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  // refs
  const onResultCallbackRef = React.useRef<SpeechResultCallback>(onResultCallback);
  const softStopTimeoutRef = React.useRef<number>(softStopTimeout);
  const preferredLanguageRef = React.useRef<string>(preferredLanguage);
  const engineRef = React.useRef<IRecognitionEngine | null>(null);

  const updateState = React.useCallback((state: Partial<SpeechRecognitionState>) => {
    setRecognitionState((prev) => ({ ...prev, ...state }));
  }, []);

  React.useEffect(() => {
    if (
      onResultCallbackRef.current === onResultCallback &&
      preferredLanguageRef.current === preferredLanguage &&
      softStopTimeoutRef.current === softStopTimeout
    )
      return;

    onResultCallbackRef.current = onResultCallback;
    softStopTimeoutRef.current = softStopTimeout;
    preferredLanguageRef.current = preferredLanguage;

    engineRef.current?.updateConfiguration(preferredLanguage, softStopTimeout, onResultCallback);
  }, [onResultCallback, preferredLanguage, softStopTimeout]);

  React.useEffect(() => {
    if (!isBrowser) return;

    const resolved = resolveEngineType(engineType);

    if (engineRef.current?.engineType === resolved)
      return;

    if (engineRef.current) {
      engineRef.current.stop('switch-engine', false);
      engineRef.current = null;
    }

    updateState({
      isAvailable: false,
      isActive: false,
      hasAudio: false,
      hasSpeech: false,
      errorMessage: null,
      currentEngine: resolved,
    });

    switch (resolved) {
      case 'webSpeechApi': {
        const webSpeechAPI = getSpeechRecognitionClass();
        if (!webSpeechAPI) {
          updateState({ errorMessage: 'Speech recognition API is not available in this browser.' });
          return;
        }
        engineRef.current = new WebSpeechApiEngine(
          webSpeechAPI,
          preferredLanguageRef.current,
          softStopTimeoutRef.current,
          onResultCallbackRef.current,
          updateState,
        );
        break;
      }

      case 'audioRecorder':
        engineRef.current = new AudioRecorderEngine(
          preferredLanguageRef.current,
          softStopTimeoutRef.current,
          onResultCallbackRef.current,
          updateState,
        );
        break;
    }

    return () => {
      if (engineRef.current) {
        updateState({ isAvailable: false });
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [engineType, updateState]);

  const startRecognition = React.useCallback(() => {
    if (!engineRef.current)
      return console.error('startRecognition: Speech recognition is not supported or not initialized.');
    if (engineRef.current.isBetweenBeginEnd())
      return console.error('startRecognition: Start recording called while already recording.');

    try {
      updateState({ errorMessage: null });
      engineRef.current.start();
    } catch (error: any) {
      updateState({ errorMessage: 'Issue starting the speech recognition.' });
      console.log('Speech recognition error - clicking too quickly?', error?.message);
    }
  }, [updateState]);

  const stopRecognition = React.useCallback((sendOnDone: boolean) => {
    if (!engineRef.current)
      return console.error('stopRecognition: Speech recognition is not supported or not initialized.');
    if (!engineRef.current.isBetweenBeginEnd())
      return console.error('stopRecognition: Stop recognition called while not recognizing.');
    engineRef.current.stop('manual', sendOnDone);
  }, []);

  const hasError = !!recognitionState.errorMessage;

  const toggleRecognition = React.useCallback((sendOnDone?: boolean) => {
    if (!engineRef.current) return;

    if (hasError || engineRef.current.isBetweenBeginEnd()) {
      stopRecognition(sendOnDone === true);
      updateState({ errorMessage: null });
    } else {
      startRecognition();
    }
  }, [hasError, startRecognition, stopRecognition, updateState]);

  return {
    recognitionState,
    startRecognition,
    stopRecognition,
    toggleRecognition,
  };
};
