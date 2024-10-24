import { createSpeechRecognitionResults, IRecognitionEngine, SpeechDoneReason, SpeechRecognitionState, SpeechResult } from './useSpeechRecognition';


/**
 * Engine which uses the MediaRecorder API -> online Transcription for speech recognition.
 */
export class AudioRecorderEngine implements IRecognitionEngine {
  public readonly engineType = 'audioRecorder';

  // save parameters
  private onResultCallback: (result: SpeechResult) => void;
  private readonly setState: (state: Partial<SpeechRecognitionState>) => void;

  // state
  private _mediaRecorder: MediaRecorder | null = null;
  private _mediaStream: MediaStream | null = null;
  private audioChunks: BlobPart[] = [];
  private results: SpeechResult = createSpeechRecognitionResults();

  constructor(
    _preferredLanguageIgnored: string,
    _softStopTimeoutIgnored: number,
    onResultCallback: (result: SpeechResult) => void,
    setState: (state: Partial<SpeechRecognitionState>) => void,
  ) {
    // Save parameters
    this.setState = setState;
    this.onResultCallback = onResultCallback;

    // all ready
    setState({ isAvailable: true });
  }

  async start() {
    if (!navigator?.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState({ errorMessage: 'Media devices API not supported.' });
      return;
    }

    // Initialize results
    this.results = createSpeechRecognitionResults();
    this.onResultCallback(this.results);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this._mediaStream = stream;
      this._mediaRecorder = new MediaRecorder(stream);

      this._mediaRecorder.onstart = () => {
        this.setState({ isActive: true, hasAudio: true });
        this.audioChunks = [];
      };

      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this._mediaRecorder.onstop = async () => {
        this.setState({ isActive: false, hasAudio: false });

        // Stop all tracks to release microphone
        if (this._mediaStream) {
          this._mediaStream.getTracks().forEach(track => track.stop());
          this._mediaStream = null;
        }

        // Transcribe audio
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this._handleAudioBlob(audioBlob);

        // Clean up MediaRecorder
        if (this._mediaRecorder) {
          this._mediaRecorder.onstart = null;
          this._mediaRecorder.ondataavailable = null;
          this._mediaRecorder.onstop = null;
          this._mediaRecorder.onerror = null;
          this._mediaRecorder = null;
        }
      };

      this._mediaRecorder.onerror = (event) => {
        console.error('AudioRecorderEngine error:', event);
        this._handleError('Recording failed.');
      };

      this._mediaRecorder.start();
    } catch (error: any) {
      console.error('MediaDevices.getUserMedia error:', error);
      this._handleError('Microphone access denied or not available.');
    }
  }

  stop(reason: SpeechDoneReason, sendOnDone: boolean) {
    this.results.doneReason = reason;
    this.results.flagSendOnDone = sendOnDone;

    if (this._mediaRecorder && this._mediaRecorder.state === 'recording')
      this._mediaRecorder.stop();
  }

  dispose() {
    // if is running
    if (this._mediaStream) {
      this.results.doneReason = 'react-unmount';
      this.stop(this.results.doneReason, false);
      // Stop media streams
      this._mediaStream.getTracks().forEach(track => track.stop());
      this._mediaStream = null;
    }

    // Clean up MediaRecorder
    if (this._mediaRecorder) {
      if (this._mediaRecorder.state !== 'inactive')
        this._mediaRecorder.stop();
      this._mediaRecorder.onstart = null;
      this._mediaRecorder.ondataavailable = null;
      this._mediaRecorder.onstop = null;
      this._mediaRecorder.onerror = null;
      this._mediaRecorder = null;
    }
  }

  isBetweenBeginEnd() {
    return !!this._mediaStream;
  }

  updateConfiguration(_language: string, _softStopTimeout: number, onResultCallback: (result: SpeechResult) => void) {
    this.onResultCallback = onResultCallback;
  }

  private async _handleAudioBlob(audioBlob: Blob) {
    try {
      this.results.transcript = await _transcribeDeepframFrontend(audioBlob);
      this.results.interimTranscript = '';
      this.results.done = true;
      this.results.doneReason = this.results.doneReason ?? 'api-unknown-timeout';
      this.onResultCallback(this.results);
    } catch (error: any) {
      console.error('Recognition error:', error);
      this._handleError('Recognition failed: ' + error?.message);
    }
  }

  private _handleError(message: string) {
    this.setState({ errorMessage: message });
    this.results.doneReason = 'api-error';
    this.results.done = true;
    this.onResultCallback(this.results);
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording')
      this._mediaRecorder.stop();
    this.setState({ isActive: false, hasAudio: false });
  }

}

// Modified function to send audioBlob to your backend
async function _transcribeDeepframFrontend(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': 'Token YOUR_API_KEY_FROM_FRONTEND', // omitted
      'Content-Type': 'audio/webm',
    },
  });
  if (!response.ok) {
    console.log('Transcription API failed:', response);
    throw new Error('Transcription API failed: ' + response.statusText);
  }
  const { /*metadata,*/ results } = await response.json();
  return results?.['channels']?.[0]?.['alternatives']?.[0]?.['transcript'] ?? '';
}
