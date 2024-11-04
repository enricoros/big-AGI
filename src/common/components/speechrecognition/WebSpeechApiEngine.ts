import { Is } from '~/common/util/pwaUtils';

import { createSpeechRecognitionResults, IRecognitionEngine, SpeechDoneReason, SpeechRecognitionState, SpeechResult } from './useSpeechRecognition';


/**
 * Engine which uses the WebSpeech API for speech recognition.
 */
export class WebSpeechApiEngine implements IRecognitionEngine {
  public readonly engineType = 'webSpeechApi';

  // save parameters
  private softStopTimeout: number;
  private onResultCallback: (result: SpeechResult) => void;

  // state
  private _api: ISpeechRecognition;
  private inactivityTimeoutId: ReturnType<typeof setTimeout> | null;
  private results: SpeechResult;
  private withinBeginEnd: boolean;


  constructor(
    WebSpeechAPIClass: ISpeechRecognition,
    preferredLanguage: string,
    softStopTimeout: number,
    onResultCallback: (result: SpeechResult) => void,
    setState: (state: Partial<SpeechRecognitionState>) => void,
  ) {
    // save parameters
    this.softStopTimeout = softStopTimeout;
    this.onResultCallback = onResultCallback;


    // clean state
    this.inactivityTimeoutId = null;
    this.results = createSpeechRecognitionResults();
    this.withinBeginEnd = false;


    // create the SpeechRecognition instance
    this._api = new WebSpeechAPIClass();

    // configure the instance
    this._api.lang = preferredLanguage;
    this._api.interimResults =
      Is.Desktop                      // verified on Chrome desktop, and Safari desktop
      && softStopTimeout > 0;         // only if we perform the stopping on the client side
    this._api.maxAlternatives = 1;
    this._api.continuous = true;

    // bind event handlers
    this._api.onaudiostart = () => setState({ hasAudio: true });
    this._api.onaudioend = () => setState({ hasAudio: false });

    this._api.onspeechstart = () => setState({ hasSpeech: true });
    this._api.onspeechend = () => setState({ hasSpeech: false });


    this._api.onstart = () => {
      this.withinBeginEnd = true;          // instant
      setState({ isActive: true });   // delayed

      // reinitialize the results
      this.results = createSpeechRecognitionResults();
      this.onResultCallback(this.results);

      // let the system handle the first stop (as long as possible)
      // if (this._api.interimResults)
      //   _reloadInactivityTimeout(2 * this.softStopTimeout);
    };

    this._api.onend = () => {
      this._clearInactivityTimeout();

      this.withinBeginEnd = false;          // instant
      setState({ isActive: false });  // delayed

      this.results.interimTranscript = '';
      this.results.done = true;
      this.results.doneReason = this.results.doneReason ?? 'api-unknown-timeout';
      this.onResultCallback(this.results);

      // (future) Resolve the promise when recording ends
      // recordingDonePromiseResolveRef.current?.(speechResult);
      // recordingDonePromiseResolveRef.current = null;
    };

    this._api.onerror = (event: any) => {
      let errorMessage;
      switch (event.error) {
        case 'no-speech':
          this.results.doneReason = 'api-no-speech';
          break;

        case 'aborted':
          // the user clicked the stop button, so nothing to really do as the manual done reason is already set
          // this.results.doneReason = 'manual';
          return;

        case 'not-allowed':
          errorMessage = 'Microphone access blocked by the user. Enable it in your browser settings to use speech recognition.';
          break;

        case 'service-not-allowed':
          errorMessage = 'Speech Recognition permission denied. Check your System Settings.';
          break;

        case 'audio-capture':
          errorMessage = `Audio capture failed (${event.message}). Please try again.`;
          break;

        case 'network':
          errorMessage = 'Network communication required to complete the service, but failed.';
          break;

        default:
          console.error('Speech recognition error:', event.error, event.message);
          errorMessage = `Browser speech recognition issue ${event.error}: ${event.message}`;
          break;
      }
      if (errorMessage) setState({ errorMessage });
      this.results.doneReason = 'api-error';
    };

    this._api.onresult = (event: ISpeechRecognitionEvent) => {
      if (!event?.results?.length) return;

      // coalesce all the final pieces into a cohesive string
      this.results.transcript = '';
      this.results.interimTranscript = '';
      for (const result of event.results) {
        let chunk = result[0]?.transcript?.trim();
        if (!chunk) continue;

        // Capitalize
        if (chunk.length >= 2 && (result.isFinal || !this.results.interimTranscript))
          chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);

        // Punctuate
        if (result.isFinal && !/[.!?;:,\s]$/.test(chunk))
          chunk += '.';

        if (result.isFinal)
          this.results.transcript = _chunkExpressionReplaceEN(this.results.transcript + chunk + ' ');
        else
          this.results.interimTranscript = _chunkExpressionReplaceEN(this.results.interimTranscript + chunk + ' ');
      }
      this.onResultCallback(this.results);

      // move the timeout deadline, if in continuous (manually stopped) mode
      if (this._api.interimResults)
        this._reloadInactivityTimeout(this.softStopTimeout, 'continuous-deadline');
    };


    // all ready
    setState({ isAvailable: true });
  }


  start() {
    this.results.flagSendOnDone = undefined;
    this._api.start();
  }

  stop(reason: SpeechDoneReason, sendOnDone: boolean) {
    this.results.doneReason = reason;
    this.results.flagSendOnDone = sendOnDone;
    this._api.stop();
  }

  dispose() {
    // Clear any inactivity timeout to prevent it from running after unmount
    this._clearInactivityTimeout();

    // Explicitly remove event listeners
    this._api.onaudiostart = undefined;
    this._api.onaudioend = undefined;
    this._api.onspeechstart = undefined;
    this._api.onspeechend = undefined;
    this._api.onstart = undefined;
    this._api.onend = undefined;
    this._api.onerror = undefined;
    this._api.onresult = undefined;

    // Stop the recognition if it is still active
    if (this.withinBeginEnd) {
      this.withinBeginEnd = false;
      this.results.doneReason = 'react-unmount';
      this._api.stop();
    }
  }

  isBetweenBeginEnd() {
    return this.withinBeginEnd;
  }

  updateConfiguration(language: string, softStopTimeout: number, onResultCallback: (result: SpeechResult) => void) {
    this._api.lang = language;
    this.softStopTimeout = softStopTimeout;
    this.onResultCallback = onResultCallback;
  }

  private _clearInactivityTimeout() {
    if (this.inactivityTimeoutId) {
      clearTimeout(this.inactivityTimeoutId);
      this.inactivityTimeoutId = null;
    }
  }

  private _reloadInactivityTimeout(timeoutMs: number, doneReason: SpeechDoneReason) {
    this._clearInactivityTimeout();
    this.inactivityTimeoutId = setTimeout(() => {
      this.inactivityTimeoutId = null;
      this.results.doneReason = doneReason;
      this._api.stop();
    }, timeoutMs);
  }

}

export function getSpeechRecognitionClass(): ISpeechRecognition | null {
  if (typeof window !== 'undefined') {
    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition || null
    );
  }
  return null;
}

// Helper function
function _chunkExpressionReplaceEN(fullText: string): string {
  return fullText
    .replaceAll(/\.?\scomma\b/gi, ',')
    .replaceAll(/\.?\speriod\b/gi, '.')
    .replaceAll(/\.?\squestion mark\b/gi, '?')
    .replaceAll(/\.?\sexclamation mark\b/gi, '!');
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

