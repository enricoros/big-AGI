export class AudioLivePlayer {
  private readonly mimeType: string = 'audio/mpeg';

  private readonly audioContext: AudioContext;
  private readonly audioElement: HTMLAudioElement;
  private readonly mediaSource: MediaSource;
  private sourceBuffer: SourceBuffer | null = null;

  private chunkQueue: ArrayBuffer[] = [];
  private isSourceBufferUpdating: boolean = false;
  private isMediaSourceEnded: boolean = false;
  private isMediaSourceOpen: boolean = false;


  constructor() {
    this.audioContext = new AudioContext();
    this.audioElement = new Audio();
    this.mediaSource = new MediaSource();
    this.audioElement.src = URL.createObjectURL(this.mediaSource);
    this.audioElement.autoplay = true;

    // Suppress Android media notification by clearing media session metadata
    if ('mediaSession' in navigator)
      navigator.mediaSession.metadata = null;

    // Connect the audio element to the audio context
    const sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    sourceNode.connect(this.audioContext.destination);

    // Set up MediaSource events
    this.mediaSource.addEventListener('sourceopen', this.onMediaSourceOpen);
    this.mediaSource.addEventListener('error', this.onMediaSourceError);
    this.mediaSource.addEventListener('sourceended', this.onMediaSourceEnded);
    this.mediaSource.addEventListener('sourceclose', this.onMediaSourceClosed);
  }

  private onMediaSourceOpen = () => {
    this.isMediaSourceOpen = true;
    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
    this.sourceBuffer.mode = 'sequence'; // Ensure data is appended in order
    this.sourceBuffer.addEventListener('updateend', this.onSourceBufferUpdateEnd);
    this.sourceBuffer.addEventListener('error', this.onSourceBufferError);

    // Start appending data if any is queued
    this.appendNextChunk();
  };

  private onMediaSourceError = (e: Event) => {
    console.error('MediaSource error:', e);
  };

  private onMediaSourceEnded = () => {
    console.log('MediaSource ended');
  };

  private onMediaSourceClosed = () => {
    console.log('MediaSource closed');
  };

  private onSourceBufferError = (e: Event) => {
    console.error('SourceBuffer error:', e);
  };

  private onSourceBufferUpdateEnd = () => {
    this.isSourceBufferUpdating = false;

    // Always continue appending if there's more data in the queue
    if (this.chunkQueue.length > 0) {
      this.appendNextChunk();
    } else if (this.isMediaSourceEnded) {
      // Only end the stream when queue is fully drained
      this._safeEndOfStream();
    }
  };

  private appendNextChunk() {
    if (!this.sourceBuffer || this.isSourceBufferUpdating || !this.isMediaSourceOpen) return;

    if (this.chunkQueue.length > 0) {
      const chunk = this.chunkQueue.shift();
      if (chunk) {
        try {
          this.isSourceBufferUpdating = true;
          this.sourceBuffer.appendBuffer(chunk);
        } catch (e) {
          console.error('Error appending buffer:', e);
          this.isSourceBufferUpdating = false;
        }
      }
    } else if (this.isMediaSourceEnded) {
      if (this.sourceBuffer && !this.sourceBuffer.updating)
        this._safeEndOfStream();
    }
  }

  private _safeEndOfStream() {
    if (this.mediaSource.readyState !== 'open') return;
    try {
      this.mediaSource.endOfStream();
    } catch (e) {
      // Ignore - MediaSource may have already ended
    }
  }

  /**
   * Enqueue an ArrayBuffer chunk to be played
   */
  public enqueueChunk(chunk: ArrayBuffer) {
    this.chunkQueue.push(chunk);
    this.appendNextChunk();
  }

  /**
   * Signal that no more chunks will be enqueued
   */
  public endPlayback() {
    this.isMediaSourceEnded = true;
    // If the sourceBuffer is not updating, we can end the stream
    if (this.sourceBuffer && !this.sourceBuffer.updating && this.chunkQueue.length === 0)
      this._safeEndOfStream();
  }

  /**
   * Stop playback and clean up resources
   */
  public async stop() {
    this.audioElement.pause();
    this.chunkQueue = [];
    this.isMediaSourceEnded = true;

    // only abort SourceBuffer when MediaSource is 'open'
    if (this.sourceBuffer && this.mediaSource.readyState === 'open') {
      try {
        this.sourceBuffer.abort();
        this.mediaSource.endOfStream();
      } catch (e) {
        // Ignore - may race with natural stream end
      }
    }

    void this.audioContext.close(); // fire/forget
    this.audioElement.src = '';
  }
}
