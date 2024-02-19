import { contextBridge, ipcRenderer } from 'electron';
// import { exposeElectronTRPC } from 'electron-trpc/main';

contextBridge.exposeInMainWorld('electronAPI', {
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    console.log('electronAPI.on', channel);
    ipcRenderer.on(channel, callback);
  },
  send: (channel: string, ...args: any[]) => {
    console.log('electronAPI.send', channel);
    ipcRenderer.send(channel, args);
  },
});
//
// process.once('loaded', async () => {
//   exposeElectronTRPC();
// });