const { app, BrowserWindow, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

function createTray() {
  if (tray) return;
  const isMac = process.platform === 'darwin';
  const iconPath = isMac 
    ? path.join(__dirname, '../assets/trayTemplate.png')
    : path.join(__dirname, '../assets/tray-win.png');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('像素时钟');

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

function snapToNearestEdge() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  if (!display) return;
  const workArea = display.workArea;

  const SNAP_THRESHOLD = 20; // 20px 屏幕边缘自动吸附阈值
  let newX = bounds.x;
  let newY = bounds.y;
  let snapped = false;

  // 左侧边缘吸附
  if (Math.abs(bounds.x - workArea.x) <= SNAP_THRESHOLD) {
    newX = workArea.x;
    snapped = true;
  }
  // 右侧边缘吸附
  else if (Math.abs((bounds.x + bounds.width) - (workArea.x + workArea.width)) <= SNAP_THRESHOLD) {
    newX = workArea.x + workArea.width - bounds.width;
    snapped = true;
  }

  // 顶部边缘吸附 (Mac 顶部状态栏下方 / Windows 顶部)
  if (Math.abs(bounds.y - workArea.y) <= SNAP_THRESHOLD) {
    newY = workArea.y;
    snapped = true;
  }
  // 底部边缘吸附 (Windows 任务栏正上方 / Mac Dock 栏正上方)
  else if (Math.abs((bounds.y + bounds.height) - (workArea.y + workArea.height)) <= SNAP_THRESHOLD) {
    newY = workArea.y + workArea.height - bounds.height;
    snapped = true;
  }

  if (snapped && (newX !== bounds.x || newY !== bounds.y)) {
    mainWindow.setPosition(newX, newY);
  }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  // 默认启动时隐藏 Dock 栏/任务栏图标（纯净桌面挂件组件）
  if (isMac && app.dock) {
    app.dock.hide();
  }

  // 默认启动系统托盘图标
  createTray();

  const savedPos = loadSavedPosition();
  const windowOpts = {
    width: 360,
    height: 232,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: isWin ? true : false,
    alwaysOnTop: false,
    skipTaskbar: isWin ? true : false,
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
    moveTimeout = setTimeout(() => {
      snapToNearestEdge();
      saveWindowPosition();
    }, 80);
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
    const isWin = process.platform === 'win32';
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display ? display.workArea : null;

    // 检查折叠/展开前是否紧贴屏幕底部任务栏
    const wasBottomSnapped = workArea && Math.abs((bounds.y + bounds.height) - (workArea.y + workArea.height)) <= 8;

    const targetW = Math.round(width);
    const targetH = Math.round(height);

    if (isWin) {
      mainWindow.setResizable(true);
    }

    if (wasBottomSnapped) {
      // 保持窗口底边紧贴任务栏向上/向下自适应折叠
      const newY = workArea.y + workArea.height - targetH;
      mainWindow.setBounds({ x: bounds.x, y: newY, width: targetW, height: targetH });
    } else {
      mainWindow.setSize(targetW, targetH);
    }

    if (isWin) {
      mainWindow.setResizable(false);
    }

    snapToNearestEdge();
    saveWindowPosition();
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

// Dock 栏 / 任务栏显隐
ipcMain.handle('get-dock-status', () => {
  if (process.platform === 'darwin' && app.dock) {
    return app.dock.isVisible();
  }
  if (mainWindow) {
    return !mainWindow.isSkipTaskbar();
  }
  return false;
});

ipcMain.on('set-dock-status', (event, show) => {
  if (process.platform === 'darwin' && app.dock) {
    if (show) app.dock.show();
    else app.dock.hide();
  } else if (mainWindow) {
    mainWindow.setSkipTaskbar(!show);
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
