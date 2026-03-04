const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

// Set app name and userData path (prevents "Electron" folder in Application Support)
app.setName('big-AGI');
const appData = app.getPath('appData');
app.setPath('userData', path.join(appData, 'big-AGI'));

// Keep references to prevent garbage collection
let tray = null;
let mainWindow = null;
let serverProcess = null;
let serverPort = null;

// Resolve icon paths once
const appIconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png');
const trayIconSource = path.join(__dirname, '..', 'public', 'icons', 'icon-192x192.png');

// macOS: pure menu bar app — never show dock icon
if (process.platform === 'darwin') {
  app.dock.hide();
}

/**
 * Find a free TCP port by binding to port 0.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Wait for a TCP port to accept connections.
 */
function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Server did not start within ${timeout}ms`));
      }
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(tryConnect, 200);
      });
      socket.connect(port, '127.0.0.1');
    };
    tryConnect();
  });
}

/**
 * Spawn the Next.js standalone server.
 */
async function startNextServer() {
  serverPort = await getFreePort();

  // The standalone build outputs to dist/standalone/server.js (distDir: 'dist' in next.config.ts)
  const serverPath = path.join(__dirname, '..', 'dist', 'standalone', 'server.js');

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOSTNAME: '127.0.0.1',
    },
    cwd: path.join(__dirname, '..', 'dist', 'standalone'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[next] server exited with code ${code}`);
    serverProcess = null;
  });

  console.log(`[electron] waiting for Next.js server on port ${serverPort}...`);
  await waitForPort(serverPort);
  console.log(`[electron] Next.js server ready on port ${serverPort}`);
}

/**
 * Create the main BrowserWindow (frameless, reuses big-AGI's WebkitAppRegion drag CSS).
 */
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1200, width),
    height: Math.min(800, height),
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 13 },
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    // Don't quit — hide to tray instead
    e.preventDefault();
    mainWindow.hide();
  });
}

/**
 * Toggle the main window visibility (called from tray click).
 */
function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

/**
 * Create the system tray icon and context menu.
 */
function createTray() {
  // Use the 192x192 icon resized to 18x18 for crisp menu bar rendering (colored, not template)
  let trayIcon = nativeImage.createFromPath(trayIconSource);
  trayIcon = trayIcon.resize({ width: 18, height: 18 });

  tray = new Tray(trayIcon);
  tray.setToolTip('big-AGI');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show big-AGI', click: toggleWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        // Force-close: allow window to close, kill server, quit app
        if (mainWindow) {
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }
        if (serverProcess) {
          serverProcess.kill();
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

// --- App lifecycle ---

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createTray();
    createWindow();
  } catch (err) {
    console.error('[electron] Failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS — tray keeps the app alive
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
