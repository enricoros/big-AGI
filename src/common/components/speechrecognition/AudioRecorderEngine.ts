import {
  createSpeechRecognitionResults,
  IRecognitionEngine,
  SpeechDoneReason,
  SpeechRecognitionState,
  SpeechResult,
} from './useSpeechRecognition';


/**
 * Engine which uses the MediaRecorder API → server-side transcription
 * via an OpenAI-compatible /v1/audio/transcriptions endpoint
 * (Mistral Voxtral, OpenAI Whisper, self-hosted vLLM, etc.).
 *
 * Flow: record mic → stop → POST blob to /api/stt/transcribe → get text.
 */
export class AudioRecorderEngine implements IRecognitionEngine {
  public readonly engineType = 'audioRecorder';

  private onResultCallback: (result: SpeechResult) => void;
  private readonly setState: (state: Partial<SpeechRecognitionState>) => void;

  private preferredLanguage: string;

  private _mediaRecorder: MediaRecorder | null = null;
  private _mediaStream: MediaStream | null = null;
  private audioChunks: BlobPart[] = [];
  private results: SpeechResult = createSpeechRecognitionResults();
  private skipTranscriptionOnStop = false;

  constructor(
    preferredLanguage: string,
    _softStopTimeoutIgnored: number,
    onResultCallback: (result: SpeechResult) => void,
    setState: (state: Partial<SpeechRecognitionState>) => void,
  ) {
    this.preferredLanguage = preferredLanguage;
    this.onResultCallback = onResultCallback;
    this.setState = setState;
    setState({ isAvailable: true });
  }

  async start() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      this.setState({ errorMessage: 'Media devices API not supported.' });
      return;
    }

    this.results = createSpeechRecognitionResults();
    this.skipTranscriptionOnStop = false;
    this.audioChunks = [];
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

      const recorderOptions: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          recorderOptions.mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          recorderOptions.mimeType = 'audio/webm;codecs=opus';
        }
      }

      this._mediaRecorder = new MediaRecorder(stream, recorderOptions);

      this._mediaRecorder.onstart = () => {
        this.setState({ isActive: true, hasAudio: true, hasSpeech: false });
        this.audioChunks = [];
      };

      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this._mediaRecorder.onstop = async () => {
        this.setState({ isActive: false, hasAudio: false, hasSpeech: false });

        const recorderMimeType = this._mediaRecorder?.mimeType || 'audio/webm';

        if (this._mediaStream) {
          this._mediaStream.getTracks().forEach((t) => t.stop());
          this._mediaStream = null;
        }

        try {
          if (!this.skipTranscriptionOnStop) {
            const audioBlob = new Blob(this.audioChunks, { type: recorderMimeType });
            await this._handleAudioBlob(audioBlob, recorderMimeType);
          }
        } finally {
          if (this._mediaRecorder) {
            this._mediaRecorder.onstart = null;
            this._mediaRecorder.ondataavailable = null;
            this._mediaRecorder.onstop = null;
            this._mediaRecorder.onerror = null;
            this._mediaRecorder = null;
          }
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
    this.skipTranscriptionOnStop = true;

    if (this._mediaStream) {
      this.results.doneReason = 'react-unmount';
      this._mediaStream.getTracks().forEach((t) => t.stop());
      this._mediaStream = null;
    }

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

  updateConfiguration(
    language: string,
    _softStopTimeout: number,
    onResultCallback: (result: SpeechResult) => void,
  ) {
    this.preferredLanguage = language;
    this.onResultCallback = onResultCallback;
  }

  private async _handleAudioBlob(audioBlob: Blob, mimeType: string) {
    try {
      this.results.transcript = await _transcribeViaServer(audioBlob, mimeType, this.preferredLanguage);
      this.results.interimTranscript = '';
      this.results.done = true;
      this.results.doneReason = this.results.doneReason ?? 'api-unknown-timeout';
      this.onResultCallback(this.results);
    } catch (error: any) {
      console.error('Recognition error:', error);
      this._handleError('Recognition failed: ' + (error?.message ?? String(error)));
    }
  }

  private _handleError(message: string) {
    this.skipTranscriptionOnStop = true;
    this.setState({ errorMessage: message });
    this.results.doneReason = 'api-error';
    this.results.done = true;
    this.onResultCallback(this.results);

    if (this._mediaRecorder && this._mediaRecorder.state === 'recording')
      this._mediaRecorder.stop();

    this.setState({ isActive: false, hasAudio: false, hasSpeech: false });
  }
}


function _extensionForMime(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function _normalizeLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const trimmed = lang.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/[-_]/)[0]?.toLowerCase() || undefined;
}

async function _transcribeViaServer(
  audioBlob: Blob,
  mimeType: string,
  preferredLanguage?: string,
): Promise<string> {
  const ext = _extensionForMime(mimeType);
  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);

  const normalizedLang = _normalizeLanguage(preferredLanguage);
  if (normalizedLang)
    formData.append('language', normalizedLang);

  const response = await fetch('/api/stt/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const errData = await response.json();
      details = errData?.details || errData?.error || details;
    } catch {
      try { details = await response.text(); } catch { /* ignore */ }
    }
    throw new Error(`Transcription failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return data?.text ?? '';
}
