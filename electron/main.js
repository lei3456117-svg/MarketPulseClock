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
      return data;
    }
  } catch (e) {
    console.error('Failed to load window position:', e);
  }
  return null;
}

function saveWindowState(extra = {}) {
  if (!mainWindow) return;
  try {
    const [x, y] = mainWindow.getPosition();
    const bounds = mainWindow.getBounds();
    const file = getWindowStatePath();
    let current = {};
    if (fs.existsSync(file)) {
      try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){}
    }
    const merged = { ...current, x, y, width: bounds.width, height: bounds.height, ...extra };
    fs.writeFileSync(file, JSON.stringify(merged), 'utf8');
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function saveWindowPosition() {
  saveWindowState();
}

function snapToNearestEdge() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  if (!display) return;
  const workArea = display.workArea;

  const SNAP_THRESHOLD = 12; // 降低吸附吸力阈值，避免拖拽时像磁铁一样拖不动
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

  const savedState = loadSavedPosition();
  const defaultMode = (savedState && savedState.sizeMode) ? savedState.sizeMode : 'widget';
  const defaultW = defaultMode === 'widget' ? 164 : (savedState && savedState.width ? savedState.width : 360);
  const defaultH = defaultMode === 'widget' ? 164 : (savedState && savedState.height ? savedState.height : 232);
  const defaultPin = (savedState && typeof savedState.alwaysOnTop === 'boolean') ? savedState.alwaysOnTop : true; // 默认像 macOS 小组件一样常驻桌面

  const windowOpts = {
    width: defaultW,
    height: defaultH,
    minWidth: 140,
    minHeight: 140,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    alwaysOnTop: defaultPin,
    skipTaskbar: isWin ? true : false,
    hiddenInMissionControl: isMac ? true : false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  };

  if (savedState && typeof savedState.x === 'number' && typeof savedState.y === 'number') {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some(d => {
      const b = d.bounds;
      return (
        savedState.x >= b.x - 100 &&
        savedState.x <= b.x + b.width - 50 &&
        savedState.y >= b.y - 50 &&
        savedState.y <= b.y + b.height - 50
      );
    });
    if (onScreen) {
      windowOpts.x = savedState.x;
      windowOpts.y = savedState.y;
    }
  }

  mainWindow = new BrowserWindow(windowOpts);

  if (defaultPin) {
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
  }

  // 在 macOS 上将窗口设为所有工作区可见并在全屏时显示，同时固定在桌面上不被台前调度/点按壁纸挤开
  if (isMac && mainWindow.setVisibleOnAllWorkspaces) {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  }

  let moveTimeout = null;
  mainWindow.on('moved', () => {
    // 立即保存当前位置到磁盘，杜绝退出/关机后位置丢失
    saveWindowPosition();
    clearTimeout(moveTimeout);
    // 增加防抖延迟至 350ms，确保用户松开鼠标停止拖拽后才吸附边缘
    moveTimeout = setTimeout(() => {
      snapToNearestEdge();
      saveWindowPosition();
    }, 350);
  });

  let resizeTimeout = null;
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      saveWindowPosition();
      if (mainWindow) {
        const [w, h] = mainWindow.getSize();
        mainWindow.webContents.send('window-resized', { width: w, height: h });
      }
    }, 100);
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
  saveWindowState({ alwaysOnTop: isTop });
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

    if (wasBottomSnapped) {
      // 保持窗口底边紧贴任务栏向上/向下自适应折叠
      const newY = workArea.y + workArea.height - targetH;
      mainWindow.setBounds({ x: bounds.x, y: newY, width: targetW, height: targetH });
    } else {
      mainWindow.setSize(targetW, targetH);
    }

    snapToNearestEdge();
    saveWindowPosition();
  }
});

ipcMain.on('save-size-mode', (event, mode) => {
  saveWindowState({ sizeMode: mode });
});

ipcMain.handle('get-saved-state', () => {
  return loadSavedPosition();
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
