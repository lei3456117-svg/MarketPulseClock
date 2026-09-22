const { app, BrowserWindow, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '../assets/trayTemplate.png');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('Market Pulse Clock');

    const updateTrayMenu = () => {
      const isTop = mainWindow ? mainWindow.isAlwaysOnTop() : false;
      const isVisible = mainWindow ? mainWindow.isVisible() : true;
      const contextMenu = Menu.buildFromTemplate([
        {
          label: isVisible ? '隐藏时钟窗口' : '显示时钟窗口',
          click: () => {
            if (!mainWindow) return;
            if (mainWindow.isVisible()) mainWindow.hide();
            else {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: '始终置顶',
          type: 'checkbox',
          checked: isTop,
          click: (menuItem) => {
            if (mainWindow) {
              mainWindow.setAlwaysOnTop(menuItem.checked, 'floating', 1);
              mainWindow.webContents.send('always-on-top-changed', menuItem.checked);
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出软件',
          click: () => {
            saveWindowPosition();
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(contextMenu);
    };

    updateTrayMenu();

    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      updateTrayMenu();
    });
  } catch (e) {
    console.error('Failed to create tray:', e);
  }
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadSavedPosition() {
  try {
    const file = getWindowStatePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        const displays = screen.getAllDisplays();
        const onScreen = displays.some(d => {
          const b = d.bounds;
          return (
            data.x >= b.x - 100 &&
            data.x <= b.x + b.width - 50 &&
            data.y >= b.y - 50 &&
            data.y <= b.y + b.height - 50
          );
        });
        if (onScreen) {
          return { x: data.x, y: data.y };
        }
      }
    }
  } catch (e) {
    console.error('Failed to load window position:', e);
  }
  return null;
}

function saveWindowPosition() {
  if (!mainWindow) return;
  try {
    const [x, y] = mainWindow.getPosition();
    const file = getWindowStatePath();
    fs.writeFileSync(file, JSON.stringify({ x, y }), 'utf8');
  } catch (e) {
    console.error('Failed to save window position:', e);
  }
}

function createWindow() {
  // 默认启动时隐藏 Dock 栏图标（纯净桌面组件）
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  // 默认启动菜单栏图标
  createTray();

  const savedPos = loadSavedPosition();
  const windowOpts = {
    width: 360,
    height: 256,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  };

  if (savedPos) {
    windowOpts.x = savedPos.x;
    windowOpts.y = savedPos.y;
  }

  mainWindow = new BrowserWindow(windowOpts);

  let moveTimeout = null;
  mainWindow.on('moved', () => {
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(saveWindowPosition, 250);
  });

  mainWindow.on('close', () => {
    saveWindowPosition();
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC 通信：窗口置顶、大小、Dock、菜单栏与开机自启
// -------------------------------------------------------------
ipcMain.on('toggle-always-on-top', (event) => {
  if (!mainWindow) return;
  const isTop = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(isTop, 'floating', 1);
  if (mainWindow.setVisibleOnAllWorkspaces) {
    mainWindow.setVisibleOnAllWorkspaces(isTop, { visibleOnFullScreen: true });
  }
  event.reply('always-on-top-changed', isTop);
});

ipcMain.on('resize-window', (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

// 开机自启
ipcMain.handle('get-login-item-settings', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-login-item-settings', (event, openAtLogin) => {
  app.setLoginItemSettings({ openAtLogin: !!openAtLogin });
  event.reply('login-item-settings-changed', !!openAtLogin);
});

// Dock 栏显隐
ipcMain.handle('get-dock-status', () => {
  return app.dock ? app.dock.isVisible() : false;
});

ipcMain.on('set-dock-status', (event, show) => {
  if (process.platform === 'darwin' && app.dock) {
    if (show) app.dock.show();
    else app.dock.hide();
  }
  event.reply('dock-status-changed', show);
});

// 菜单栏显隐
ipcMain.on('set-tray-status', (event, show) => {
  if (show) createTray();
  else destroyTray();
  event.reply('tray-status-changed', show);
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
