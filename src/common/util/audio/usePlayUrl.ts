import * as React from 'react';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';


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
      const playAudio = () => AudioPlayer.playUrl(url);
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
