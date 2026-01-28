/**
 * AudioAutoPlayer - Unified streaming/accumulated audio playback
 *
 * Abstracts the difference between:
 * - Streaming playback (AudioLivePlayer) - plays chunks as they arrive
 * - Accumulated playback (AudioPlayer) - collects all chunks, plays at end
 *
 * Automatically selects streaming if supported (Chrome, Safari, Edge),
 * falls back to accumulated for browsers without MediaSource support (Firefox).
 *
 * Can be forced into accumulated mode via constructor parameter.
 */

import { combine_ArrayBuffers_To_Uint8Array } from '~/common/util/blobUtils';

import { AudioLivePlayer } from './AudioLivePlayer';
import { AudioPlayer } from './AudioPlayer';


export class AudioAutoPlayer {

  private readonly livePlayer: AudioLivePlayer | null = null;
  private chunksAccumulator: ArrayBuffer[] = [];
  private isStopped: boolean = false;
  private isPlayingFullBuffer: boolean = false;
  private hasEnqueuedChunks: boolean = false;
  private hasEndedPlayback: boolean = false;

  // deferred for waitForPlaybackEnd() in non-streaming mode
  private readonly playbackEndPromise: Promise<void>;
  private playbackEndResolve: (() => void) | null = null;

  /**
   * @param forceAccumulate - If true, always accumulate and play at end (skip streaming)
   */
  constructor(forceAccumulate: boolean = false) {
    if (!forceAccumulate && AudioLivePlayer.isSupported)
      this.livePlayer = new AudioLivePlayer();

    // create deferred promise for accumulated mode
    this.playbackEndPromise = new Promise<void>((resolve) => {
      this.playbackEndResolve = resolve;
    });
  }

  /** Whether this instance is using streaming playback */
  get isStreaming(): boolean {
    return this.livePlayer !== null;
  }

  /** Enqueue an audio chunk for playback */
  enqueueChunk(buffer: ArrayBuffer): void {
    if (this.isStopped)
      return void console.warn('[DEV] AudioAutoPlayer: enqueueChunk after stop');
    if (this.isPlayingFullBuffer)
      return void console.warn('[DEV] AudioAutoPlayer: enqueueChunk after playFullBuffer');

    this.hasEnqueuedChunks = true;
    if (this.livePlayer) {
      this.livePlayer.enqueueChunk(buffer);
    } else {
      // Accumulate for later - copy buffer in case original is detached
      this.chunksAccumulator.push(buffer.slice(0));
    }
  }

  /** Signal that no more chunks will arrive - triggers playback in accumulated mode */
  endPlayback(): void {
    if (this.isStopped)
      return void console.warn('[DEV] AudioAutoPlayer: endPlayback after stop');
    if (this.hasEndedPlayback)
      return void console.warn('[DEV] AudioAutoPlayer: endPlayback called twice');

    this.hasEndedPlayback = true;

    if (this.livePlayer) {

      this.livePlayer.endPlayback();

    } else if (this.chunksAccumulator.length > 0) {

      // combine all chunks and play
      const combined = combine_ArrayBuffers_To_Uint8Array(this.chunksAccumulator).buffer;
      this.chunksAccumulator = []; // Clear after combining
      AudioPlayer.playAudioFull(combined).finally(() => {
        if (!this.isStopped)
          this.playbackEndResolve?.();
      });

    } else if (!this.isPlayingFullBuffer) {
      // No chunks and no full buffer playing - resolve immediately
      this.playbackEndResolve?.();
    }
    // If isPlayingFullBuffer is true, playFullBuffer's finally() will resolve
  }

  /**
   * Play a complete audio buffer directly (bypasses chunk accumulation).
   * Use this when you have a full audio buffer instead of streaming chunks.
   */
  playFullBuffer(buffer: ArrayBuffer): void {
    if (this.isStopped)
      return void console.warn('[DEV] AudioAutoPlayer: playFullBuffer after stop');
    if (this.hasEnqueuedChunks)
      console.warn('[DEV] AudioAutoPlayer: playFullBuffer after enqueueChunk');
    if (this.isPlayingFullBuffer)
      console.warn('[DEV] AudioAutoPlayer: playFullBuffer called twice');

    this.isPlayingFullBuffer = true;
    AudioPlayer.playAudioFull(buffer).finally(() => {
      if (!this.isStopped)
        this.playbackEndResolve?.();
    });
  }

  /**
   * Returns a promise that resolves when playback completes.
   * Safe to call before endPlayback()/playFullBuffer() - will wait until playback finishes.
   */
  waitForPlaybackEnd(): Promise<void> {
    // Use livePlayer only for streaming chunks, not for full buffer playback
    if (this.livePlayer && !this.isPlayingFullBuffer)
      return this.livePlayer.waitForPlaybackEnd();
    return this.playbackEndPromise;
  }

  /** Stop playback immediately */
  stop(): void {
    this.isStopped = true;
    this.livePlayer?.stop();
    this.chunksAccumulator = [];
    this.playbackEndResolve?.(); // Resolve to unblock any waiters
  }
}
