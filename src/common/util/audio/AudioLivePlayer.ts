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

    // Continue appending if there's more data
    if (!this.isMediaSourceEnded) {
      this.appendNextChunk();
    } else {
      // End the stream if all data has been appended
      if (this.sourceBuffer && !this.sourceBuffer.updating && this.chunkQueue.length === 0) {
        this.mediaSource.endOfStream();
      }
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
      if (this.sourceBuffer && !this.sourceBuffer.updating) {
        this.mediaSource.endOfStream();
      }
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
    if (this.sourceBuffer && !this.sourceBuffer.updating && this.chunkQueue.length === 0) {
      this.mediaSource.endOfStream();
    }
  }

  /**
   * Stop playback and clean up resources
   */
  public async stop() {
    this.audioElement.pause();
    this.chunkQueue = [];
    this.isMediaSourceEnded = true;

    if (this.sourceBuffer) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.endOfStream();
        }
        this.sourceBuffer.abort();
      } catch (e) {
        console.warn('Error stopping playback:', e);
      }
    }

    this.audioContext.close();
    this.audioElement.src = '';
  }
}
