export class AudioLivePlayer {
  private static readonly MIME_TYPE = 'audio/mpeg';

  /** Whether the browser supports streaming audio playback via MediaSource (false on Firefox) */
  static readonly isSupported = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AudioLivePlayer.MIME_TYPE);

  private readonly mimeType: string = AudioLivePlayer.MIME_TYPE;

  private readonly audioContext: AudioContext;
  private readonly audioElement: HTMLAudioElement;
  private readonly mediaSource: MediaSource;
  private readonly mediaSourceObjectUrl: string;
  private sourceBuffer: SourceBuffer | null = null;

  private chunkQueue: ArrayBuffer[] = [];
  private isSourceBufferUpdating: boolean = false;
  private isMediaSourceEnded: boolean = false;
  private isMediaSourceOpen: boolean = false;
  private isSourceBufferFailed: boolean = false;
  private isStopped: boolean = false;

  // Deferred for waitForPlaybackEnd() - allows stop() to unblock waiters
  private playbackEndResolve: (() => void) | null = null;


  constructor() {
    this.audioContext = new AudioContext();
    this.audioElement = new Audio();
    this.mediaSource = new MediaSource();
    this.mediaSourceObjectUrl = URL.createObjectURL(this.mediaSource);
    this.audioElement.src = this.mediaSourceObjectUrl;
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
    if (this.isStopped) return; // Prevent race with stop()

    try {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.sourceBuffer.mode = 'sequence'; // Ensure data is appended in order
      this.sourceBuffer.addEventListener('updateend', this.onSourceBufferUpdateEnd);
      this.sourceBuffer.addEventListener('error', this.onSourceBufferError);
      this.isMediaSourceOpen = true; // Set after successful initialization
    } catch (e) {
      // Safety net for any edge cases not caught by isSupported check
      console.error('[DEV] AudioLivePlayer: Failed to create SourceBuffer:', e);
      this.isSourceBufferFailed = true;
      this.playbackEndResolve?.(); // Unblock any waiters
      return;
    }

    // Start appending data if any is queued
    this.appendNextChunk();
  };

  private onMediaSourceError = (e: Event) => {
    console.warn('[DEV] AudioLivePlayer: MediaSource error:', e);
  };

  private onMediaSourceEnded = () => {
    // MediaSource stream ended (all data received)
  };

  private onMediaSourceClosed = () => {
    // MediaSource closed (cleanup complete)
  };

  private onSourceBufferError = (e: Event) => {
    console.error('[DEV] AudioLivePlayer: SourceBuffer error:', e);
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
    if (this.isStopped) return; // Early exit if stopped
    if (!this.sourceBuffer || this.isSourceBufferUpdating || !this.isMediaSourceOpen) return;

    if (this.chunkQueue.length > 0) {
      const chunk = this.chunkQueue.shift();
      if (chunk) {
        try {
          this.isSourceBufferUpdating = true;
          this.sourceBuffer.appendBuffer(chunk);
        } catch (e) {
          console.error('[DEV] AudioLivePlayer: Error appending buffer:', e);
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
   * Returns a Promise that resolves when audio playback completes.
   * This waits for the actual audio to finish playing, not just streaming to end.
   * Also resolves if stop() is called (or was already called).
   */
  public waitForPlaybackEnd(): Promise<void> {
    return new Promise((resolve) => {
      // If already stopped, ended, or failed to initialize, resolve immediately
      if (this.isStopped || this.audioElement.ended || this.isSourceBufferFailed) {
        resolve();
        return;
      }

      const cleanup = () => {
        this.playbackEndResolve = null;
        this.audioElement.removeEventListener('ended', onEnded);
        this.audioElement.removeEventListener('error', onError);
      };

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        resolve(); // Resolve even on error to not hang
      };

      // store resolver so stop() can call it
      this.playbackEndResolve = () => {
        cleanup();
        resolve();
      };

      this.audioElement.addEventListener('ended', onEnded);
      this.audioElement.addEventListener('error', onError);

      // Safety: if audio has duration and already played through, resolve
      // This handles edge case where 'ended' event was missed
      if (this.audioElement.duration > 0 && this.audioElement.currentTime >= this.audioElement.duration) {
        cleanup();
        resolve();
      }
    });
  }

  /**
   * Stop playback and clean up resources
   */
  public stop() {
    this.isStopped = true;
    this.isSourceBufferFailed = true; // Prevent late initialization
    this.audioElement.pause();
    this.chunkQueue = [];
    this.isMediaSourceEnded = true;

    // Resolve any pending waitForPlaybackEnd() callers
    this.playbackEndResolve?.();

    // Clean up SourceBuffer event listeners and abort if open
    if (this.sourceBuffer) {
      this.sourceBuffer.removeEventListener('updateend', this.onSourceBufferUpdateEnd);
      this.sourceBuffer.removeEventListener('error', this.onSourceBufferError);
      try {
        if (this.mediaSource.readyState === 'open') {
          this.sourceBuffer.abort();
          this.mediaSource.endOfStream();
        }
      } catch (e) {
        // Ignore - may race with natural stream end
      }
    }

    // Clean up MediaSource event listeners
    this.mediaSource.removeEventListener('sourceopen', this.onMediaSourceOpen);
    this.mediaSource.removeEventListener('error', this.onMediaSourceError);
    this.mediaSource.removeEventListener('sourceended', this.onMediaSourceEnded);
    this.mediaSource.removeEventListener('sourceclose', this.onMediaSourceClosed);

    if (this.audioContext.state !== 'closed')
      void this.audioContext.close().catch(() => { /* ignore - already closed */
      });
    URL.revokeObjectURL(this.mediaSourceObjectUrl);
    this.audioElement.src = '';
  }
}
