import * as React from 'react';

import { isBrowser, isChromeDesktop, isIPhoneUser } from '~/common/util/pwaUtils';

import { CapabilityBrowserSpeechRecognition } from './useCapabilities';
import { useUIPreferencesStore } from '../state/store-ui';


type DoneReason =
  undefined               // upon start: not done yet
  | 'manual'              // user clicked the stop button
  | 'continuous-deadline' // we hit our `softStopTimeout` while listening continuously
  | 'api-unknown-timeout' // a timeout has occurred
  | 'api-error'           // underlying .onerror
  | 'api-no-speech'       // underlying .onerror, user did not speak
  | 'react-unmount';      // the component is unmounting - the App shall never see this (set on unmount and not transmitted)

export interface SpeechResult {
  transcript: string;         // the portion of the transcript that is finalized (or all the transcript if done)
  interimTranscript: string;  // for the continuous (interim) listening, this is the current transcript
  done: boolean;              // true if the recognition is done - no more updates after this
  doneReason: DoneReason;     // the reason why the recognition is done
}

let cachedCapability: CapabilityBrowserSpeechRecognition | null = null;

export const browserSpeechRecognitionCapability = (): CapabilityBrowserSpeechRecognition => {
  if (!cachedCapability) {
    const isApiAvailable = !!getSpeechRecognition();
    const isDeviceNotSupported = false;
    cachedCapability = {
      mayWork: isApiAvailable && !isDeviceNotSupported,
      isApiAvailable,
      isDeviceNotSupported,
      warnings: isIPhoneUser ? ['Not tested on this browser/device.'] : [],
    };
  }
  return cachedCapability;
};


/**
 * We use a hook to default to 'false/null' and dynamically create the engine and update the UI.
 * @param onResultCallback - the callback to invoke when a result is received
 * @param softStopTimeout - FOR INTERIM LISTENING, on desktop: delay since the last word before sending the final result
 */
export const useSpeechRecognition = (onResultCallback: (result: SpeechResult) => void, softStopTimeout: number) => {

  // external state (will update this function when changed)
  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  // enablers
  const onResultCallbackRef = React.useRef(onResultCallback);
  const softStopTimeoutRef = React.useRef<number>(softStopTimeout);
  const speechControlsRef = React.useRef<SpeechRecoControls | null>(null);
  const preferredLanguageRef = React.useRef<string>(preferredLanguage);

  // session
  const refStarted = React.useRef<boolean>(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = React.useState<boolean>(false);
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [isRecordingAudio, setIsRecordingAudio] = React.useState<boolean>(false);
  const [isRecordingSpeech, setIsRecordingSpeech] = React.useState<boolean>(false);
  const [isSpeechError, setIsSpeechError] = React.useState<boolean>(false);


  // Sync refs with external state (callback, soft timeout, language)
  React.useEffect(() => {
    // update callback
    onResultCallbackRef.current = onResultCallback;

    // update soft stop timeout
    softStopTimeoutRef.current = softStopTimeout;

    // update language on the running instance (requires an instance method invocation)
    if (preferredLanguageRef.current !== preferredLanguage) {
      preferredLanguageRef.current = preferredLanguage;
      if (speechControlsRef.current)
        speechControlsRef.current.setLang(preferredLanguage);
    }
  }, [onResultCallback, softStopTimeout, preferredLanguage]);


  // create the Recognition engine
  React.useEffect(() => {
    if (!isBrowser) return;

    // do not re-initialize, just update the language (if we're here there's a high chance the language has changed)
    if (speechControlsRef.current) {
      console.warn('useSpeechRecognition: [dev-warn]: Speech recognition is already initialized.');
      return;
    }

    // skip speech recognition on iPhones and Safari browsers - because of sub-par quality
    if (browserSpeechRecognitionCapability().isDeviceNotSupported) {
      console.log('Speech recognition is disabled on this device.');
      return;
    }

    const webSpeechAPI = getSpeechRecognition();
    if (!webSpeechAPI)
      return;


    // create the SpeechRecognition instance
    const instance = new webSpeechAPI();
    instance.lang = preferredLanguageRef.current;
    instance.interimResults = isChromeDesktop && softStopTimeoutRef.current > 0;
    instance.maxAlternatives = 1;
    instance.continuous = true;

    // result within closure
    const speechResult: SpeechResult = {
      transcript: '',
      interimTranscript: '',
      done: false,
      doneReason: undefined,
    };

    let inactivityTimeoutId: any | null = null;

    const clearInactivityTimeout = () => {
      if (inactivityTimeoutId) {
        clearTimeout(inactivityTimeoutId);
        inactivityTimeoutId = null;
      }
    };

    const reloadInactivityTimeout = (timeoutMs: number, doneReason: DoneReason) => {
      clearInactivityTimeout();
      inactivityTimeoutId = setTimeout(() => {
        inactivityTimeoutId = null;
        speechResult.doneReason = doneReason;
        instance.stop();
      }, timeoutMs);
    };


    instance.onaudiostart = () => setIsRecordingAudio(true);

    instance.onaudioend = () => setIsRecordingAudio(false);

    instance.onspeechstart = () => setIsRecordingSpeech(true);

    instance.onspeechend = () => setIsRecordingSpeech(false);

    instance.onstart = () => {
      refStarted.current = true;
      setIsRecording(true);
      speechResult.transcript = '';
      speechResult.interimTranscript = 'Listening...';
      speechResult.done = false;
      speechResult.doneReason = undefined;
      onResultCallbackRef.current(speechResult);
      // let the system handle the first stop (as long as possible)
      // if (instance.interimResults)
      //   reloadInactivityTimeout(2 * softStopTimeoutRef.current);
    };

    instance.onend = () => {
      refStarted.current = false;
      setIsRecording(false);
      clearInactivityTimeout();
      speechResult.interimTranscript = '';
      speechResult.done = true;
      speechResult.doneReason = speechResult.doneReason ?? 'api-unknown-timeout';
      onResultCallbackRef.current(speechResult);
    };

    instance.onerror = event => {
      if (event.error === 'no-speech') {
        speechResult.doneReason = 'api-no-speech';
      } else {
        console.error('Error occurred during speech recognition:', event.error);
        setIsSpeechError(true);
        speechResult.doneReason = 'api-error';
      }
    };

    instance.onresult = (event: ISpeechRecognitionEvent) => {
      if (!event?.results?.length) return;

      // coalesce all the final pieces into a cohesive string
      speechResult.transcript = '';
      speechResult.interimTranscript = '';
      for (const result of event.results) {
        let chunk = result[0]?.transcript?.trim();
        if (!chunk)
          continue;

        // [EN] spoken punctuation marks -> actual characters
        chunk = chunk
          .replaceAll(' comma', ',')
          .replaceAll(' exclamation mark', '!')
          .replaceAll(' period', '.')
          .replaceAll(' question mark', '?');

        // capitalize
        if (chunk.length >= 2 && (result.isFinal || !speechResult.interimTranscript))
          chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);

        // add ending
        if (result.isFinal && !chunk.endsWith('.') && !chunk.endsWith('!') && !chunk.endsWith('?') && !chunk.endsWith(':') && !chunk.endsWith(';') && !chunk.endsWith(','))
          chunk += '.';

        if (result.isFinal)
          speechResult.transcript += chunk + ' ';
        else
          speechResult.interimTranscript += chunk + ' ';
      }

      // update the UI
      onResultCallbackRef.current(speechResult);

      // auto-stop
      if (instance.interimResults)
        reloadInactivityTimeout(softStopTimeoutRef.current, 'continuous-deadline');
    };


    // store the control interface
    speechControlsRef.current = {
      setLang: (lang: string) => instance.lang = lang,
      start: () => instance.start(),
      stop: (reason: DoneReason) => {
        speechResult.doneReason = reason;
        instance.stop();
      },
      unmount: () => {
        // Clear any inactivity timeout to prevent it from running after unmount
        clearInactivityTimeout();

        // Explicitly remove event listeners
        instance.onaudiostart = undefined;
        instance.onaudioend = undefined;
        instance.onspeechstart = undefined;
        instance.onspeechend = undefined;
        instance.onstart = undefined;
        instance.onend = undefined;
        instance.onerror = undefined;
        instance.onresult = undefined;

        // Stop the recognition if it's running
        if (refStarted.current) {
          speechResult.doneReason = 'react-unmount';
          instance.stop();
          refStarted.current = false;
        }
      },
    };

    refStarted.current = false;
    setIsSpeechEnabled(true);

    // Cleanup function to play well when the component unmounts
    return () => {
      if (speechControlsRef.current) {
        speechControlsRef.current.unmount();
        speechControlsRef.current = null;
      }
      setIsSpeechEnabled(false);
    };
  }, []);


  // ACTIONS: start/stop recording

  const startRecording = React.useCallback(() => {
    if (!speechControlsRef.current)
      return console.error('startRecording: Speech recognition is not supported or not initialized.');
    if (refStarted.current)
      return console.error('startRecording: Start recording called while already recording.');

    setIsSpeechError(false);
    try {
      speechControlsRef.current.start();
    } catch (error: any) {
      setIsSpeechError(true);
      console.log('Speech recognition error - clicking too quickly?', error?.message);
    }
  }, []);

  const stopRecording = React.useCallback(() => {
    if (!speechControlsRef.current)
      return console.error('stopRecording: Speech recognition is not supported or not initialized.');
    if (!refStarted.current)
      return console.error('stopRecording: Stop recording called while not recording.');

    speechControlsRef.current.stop('manual');
  }, []);

  const toggleRecording = React.useCallback(() => {
    if (refStarted.current || isSpeechError) {
      stopRecording();
      setIsSpeechError(false);
    } else
      startRecording();
  }, [isSpeechError, startRecording, stopRecording]);


  return {
    isRecording,
    isRecordingAudio,
    isRecordingSpeech,
    isSpeechEnabled,
    isSpeechError,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};


function getSpeechRecognition(): ISpeechRecognition | null {
  if (isBrowser) {
    // noinspection JSUnresolvedReference
    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition
    ) ?? null;
  }
  return null;
}

interface ISpeechRecognition extends EventTarget {
  new(): ISpeechRecognition;

  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start: () => void;
  stop: () => void;
  // abort: () => void;

  onaudiostart?: (event: any) => void;
  // onsoundstart?: (event: any) => void;
  onspeechstart?: (event: any) => void;
  onspeechend?: (event: any) => void;
  // onsoundend?: (event: any) => void;
  onaudioend?: (event: any) => void;
  onresult?: (event: ISpeechRecognitionEvent) => void;
  // onnomatch?: (event: any) => void;
  onerror?: (event: any) => void;
  onstart?: (event: any) => void;
  onend?: (event: any) => void;
}

interface ISpeechRecognitionEvent extends Event {
  // readonly resultIndex: number;
  readonly results: SpeechRecognitionResult[];
}

interface SpeechRecoControls {
  setLang: (lang: string) => void;
  start: () => void;
  stop: (reason: DoneReason) => void;
  unmount: () => void;
}