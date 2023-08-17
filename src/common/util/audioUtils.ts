export async function playSoundBuffer(audioBuffer: ArrayBuffer) {
  const audioContext = new AudioContext();
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
  bufferSource.connect(audioContext.destination);
  bufferSource.start();
}

export async function playSoundUrl(url: string) {
  const audio = new Audio(url);
  await audio.play();
}