import * as React from 'react';

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
   */
  export async function playBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    const audioContext = new AudioContext();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
    return new Promise((resolve) => {
      bufferSource.onended = () => resolve();
    });
  }

  /**
   * Plays a sound from a URL, and optionally repeats it after a delay.
   * @param url The URL of the sound to play.
   * @param firstDelay The delay before the first play, in milliseconds.
   * @param repeatMs The delay between each repeat, in milliseconds. If 0, the sound will only play once.
   */
  export function usePlayUrl(url: string | null, firstDelay: number = 0, repeatMs: number = 0) {
    React.useEffect(() => {
      if (!url) return;

      let timer2: any = null;

      const playFirstTime = () => {
        const playAudio = () => playUrl(url);
        void playAudio();
        timer2 = repeatMs > 0 ? setInterval(playAudio, repeatMs) : null;
      };

      const timer1 = setTimeout(playFirstTime, firstDelay);

      return () => {
        clearTimeout(timer1);
        if (timer2)
          clearInterval(timer2);
      };
    }, [firstDelay, repeatMs, url]);
  }

  /*export function useAudioPlayer() {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);

    const play = React.useCallback(async (url: string) => {
      setCurrentUrl(url);
      setIsPlaying(true);
      try {
        await playUrl(url);
      } catch (error) {
        console.error('Error playing audio:', error);
      } finally {
        setIsPlaying(false);
      }
    }, []);

    const stop = React.useCallback(() => {
      setIsPlaying(false);
      setCurrentUrl(null);
    }, []);

    return { play, stop, isPlaying, currentUrl };
  }*/
}
