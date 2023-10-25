import * as React from 'react';

export function playSoundUrl(url: string) {
  const audio = new Audio(url);
  audio.play().catch(error => console.error('Error playing audio:', url, error));
}

export async function playSoundBuffer(audioBuffer: ArrayBuffer) {
  const audioContext = new AudioContext();
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
  bufferSource.connect(audioContext.destination);
  bufferSource.start();
}


/**
 * Plays a sound from a URL, and optionally repeats it after a delay.
 * @param url The URL of the sound to play.
 * @param firstDelay The delay before the first play, in milliseconds.
 * @param repeatMs The delay between each repeat, in milliseconds. If 0, the sound will only play once.
 */
export function usePlaySoundUrl(url: string | null, firstDelay: number = 0, repeatMs: number = 0) {
  React.useEffect(() => {
    if (!url) return;

    let timer2: any = null;

    const playFirstTime = () => {
      const playAudio = () => playSoundUrl(url);
      playAudio();
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


/* Note: the following function was an earlier implementation of AudioLivePlayer, but it didn't work well.

export async function playLiveAudioStream(stream: ReadableStream<Uint8Array>, mimeType: string = 'audio/mpeg') {
  const mediaSource = new MediaSource();
  const audio = new Audio(URL.createObjectURL(mediaSource));
  audio.autoplay = true;

  mediaSource.addEventListener('sourceopen', async () => {
    const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
    const reader = stream.getReader();

    const processStream = async () => {
      const { done, value } = await reader.read();

      if (done) {
        mediaSource.endOfStream();
        return;
      }

      if (sourceBuffer.updating) {
        await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
      }

      sourceBuffer.appendBuffer(value);
      processStream();
    };

    processStream();
  });
}*/
