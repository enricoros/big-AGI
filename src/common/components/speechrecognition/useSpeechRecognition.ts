import * as React from 'react';

import { Is, isBrowser } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { CapabilityBrowserSpeechRecognition } from '../useCapabilities';

import { AudioRecorderEngine } from './AudioRecorderEngine';
import { getSpeechRecognitionClass, WebSpeechApiEngine } from './WebSpeechApiEngine';

// configuration
export const PLACEHOLDER_INTERIM_TRANSCRIPT = 'Listening...';


/// Capability interface

let cachedCapability: CapabilityBrowserSpeechRecognition | null = null;

export const browserSpeechRecognitionCapability = (): CapabilityBrowserSpeechRecognition => {
  if (!cachedCapability) {
    const isApiAvailable = !!getSpeechRecognitionClass();
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
  transcript: string;             // the portion of the transcript that is finalized (or all the transcript if done)
  interimTranscript: string;      // for the continuous (interim) listening, this is the current transcript
  done: boolean;                  // true if the recognition is done - no more updates after this
  doneReason: SpeechDoneReason;   // the reason why the recognition is done
  flagSendOnDone: boolean | undefined; // user flags set on 'startRecognition' - passive
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
  | undefined             // upon start: not done yet
  | 'manual'              // user clicked the stop button
  | 'continuous-deadline' // we hit our `softStopTimeout` while listening continuously
  | 'api-unknown-timeout' // a timeout has occurred
  | 'api-error'           // underlying .onerror
  | 'api-no-speech'       // underlying .onerror, user did not speak
  | 'switch-engine'       // the engine is switching
  | 'react-unmount';      // the component is unmounting - the App shall never see this (set on unmount and not transmitted)


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
 * @param onResultCallback - Callback when a result is received
 * @param softStopTimeout - Timeout for continuous listening
 * @param engineType - The type of capture engine to use
 */
export const useSpeechRecognition = (
  engineType: RecognitionEngineType,
  onResultCallback: SpeechResultCallback,
  softStopTimeout: number,
) => {

  // state
  const [recognitionState, setRecognitionState] = React.useState<SpeechRecognitionState>({
    isAvailable: false,
    isActive: false,
    hasAudio: false,
    hasSpeech: false,
    errorMessage: null,
    currentEngine: engineType,
  });

  // external state (will update this function when changed)
  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  // refs
  const onResultCallbackRef = React.useRef<SpeechResultCallback>(onResultCallback);
  const softStopTimeoutRef = React.useRef<number>(softStopTimeout);
  const preferredLanguageRef = React.useRef<string>(preferredLanguage);
  const engineRef = React.useRef<IRecognitionEngine | null>(null);


  // hooks

  const updateState = React.useCallback((state: Partial<SpeechRecognitionState>) => {
    setRecognitionState((prevState) => ({ ...prevState, ...state }));
  }, []);

  // Params: update refs when params change
  React.useEffect(() => {
    // detect changes
    if (onResultCallbackRef.current === onResultCallback
      && preferredLanguageRef.current === preferredLanguage
      && softStopTimeoutRef.current === softStopTimeout)
      return;

    // remember local values
    onResultCallbackRef.current = onResultCallback;
    softStopTimeoutRef.current = softStopTimeout;
    preferredLanguageRef.current = preferredLanguage;

    // update the values in the running instance
    engineRef.current?.updateConfiguration(preferredLanguage, softStopTimeout, onResultCallback);
  }, [onResultCallback, preferredLanguage, softStopTimeout]);

  // Recreate the engine if the type changes (and upon load, and destroy it on unmount)
  React.useEffect(() => {
    if (!isBrowser) return;

    // prevent re-creating the engine if it's the same type, and multiple instances
    if (engineRef.current?.engineType === engineType)
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
      currentEngine: engineType,
    });

    switch (engineType) {
      case 'webSpeechApi':

        // check if the device is supported
        // if (browserSpeechRecognitionCapability().isDeviceNotSupported) {
        //   setErrorMessage('Speech recognition is not supported on this device.');
        //   return;
        // }

        // check if the API is available
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
    if (!engineRef.current) return console.error('startRecognition: Speech recognition is not supported or not initialized.');
    if (engineRef.current.isBetweenBeginEnd()) return console.error('startRecognition: Start recording called while already recording.');

    try {
      updateState({ errorMessage: null });
      engineRef.current.start();
    } catch (error: any) {
      updateState({ errorMessage: 'Issue starting the speech recognition.' });
      console.log('Speech recognition error - clicking too quickly?', error?.message);
    }
  }, [updateState]);

  const stopRecognition = React.useCallback((sendOnDone: boolean) => {
    if (!engineRef.current) return console.error('stopRecognition: Speech recognition is not supported or not initialized.');
    if (!engineRef.current.isBetweenBeginEnd()) return console.error('stopRecognition: Stop recognition called while not recognizing.');
    engineRef.current.stop('manual', sendOnDone);
  }, []);

  const hasError = !!recognitionState.errorMessage;

  const toggleRecognition = React.useCallback((sendOnDone?: boolean) => {
    if (!engineRef.current) return;

    // start or stop
    if (hasError || engineRef.current?.isBetweenBeginEnd()) {
      stopRecognition(sendOnDone === true);
      updateState({ errorMessage: null });
    } else
      startRecognition();
  }, [hasError, startRecognition, stopRecognition, updateState]);


  return {
    recognitionState,
    startRecognition,
    stopRecognition,
    toggleRecognition,
  };
};
