// https://github.com/aabuhijleh/override-getDisplayMedia/blob/main/renderer.js

// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

// override getDisplayMedia
navigator.mediaDevices.getDisplayMedia = async () => {
  const selectedSource = await globalThis.myCustomGetDisplayMedia();

  // create MediaStream
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource.id,
        minWidth: 1280,
        maxWidth: 1280,
        minHeight: 720,
        maxHeight: 720,
      },
    },
  });

  return stream;
};