const { contextBridge, desktopCapturer, ipcRenderer } = require('electron');
const { readFileSync } = require('fs');
const { join } = require('path');

// Main bridge
contextBridge.exposeInMainWorld('electron', {
  sendEvent: (event) => ipcRenderer.send('app-event', event),
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
});


// Screen Capture: inject renderer.js into the web page
window.addEventListener('DOMContentLoaded', () => {
  console.log('Screen Capture: Injecting renderer.js into the web page');
  const rendererScript = document.createElement('script');
  rendererScript.text = readFileSync(join(__dirname, 'renderer.js'), 'utf8');
  document.body.appendChild(rendererScript);
});

// Screen Capture: expose desktopCapturer to the web page
contextBridge.exposeInMainWorld('myCustomGetDisplayMedia', async () => {
  console.log('Screen Capture: Calling desktopCapturer.getSources');
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
  });

  console.log('Available sources:', sources);

  // you should create some kind of UI to prompt the user
  // to select the correct source like Google Chrome does
  // this is just for testing purposes
  return sources[0];
});

console.log('Preload script loaded');
