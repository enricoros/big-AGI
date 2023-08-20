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


export class LiveAudioPlayer {
  private readonly audioContext: AudioContext;
  private readonly audioElement: HTMLAudioElement;
  private readonly mediaSource: MediaSource;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null;
  private bufferSizeLimit: number;
  private onStart: (() => void) | null;
  private onStop: (() => void) | null;

  constructor() {
    this.audioContext = new AudioContext();
    this.audioElement = new Audio();
    this.mediaSource = new MediaSource();
    this.reader = null;
    this.bufferSizeLimit = 5; // in seconds
    this.onStart = null;
    this.onStop = null;
  }

  async EXPERIMENTAL_playStream(edgeResponse: Response) {
    if (this.reader) {
      await this.stop();
    }

    if (!edgeResponse.body) {
      return;
    }
    const esgeReadableStream = edgeResponse.body;

    const sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    sourceNode.connect(this.audioContext.destination);

    const mimeType = 'audio/mpeg';
    this.mediaSource.addEventListener('sourceopen', async () => {
      const sourceBuffer: SourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
      this.reader = esgeReadableStream.getReader();

      if (this.onStart) {
        this.onStart();
      }

      while (true) {
        const { done, value } = await this.reader.read();
        if (done) {
          sourceBuffer.onupdateend = () => this.mediaSource.endOfStream();
          break;
        }

        await new Promise((resolve) => {
          if (!sourceBuffer.updating) {
            resolve(null);
          } else {
            sourceBuffer.addEventListener('updateend', () => resolve(null), { once: true });
          }
        });

        if (this.audioElement.buffered.length > 0) {
          const currentTime = this.audioElement.currentTime;
          const bufferedEnd = this.audioElement.buffered.end(this.audioElement.buffered.length - 1);
          const remainingBuffer = bufferedEnd - currentTime;

          if (remainingBuffer > this.bufferSizeLimit) {
            // E: just made this a bit more resilient, but not much
            try {
              // Remove old data from the buffer
              sourceBuffer.remove(0, currentTime - 1);
              await new Promise((resolve) => {
                sourceBuffer.addEventListener('updateend', () => resolve(null), { once: true });
              });
            } catch (e) {
              console.warn('Error removing old data from the buffer:', e);
            }
          }
        }

        // Wait for the sourceBuffer to finish updating before appending new data
        await new Promise((resolve) => {
          if (!sourceBuffer.updating) {
            resolve(null);
          } else {
            sourceBuffer.addEventListener('updateend', () => resolve(null), { once: true });
          }
        });

        // Append new data to the buffer
        sourceBuffer.appendBuffer(value);
      }

      if (this.onStop) {
        this.onStop();
      }
    });

    this.audioElement.src = URL.createObjectURL(this.mediaSource);
    this.audioElement.autoplay = true;
  }

  async stop() {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
      this.mediaSource.endOfStream();
      this.audioElement.pause();
    }
  }

  // setOnStart(callback) {
  //   this.onStart = callback;
  // }
  //
  // setOnStop(callback) {
  //   this.onStop = callback;
  // }
}


/*export async function playLiveAudioStream(stream: ReadableStream<Uint8Array>, mimeType: string = 'audio/mpeg') {
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
