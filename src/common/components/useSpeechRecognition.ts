import * as React from 'react';

import { isChromeOnDesktopWindows } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';


const SOFT_INACTIVITY_TIMEOUT = 3000;

export interface SpeechResult {
  transcript: string;
  interimTranscript: string;
  done: boolean;
}


/**
 * We use a hook to default to 'false/null' and dynamically create the engine and update the UI.
 * @param onResultCallback - the callback to invoke when a result is received
 * @param useShortcutCtrlKey - the key to use as a shortcut to start/stop the speech recognition (e.g. 'm' for "Ctrl + M")
 */
export const useSpeechRecognition = (onResultCallback: (result: SpeechResult) => void, useShortcutCtrlKey?: string) => {
  // enablers
  const [recognition, setRecognition] = React.useState<ISpeechRecognition | null>(null);

  // session
  const [isRecordingAudio, setIsRecordingAudio] = React.useState<boolean>(false);
  const [isRecordingSpeech, setIsRecordingSpeech] = React.useState<boolean>(false);
  const [isSpeechError, setIsSpeechError] = React.useState<boolean>(false);

  // external state (will update this function when changed)
  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {

      // do not re-initialize, just update the language (if we're here there's a high chance the language has changed)
      if (recognition) {
        recognition.lang = preferredLanguage;
        return;
      }

      // disable speech recognition on iPhones and Safari browsers - because of sub-par quality
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isiPhone = /iPhone|iPod/.test(navigator.userAgent);
      if (isSafari || isiPhone) {
        console.log('Speech recognition is disabled on iPhones and Safari browsers.');
        return;
      }

      const Speech = (
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        (window as any).mozSpeechRecognition ||
        (window as any).msSpeechRecognition
      ) as ISpeechRecognition;

      if (typeof Speech !== 'undefined') {

        // local memory within a session
        const speechResult: SpeechResult = {
          transcript: '',
          interimTranscript: '',
          done: false,
        };

        const instance = new Speech();
        instance.lang = preferredLanguage;
        instance.interimResults = isChromeOnDesktopWindows();
        instance.maxAlternatives = 1;
        instance.continuous = true;

        // soft inactivity timer
        let inactivityTimeoutId: any | null = null;

        const clearInactivityTimeout = () => {
          if (inactivityTimeoutId) {
            clearTimeout(inactivityTimeoutId);
            inactivityTimeoutId = null;
          }
        };

        const reloadInactivityTimeout = (timeoutMs: number) => {
          clearInactivityTimeout();
          inactivityTimeoutId = setTimeout(() => {
            inactivityTimeoutId = null;
            instance.stop();
          }, timeoutMs);
        };

        instance.onerror = event => {
          if (event.error !== 'no-speech') {
            console.error('Error occurred during speech recognition:', event.error);
            setIsSpeechError(true);
          }
        };

        instance.onresult = (event: ISpeechRecognitionEvent) => {
          if (!event?.results?.length) return;

          // coalesce all the final pieces into a cohesive string
          speechResult.transcript = '';
          speechResult.interimTranscript = '';
          for (let result of event.results) {
            let chunk = result[0]?.transcript?.trim();
            if (!chunk)
              continue;

            // spoken punctuation marks -> actual characters
            chunk = chunk
              .replaceAll(' comma', ',')
              .replaceAll(' exclamation mark', '!')
              .replaceAll(' period', '.')
              .replaceAll(' question mark', '?');

            // capitalize
            if (chunk.length > 2)
              chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);

            // add ending
            if (!chunk.endsWith('.') && !chunk.endsWith('!') && !chunk.endsWith('?') && !chunk.endsWith(':') && !chunk.endsWith(';') && !chunk.endsWith(','))
              chunk += '.';

            // NOTE: in the future we can visualize the interim results
            if (result.isFinal)
              speechResult.transcript += chunk + ' ';
            else
              speechResult.interimTranscript += chunk + ' ';
          }

          // update the UI
          onResultCallback(speechResult);

          // auto-stop
          reloadInactivityTimeout(SOFT_INACTIVITY_TIMEOUT);
        };

        instance.onaudiostart = () => setIsRecordingAudio(true);

        instance.onaudioend = () => setIsRecordingAudio(false);

        instance.onspeechstart = () => setIsRecordingSpeech(true);

        instance.onspeechend = () => setIsRecordingSpeech(false);

        instance.onstart = () => {
          speechResult.transcript = '';
          speechResult.interimTranscript = 'Listening...';
          speechResult.done = false;
          onResultCallback(speechResult);
          reloadInactivityTimeout(2 * SOFT_INACTIVITY_TIMEOUT);
        };

        instance.onend = () => {
          clearInactivityTimeout();
          speechResult.interimTranscript = '';
          speechResult.done = true;
          onResultCallback(speechResult);
        };

        setRecognition(instance);
      }
    }
  }, [onResultCallback, preferredLanguage, recognition]);


  const toggleRecording = React.useCallback(() => {
    if (!recognition)
      return console.error('Speech recognition is not supported or not initialized.');

    setIsSpeechError(false);
    if (!isRecordingAudio) {
      try {
        recognition.start();
      } catch (error: any) {
        setIsSpeechError(true);
        console.log('Speech recognition error - clicking too quickly?:', error?.message);
      }
    } else
      recognition.stop();
  }, [recognition, isRecordingAudio]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (useShortcutCtrlKey && event.ctrlKey && event.key === useShortcutCtrlKey)
        toggleRecording();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording, useShortcutCtrlKey]);

  return {
    isSpeechEnabled: !!recognition,
    isSpeechError,
    isRecordingAudio,
    isRecordingSpeech,
    toggleRecording,
  };
};


interface ISpeechRecognition extends EventTarget {
  new(): ISpeechRecognition;

  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start: () => void;
  stop: () => void;
  // abort: () => void;

  onaudiostart: (event: any) => void;
  // onsoundstart: (event: any) => void;
  onspeechstart: (event: any) => void;
  onspeechend: (event: any) => void;
  // onsoundend: (event: any) => void;
  onaudioend: (event: any) => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  // onnomatch: (event: any) => void;
  onerror: (event: any) => void;
  onstart: (event: any) => void;
  onend: (event: any) => void;
}

interface ISpeechRecognitionEvent extends Event {
  // readonly resultIndex: number;
  readonly results: SpeechRecognitionResult[];
}