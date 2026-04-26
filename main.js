const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { attachLiveReload } = require('../_shared/electron-live-reload.cjs');

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
    icon: iconPath,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5186/');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

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
