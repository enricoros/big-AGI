export namespace AudioPlayer {

  /**
   * Plays an audio file from a URL. Resolves when playback ends.
   * If a signal is provided and aborted, playback stops and the promise resolves.
   *
   * @throws If there's an error during playback (e.g. network error, unsupported format), the promise will reject.
   */
  export function playUrl(url: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted || !url) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);

      const cleanup = () => {
        signal?.removeEventListener('abort', onSignalAbort);
        audio.onended = null;
        audio.onerror = null;
      };

      const onSignalAbort = () => {
        cleanup();
        audio.pause();
        audio.src = '';
        resolve();
      };

      signal?.addEventListener('abort', onSignalAbort, { once: true });

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = (e) => {
        cleanup();
        reject(new Error(`Error playing audio: ${e}`));
      };

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Plays an audio buffer. Resolves when playback ends or buffer is empty/invalid.
   * If a signal is provided and aborted, playback stops and the promise resolves.
   *
   * Mainly called by AudioAutoPlayer.
   */
  export async function playFullBuffer(audioBuffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
    // sanity check
    if (!audioBuffer || audioBuffer.byteLength === 0 || signal?.aborted) return;

    let audioContext: AudioContext | undefined;
    try {
      audioContext = new AudioContext();

      const audioDataCopy = audioBuffer.slice(0); // slice to avoid detached buffer issues
      const decodedBuffer = await audioContext.decodeAudioData(audioDataCopy);

      // check again after async decode
      if (signal?.aborted) {
        audioContext.close().catch(() => {
        });
        return;
      }

      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = decodedBuffer;
      bufferSource.connect(audioContext.destination);

      return new Promise<void>((resolve) => {
        const onSignalAbort = () => {
          bufferSource.onended = null;
          bufferSource.stop();
          audioContext?.close().catch(() => {
          });
          resolve();
        };
        signal?.addEventListener('abort', onSignalAbort, { once: true });
        bufferSource.onended = () => {
          signal?.removeEventListener('abort', onSignalAbort);
          audioContext?.close().catch(() => {
          });
          resolve();
        };
        bufferSource.start();
      });

    } catch (error) {
      console.warn('[AudioPlayer] playAudioFull failed:', error);
      audioContext?.close().catch(() => {
      });
      // Resolve to not break playback chains - the audio just won't play
      return;
    }
  }

}
