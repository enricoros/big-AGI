const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const startServer = require('./server.js');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;
const port = 3000;

async function createWindow() {
  try {
    // Start the Next.js server
    await startServer(port);

    mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Load the Next.js app
    await mainWindow.loadURL(`http://localhost:${port}`);

    // Create system tray
    createTray();

    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();

    mainWindow.on('closed', function () {
      mainWindow = null;
    });
  } catch (err) {
    console.error('Failed to start server', err);
    app.quit();
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Your App Name');
  tray.setContextMenu(contextMenu);
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

ipcMain.on('app-event', (event, arg) => {
  console.log('Received event from renderer:', arg);
  // Handle various events here
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});