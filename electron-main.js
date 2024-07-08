const { app, BrowserWindow } = require('electron');
const startServer = require('./server.js');

let mainWindow;
const port = 3000;

async function createWindow() {
  try {
    // Start the Next.js server
    await startServer(port);

    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load the Next.js app
    await mainWindow.loadURL(`http://localhost:${port}`);

    mainWindow.on('closed', function () {
      mainWindow = null;
    });
  } catch (err) {
    console.error('Failed to start server', err);
    app.quit();
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});