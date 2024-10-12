import * as React from 'react';

import { Is, isBrowser } from '~/common/util/pwaUtils';

import { CapabilityBrowserSpeechRecognition } from './useCapabilities';
import { useUIPreferencesStore } from '../state/store-ui';


// configuration
export const PLACEHOLDER_INTERIM_TRANSCRIPT = 'Listening...';


/// Capability interface

let cachedCapability: CapabilityBrowserSpeechRecognition | null = null;

export const browserSpeechRecognitionCapability = (): CapabilityBrowserSpeechRecognition => {
  if (!cachedCapability) {
    const isApiAvailable = !!_getSpeechRecognition();
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


/// Hook

type SpeechResultCallback = (result: SpeechResult) => void;

export interface SpeechResult {
  transcript: string;         // the portion of the transcript that is finalized (or all the transcript if done)
  interimTranscript: string;  // for the continuous (interim) listening, this is the current transcript
  done: boolean;              // true if the recognition is done - no more updates after this
  doneReason: DoneReason;     // the reason why the recognition is done
  flagSendOnDone?: boolean;   // user flags set on 'startRecognition' - passive
}

type DoneReason =
  | undefined             // upon start: not done yet
  | 'manual'              // user clicked the stop button
  | 'continuous-deadline' // we hit our `softStopTimeout` while listening continuously
  | 'api-unknown-timeout' // a timeout has occurred
  | 'api-error'           // underlying .onerror
  | 'api-no-speech'       // underlying .onerror, user did not speak
  | 'react-unmount';      // the component is unmounting - the App shall never see this (set on unmount and not transmitted)


function _chunkExpressionReplaceEN(fullText: string) {
  return fullText
    .replaceAll(/\.?\scomma\b/gi, ',')
    .replaceAll(/\.?\speriod\b/gi, '.')
    .replaceAll(/\.?\squestion mark\b/gi, '?')
    .replaceAll(/\.?\sexclamation mark\b/gi, '!');
}


/**
 * We use a hook to default to 'false/null' and dynamically create the engine and update the UI.
 * @param onResultCallback - the callback to invoke when a result is received
 * @param softStopTimeout - FOR INTERIM LISTENING, on desktop: delay since the last word before sending the final result
 */
export const useSpeechRecognition = (onResultCallback: SpeechResultCallback, softStopTimeout: number) => {

  // external state (will update this function when changed)
  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  // state (re-renders)
  const [isAvailable, setIsAvailable] = React.useState<boolean>(false);
  const [isActive, setIsActive] = React.useState<boolean>(false);
  const [hasAudio, setHasAudio] = React.useState<boolean>(false);
  const [hasSpeech, setHasSpeech] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Values that won't trigger re-renders
  const apiControlProxyRef = React.useRef<{
    updateLanguage: (lang: string) => void;
    startApi: () => void;
    stopApi: (reason: DoneReason, flagSendOnDone?: boolean) => void;
  } | null>(null);
  const withinBeginEndRef = React.useRef<boolean>(false);
  // const recordingDonePromiseResolveRef = React.useRef<((value: SpeechResult | PromiseLike<SpeechResult>) => void) | null>(null);

  // Params: use refs to store the latest values
  const onResultCallbackRef = React.useRef<SpeechResultCallback>(onResultCallback);
  const softStopTimeoutRef = React.useRef<number>(softStopTimeout);
  const preferredLanguageRef = React.useRef<string>(preferredLanguage);

  // Params: update refs when params change
  React.useEffect(() => {
    // update callback
    onResultCallbackRef.current = onResultCallback;

    // update soft stop timeout
    softStopTimeoutRef.current = softStopTimeout;

    // update language on the running instance (requires an instance method invocation)
    if (preferredLanguageRef.current !== preferredLanguage) {
      preferredLanguageRef.current = preferredLanguage;
      if (apiControlProxyRef.current)
        apiControlProxyRef.current.updateLanguage(preferredLanguage);
    }
  }, [onResultCallback, softStopTimeout, preferredLanguage]);


  // At mount (no dependencies): create the engine
  React.useEffect(() => {
    if (!isBrowser) return;

    // prevent multiple instances
    if (apiControlProxyRef.current) {
      console.warn('Speech recognition engine is already initialized.');
      return;
    }

    // check if the device is supported
    if (browserSpeechRecognitionCapability().isDeviceNotSupported) {
      setErrorMessage('Speech recognition is not supported on this device.');
      return;
    }

    // check if the API is available
    const webSpeechAPI = _getSpeechRecognition();
    if (!webSpeechAPI) {
      setErrorMessage('Speech recognition API is not available in this browser.');
      return;
    }
    setErrorMessage(null);


    // create the SpeechRecognition instance
    const _api = new webSpeechAPI();

    // configure the instance
    _api.lang = preferredLanguageRef.current;
    _api.interimResults =
      Is.Desktop // verified on Chrome desktop, and Safari desktop
      && softStopTimeoutRef.current > 0; // only if we perform the stopping on the client side
    _api.maxAlternatives = 1;
    _api.continuous = true;


    // closure: results
    const speechResult: SpeechResult = {
      transcript: '',
      interimTranscript: '',
      done: false,
      doneReason: undefined,
      flagSendOnDone: undefined,
    };

    // closure: inactivity timeout management
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
        _api.stop();
      }, timeoutMs);
    };


    _api.onaudiostart = () => setHasAudio(true);
    _api.onaudioend = () => setHasAudio(false);

    _api.onspeechstart = () => setHasSpeech(true);
    _api.onspeechend = () => setHasSpeech(false);

    _api.onstart = () => {
      withinBeginEndRef.current = true; // instant
      setIsActive(true); // delayed

      speechResult.transcript = '';
      speechResult.interimTranscript = PLACEHOLDER_INTERIM_TRANSCRIPT;
      speechResult.done = false;
      speechResult.doneReason = undefined;
      onResultCallbackRef.current(speechResult);

      // let the system handle the first stop (as long as possible)
      // if (instance.interimResults)
      //   reloadInactivityTimeout(2 * softStopTimeoutRef.current);
    };
    _api.onend = () => {
      clearInactivityTimeout();

      withinBeginEndRef.current = false; // instant
      setIsActive(false); // delayed

      speechResult.interimTranscript = '';
      speechResult.done = true;
      speechResult.doneReason = speechResult.doneReason ?? 'api-unknown-timeout';
      onResultCallbackRef.current(speechResult);

      // Resolve the promise when recording ends
      // recordingDonePromiseResolveRef.current?.(speechResult);
      // recordingDonePromiseResolveRef.current = null;
    };

    _api.onerror = (event: any) => {
      switch (event.error) {
        case 'no-speech':
          speechResult.doneReason = 'api-no-speech';
          return;

        case 'aborted':
          // the user clicked the stop button, so nothing to really do as the manual done reason is already set
          // speechResult.doneReason = 'manual';
          return;

        case 'not-allowed':
          setErrorMessage('Microphone access blocked by the user. Enable it in your browser settings to use speech recognition.');
          break;

        case 'service-not-allowed':
          setErrorMessage('Speech Recognition permission denied. Check your System Settings.');
          break;

        case 'audio-capture':
          setErrorMessage(`Audio capture failed (${event.message}). Please try again.`);
          break;

        case 'network':
          setErrorMessage('Network communication required to complete the service, but failed.');
          break;

        default:
          console.error('Speech recognition error:', event.error, event.message);
          setErrorMessage(`Browser speech recognition issue ${event.error}: ${event.message}`);
          break;
      }
      speechResult.doneReason = 'api-error';
    };
    _api.onresult = (event: ISpeechRecognitionEvent) => {
      if (!event?.results?.length) return;

      // coalesce all the final pieces into a cohesive string
      speechResult.transcript = '';
      speechResult.interimTranscript = '';
      for (const result of event.results) {
        let chunk = result[0]?.transcript?.trim();
        if (!chunk)
          continue;

        // capitalize
        if (chunk.length >= 2 && (result.isFinal || !speechResult.interimTranscript))
          chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);

        // add ending
        if (result.isFinal && !chunk.endsWith('.') && !chunk.endsWith('!') && !chunk.endsWith('?') && !chunk.endsWith(':') && !chunk.endsWith(';') && !chunk.endsWith(','))
          chunk += '.';

        if (result.isFinal)
          speechResult.transcript = _chunkExpressionReplaceEN(speechResult.transcript + chunk + ' ');
        else
          speechResult.interimTranscript = _chunkExpressionReplaceEN(speechResult.interimTranscript + chunk + ' ');
      }
      onResultCallbackRef.current(speechResult);

      // move the timeout deadline, if in continuous (manually stopped) mode
      if (_api.interimResults)
        reloadInactivityTimeout(softStopTimeoutRef.current, 'continuous-deadline');
    };


    // store the control interface
    apiControlProxyRef.current = {
      updateLanguage: (lang: string) => _api.lang = lang,
      startApi: () => {
        speechResult.flagSendOnDone = undefined;
        _api.start();
      },
      stopApi: (reason: DoneReason, flagSendOnDone?: boolean) => {
        speechResult.doneReason = reason;
        speechResult.flagSendOnDone = flagSendOnDone;
        _api.stop();
      },
    };

    withinBeginEndRef.current = false;
    setIsAvailable(true);

    // Cleanup function to play well when the component unmounts
    return () => {
      setIsAvailable(false);

      // Clear any inactivity timeout to prevent it from running after unmount
      clearInactivityTimeout();

      // Explicitly remove event listeners
      _api.onaudiostart = undefined;
      _api.onaudioend = undefined;
      _api.onspeechstart = undefined;
      _api.onspeechend = undefined;
      _api.onstart = undefined;
      _api.onend = undefined;
      _api.onerror = undefined;
      _api.onresult = undefined;

      // Stop the recognition if it's running
      if (withinBeginEndRef.current) {
        withinBeginEndRef.current = false;
        speechResult.doneReason = 'react-unmount';
        _api.stop();
      }

      // Clear the control interface (used at the onset of the hook to detect double invocation)
      apiControlProxyRef.current = null;
    };
  }, []);


  // ACTIONS: start/stop recording

  const startRecognition = React.useCallback(() => {
    if (!apiControlProxyRef.current)
      return console.error('startRecognition: Speech recognition is not supported or not initialized.');
    if (withinBeginEndRef.current)
      return console.error('startRecognition: Start recording called while already recording.');

    try {
      setErrorMessage(null);
      apiControlProxyRef.current.startApi();
    } catch (error: any) {
      setErrorMessage('Issue starting the speech recognition.');
      console.log('Speech recognition error - clicking too quickly?', error?.message);
    }
  }, []);

  const stopRecognition = React.useCallback((flagSendOnDone?: boolean) => {
    if (!apiControlProxyRef.current)
      return console.error('stopRecording: Speech recognition is not supported or not initialized.');
    if (!withinBeginEndRef.current)
      return console.error('stopRecording: Stop recording called while not recording.');

    apiControlProxyRef.current.stopApi('manual', flagSendOnDone);
  }, []);

  const isError = !!errorMessage;
  const toggleRecognition = React.useCallback((flagSendOnDone?: boolean) => {
    if (withinBeginEndRef.current || isError) {
      stopRecognition(flagSendOnDone);
      setErrorMessage(null);
    } else {
      startRecognition();
    }
    // recordingDonePromiseResolveRef.current = resolve;
  }, [isError, startRecognition, stopRecognition]);


  return {
    recognitionState: {
      isAvailable,
      isActive,
      hasAudio,
      hasSpeech,
      errorMessage,
    },
    startRecognition,
    stopRecognition,
    toggleRecognition,
  };
};


function _getSpeechRecognition(): ISpeechRecognition | null {
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


/// Polyfill interfaces for the SpeechRecognition API

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
