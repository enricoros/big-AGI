const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, shell } = require('electron');
const path = require('path');
const startServer = require('./server.js');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;
const port = 3000;

async function createWindow() {
  try {
    console.log('Starting server...');
    await startServer(port);
    console.log('Server started successfully');

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // // Set up a loading screen
    // loadingScreen = new BrowserWindow({
    //   // width: 150,
    //   // height: 150,
    //   frame: false,
    //   transparent: false,
    //   alwaysOnTop: true,
    //   webPreferences: {
    //     nodeIntegration: true,
    //   },
    //   backgroundColor: '#2e2c29',
    // });
    //
    // loadingScreen.loadFile(path.join(__dirname, 'loading.html'));
    // loadingScreen.center();
    // console.log('Loading screen created');

    console.log('Preload script path:', path.join(__dirname, 'preload.js'));

    mainWindow = new BrowserWindow({
      width: Math.min(1280, width * 0.8),
      height: Math.min(800, height * 0.8),
      minWidth: 430,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
        devTools: false,
      },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
      show: true,
      frame: false,
      titleBarStyle: 'hidden',
      icon: path.join(__dirname, 'tray-icon.png'),
      // New "insane" features:
      // transparent: true, // Enable window transparency
      vibrancy: 'under-window', // Add vibrancy effect (macOS only)
      visualEffectState: 'active', // Keep vibrancy active even when not focused (macOS only)
      roundedCorners: true, // Enable rounded corners (macOS only)
      // thickFrame: false, // Use a thinner frame on Windows
      autoHideMenuBar: true, // Auto-hide the menu bar, press Alt to show it
      scrollBounce: true, // Enable bounce effect when scrolling (macOS only)
    });

    mainWindow.removeMenu();
    mainWindow.setTitle('Your Professional App Name');

    console.log('Attempting to load main window URL...');
    await mainWindow.loadURL(`http://localhost:${port}`);
    console.log('Main window URL loaded successfully');

    mainWindow.once('ready-to-show', () => {
      console.log('Main window ready to show');
      // if (loadingScreen) {
      //   loadingScreen.close();
      // }
      mainWindow.show();
      mainWindow.focus();
    });

    createTray();
    autoUpdater.checkForUpdatesAndNotify();

    // Handle window state
    let isQuitting = false;
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    app.on('before-quit', () => {
      isQuitting = true;
    });

    // Adjust window behavior
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window-maximized');
    });

    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window-unmaximized');
    });


    // Warn if preloads fail
    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error('Preload error:', preloadPath, error);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });


    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

  } catch (err) {
    console.error('Error in createWindow:', err);
    app.quit();
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Your Professional App Name');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow().catch((err) => {
    console.error('Failed to create window:', err);
    app.quit();
  });

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for window controls
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => mainWindow.close());


// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});