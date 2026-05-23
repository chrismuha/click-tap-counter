const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
let attachLiveReload = () => () => {};
try {
  ({ attachLiveReload } = require('../_shared/electron-live-reload.cjs'));
} catch {
  // Shared live-reload helper is optional; continue without it.
}
const { loadRenderer } = require('./startup-mode.cjs');

if (require('electron-squirrel-startup')) {
  app.quit();
}

function resolveIconPath(fileName) {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'assets', 'icons', fileName),
        path.join(process.resourcesPath, 'assets', fileName),
      ]
    : [
        path.join(__dirname, 'assets', 'icons', fileName),
        path.join(__dirname, 'assets', fileName),
      ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function createWindow() {
  const iconFileName = process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
  const iconPath = resolveIconPath(iconFileName);
  const dockIconPath = resolveIconPath('icon.png');

  if (process.platform === 'darwin' && app.dock?.setIcon && fs.existsSync(dockIconPath)) {
    const dockIcon = nativeImage.createFromPath(dockIconPath);
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: { x: 14, y: 14 },
    icon: iconPath,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(win, {
    defaultCloudUrl: 'http://localhost:5186/',
    localFile: path.join(__dirname, 'dist', 'index.html'),
  });

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      const isDevToolsKey = input.key?.toLowerCase() === 'i' || input.code === 'KeyI';
      if (((input.meta && input.alt) || (input.control && input.shift)) && isDevToolsKey) {
        event.preventDefault();
        win.webContents.toggleDevTools();
      }
    });
    if (process.env.OPEN_DEVTOOLS === '1') win.webContents.openDevTools();
  }

  win.maximize();

  const stopWatching = attachLiveReload({
    enabled: !app.isPackaged,
    rootDir: __dirname,
    watchPaths: ['index.html', 'styles.css', 'renderer.js'],
    getWindows: () => [win],
  });

  win.on('closed', stopWatching);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
