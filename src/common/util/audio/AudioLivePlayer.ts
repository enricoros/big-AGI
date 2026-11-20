export class AudioLivePlayer {
  private static readonly MIME_TYPE = 'audio/mpeg';

  /** Whether the browser supports streaming audio playback via MediaSource (false on Firefox) */
  static readonly isSupported = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AudioLivePlayer.MIME_TYPE);

  private readonly mimeType: string = AudioLivePlayer.MIME_TYPE;

  // [2026-11-19] No AudioContext: it only passed the element's audio straight to the destination, with no node in
  // between, while costing a render thread and an output stream per utterance, and it leaked unless closed. Chrome plays
  // the same stream to its end without it. The 3 sites stay commented in case Safari (desktop, iPad) proves to need it:
  // not expected, as an audio element reaches the speakers by itself, but not tested there.
  // private readonly audioContext: AudioContext;
  private readonly audioElement: HTMLAudioElement;
  private readonly mediaSource: MediaSource;
  private readonly mediaSourceObjectUrl: string;
  private sourceBuffer: SourceBuffer | null = null;

  private chunkQueue: ArrayBuffer[] = [];
  private isSourceBufferUpdating: boolean = false;
  private isMediaSourceEnded: boolean = false;
  private isMediaSourceOpen: boolean = false;
  private isStopped: boolean = false; // terminal: set once, by _release()

  // Settles once, when the player reaches its terminal state - see _release()
  private readonly playbackEndPromise: Promise<void>;
  private playbackEndResolve: (() => void) | null = null;


  constructor() {
    this.playbackEndPromise = new Promise<void>((resolve) => {
      this.playbackEndResolve = resolve;
    });

    // this.audioContext = new AudioContext();
    this.audioElement = new Audio();
    this.mediaSource = new MediaSource();
    this.mediaSourceObjectUrl = URL.createObjectURL(this.mediaSource);
    this.audioElement.src = this.mediaSourceObjectUrl;
    this.audioElement.autoplay = true;

    // Suppress Android media notification by clearing media session metadata
    if ('mediaSession' in navigator)
      navigator.mediaSession.metadata = null;

    // Connect the audio element to the audio context
    // const sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    // sourceNode.connect(this.audioContext.destination);

    // Set up MediaSource events
    this.mediaSource.addEventListener('sourceopen', this.onMediaSourceOpen);
    this.mediaSource.addEventListener('error', this.onMediaSourceError);
    this.mediaSource.addEventListener('sourceended', this.onMediaSourceEnded);
    this.mediaSource.addEventListener('sourceclose', this.onMediaSourceClosed);

    // One instance plays one utterance, and ends in one of three ways: the audio played to its end, the element failed
    // (no audio arrived, or it could not be decoded), or stop() interrupted it. All three reach _release().
    this.audioElement.addEventListener('ended', this._release);
    this.audioElement.addEventListener('error', this._release);
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
      this._release(); // nothing can play
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
          this.appendNextChunk(); // no 'updateend' follows a failed append: go on with the next chunk, or end the stream
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
    if (this.isStopped) return;
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
   * Resolves when this player is done: the audio played to its end, playback failed, or stop() was called.
   * This waits for the actual audio to finish playing, not just streaming to end. Safe to call at any time.
   */
  public waitForPlaybackEnd(): Promise<void> {
    return this.playbackEndPromise;
  }

  /**
   * Interrupt playback, then release
   */
  public stop() {
    // Only an interruption has something to halt: at 'ended' and at 'error' the element is already paused and the
    // MediaSource is no longer 'open'
    this.audioElement.pause();

    // Abort the SourceBuffer if still open (its queued 'updateend' finds no listener: _release removes them)
    if (this.sourceBuffer) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.sourceBuffer.abort();
          this.mediaSource.endOfStream();
        }
      } catch (e) {
        // Ignore - may race with natural stream end
      }
    }

    this._release();
  }

  /**
   * Terminal state, once - on the natural end, on an element error and on stop(): no more work, waiters resolved,
   * listeners removed, and the object URL (which keeps the MediaSource alive) freed.
   */
  private _release = () => {
    if (this.isStopped) return;
    this.isStopped = true;
    this.chunkQueue = [];
    this.isMediaSourceEnded = true;

    // Resolve waitForPlaybackEnd() callers: they resume only after this function has returned, wherever this line sits.
    // It sits first so that nothing below can leave them waiting.
    this.playbackEndResolve?.();

    // Clean up the terminal listeners (clearing 'src' below fires an 'error' of its own)
    this.audioElement.removeEventListener('ended', this._release);
    this.audioElement.removeEventListener('error', this._release);

    // Clean up SourceBuffer event listeners (was aborted on stop())
    if (this.sourceBuffer) {
      this.sourceBuffer.removeEventListener('updateend', this.onSourceBufferUpdateEnd);
      this.sourceBuffer.removeEventListener('error', this.onSourceBufferError);
    }

    // Clean up MediaSource event listeners
    this.mediaSource.removeEventListener('sourceopen', this.onMediaSourceOpen);
    this.mediaSource.removeEventListener('error', this.onMediaSourceError);
    this.mediaSource.removeEventListener('sourceended', this.onMediaSourceEnded);
    this.mediaSource.removeEventListener('sourceclose', this.onMediaSourceClosed);

    // if (this.audioContext.state !== 'closed')
    //   void this.audioContext.close().catch(() => { /* ignore - already closed */ });
    URL.revokeObjectURL(this.mediaSourceObjectUrl);
    this.audioElement.src = '';
  }
}
