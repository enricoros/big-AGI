export namespace AudioPlayer {

  /**
   * Plays an audio file from a URL (e.g. an MP3 file).
   */
  export async function playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(new Error(`Error playing audio: ${e}`));
      audio.play().catch(reject);
    });
  }

  /**
   * Plays an audio buffer (e.g. from an ArrayBuffer).
   * Resolves when playback completes, or immediately if buffer is empty/invalid.
   */
  export async function playAudioFull(audioBuffer: ArrayBuffer): Promise<void> {
    // sanity check
    if (!audioBuffer || audioBuffer.byteLength === 0) return;

    let audioContext: AudioContext | undefined;
    try {
      audioContext = new AudioContext();

      const audioDataCopy = audioBuffer.slice(0); // slice to avoid detached buffer issues
      const decodedBuffer = await audioContext.decodeAudioData(audioDataCopy);

      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = decodedBuffer;
      bufferSource.connect(audioContext.destination);

      return new Promise((resolve) => {
        bufferSource.onended = () => {
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
