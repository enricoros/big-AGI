import electronServe from 'electron-serve';
import { app, BrowserWindow } from 'electron';
import { join as pathJoin } from 'path';
// import { createIPCHandler } from 'electron-trpc/main';
// import { router } from './api.server';
// import { createTRPCRouter } from '../../src/server/api/trpc.server';
// import { createTRPCRouter } from '~/server/api/trpc.server';
// export const appRouterEdge = createTRPCRouter({
// });

// Simulate app.isPackaged if FORCE_PACKAGED environment variable is set
const isPackaged = true; // process.env.FORCE_PACKAGED ? true : app.isPackaged;


let mainWindow: BrowserWindow | null = null;

const appServe = isPackaged ? electronServe({
  directory: pathJoin(__dirname, '../../dist'),
}) : null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 960,
    frame: false,
    // backgroundColor: '#ff0000',
    // transparent: false,
    // thickFrame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: pathJoin(__dirname, 'preload.js'),
    },
  });

  // createIPCHandler({ router: router, windows: [mainWindow] });

  mainWindow.setMenu(null);
  // win.setIcon(null);

  if (appServe) {
    appServe(mainWindow).then(() => {
      mainWindow?.webContents.openDevTools();
      void mainWindow?.loadURL('app://-');
    });
  } else {
    void mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
      mainWindow?.webContents.reloadIgnoringCache();
    });
  }
};


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance. We should focus our window.
    if (mainWindow) {
      mainWindow.isMinimized() && mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});