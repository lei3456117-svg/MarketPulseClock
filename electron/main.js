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
    const display = screen.getDisplayMatching(bounds);
    const file = getWindowStatePath();
    let current = {};
    if (fs.existsSync(file)) {
      try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){}
    }

    // 计算相对所在屏幕的位置比例 (自适应多屏/切换主屏/拔插外接屏)
    let displayInfo = null;
    if (display) {
      const wa = display.workArea;
      const relX = (x - wa.x) / (wa.width > 0 ? wa.width : 1);
      const relY = (y - wa.y) / (wa.height > 0 ? wa.height : 1);
      displayInfo = {
        id: display.id,
        bounds: display.bounds,
        workArea: wa,
        relX: Math.max(0, Math.min(1, relX)),
        relY: Math.max(0, Math.min(1, relY))
      };
    }

    const merged = {
      ...current,
      x,
      y,
      width: bounds.width,
      height: bounds.height,
      displayInfo,
      ...extra
    };
    fs.writeFileSync(file, JSON.stringify(merged), 'utf8');
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

// 屏幕变动/插拔自适应约束：确保窗口始终在可视区域内
function ensureWindowVisible(savedState = null) {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const displays = screen.getAllDisplays();
  if (displays.length === 0) return;

  // 1. 尝试找到当前最匹配的显示器
  let targetDisplay = screen.getDisplayMatching(bounds);
  const isTargetValid = displays.some(d => d.id === targetDisplay.id);

  if (!isTargetValid) {
    // 原显示器已断开，回退到主显示器
    targetDisplay = screen.getPrimaryDisplay();
  }

  const wa = targetDisplay.workArea;
  let targetX = bounds.x;
  let targetY = bounds.y;

  // 如果原本窗口完全不在任何屏幕的合理可见区，或者传入了带相对坐标的 savedState
  const isVisibleOnAny = displays.some(d => {
    const b = d.bounds;
    return (
      bounds.x + bounds.width > b.x + 30 &&
      bounds.x < b.x + b.width - 30 &&
      bounds.y + bounds.height > b.y + 30 &&
      bounds.y < b.y + b.height - 30
    );
  });

  if (!isVisibleOnAny) {
    if (savedState && savedState.displayInfo && typeof savedState.displayInfo.relX === 'number') {
      // 用比例映射到当前屏幕
      targetX = Math.round(wa.x + savedState.displayInfo.relX * wa.width);
      targetY = Math.round(wa.y + savedState.displayInfo.relY * wa.height);
    } else {
      // 默认安全位置：屏幕左侧（偏向小组件常驻区域）
      targetX = wa.x + 16;
      targetY = wa.y + 36;
    }
  }

  // 刚性边界约束：确保窗口 100% 完整落在 targetDisplay 的 workArea 内部
  const maxX = wa.x + wa.width - bounds.width;
  const maxY = wa.y + wa.height - bounds.height;
  const clampedX = Math.max(wa.x, Math.min(maxX, targetX));
  const clampedY = Math.max(wa.y, Math.min(maxY, targetY));

  if (clampedX !== bounds.x || clampedY !== bounds.y) {
    mainWindow.setPosition(clampedX, clampedY);
    saveWindowState();
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
  const defaultPin = (savedState && typeof savedState.alwaysOnTop === 'boolean') ? savedState.alwaysOnTop : false; // 默认像桌面日历小组件一样固定在桌面底层，不遮挡日常软件

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
    hiddenInMissionControl: isMac ? true : false, // 防止点按桌面壁纸显示桌面时时钟被系统挤出屏幕
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  };

  if (savedState && typeof savedState.x === 'number' && typeof savedState.y === 'number') {
    const displays = screen.getAllDisplays();
    // 寻找保存坐标落在哪台已连接显示器内
    const matchedDisplay = displays.find(d => {
      const b = d.bounds;
      return (
        savedState.x >= b.x - 20 &&
        savedState.x <= b.x + b.width - 40 &&
        savedState.y >= b.y - 20 &&
        savedState.y <= b.y + b.height - 40
      );
    });

    if (matchedDisplay) {
      // 屏幕依然存在，直接恢复
      windowOpts.x = savedState.x;
      windowOpts.y = savedState.y;
    } else {
      // 外接屏已断开或坐标越界，自适应映射到当前主屏
      const primary = screen.getPrimaryDisplay();
      const pwa = primary.workArea;
      if (savedState.displayInfo && typeof savedState.displayInfo.relX === 'number') {
        windowOpts.x = Math.round(pwa.x + savedState.displayInfo.relX * (pwa.width - defaultW));
        windowOpts.y = Math.round(pwa.y + savedState.displayInfo.relY * (pwa.height - defaultH));
      } else {
        windowOpts.x = pwa.x + 16;
        windowOpts.y = pwa.y + 36;
      }
    }
  }

  mainWindow = new BrowserWindow(windowOpts);
  ensureWindowVisible(savedState);

  if (defaultPin) {
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
  } else {
    mainWindow.setAlwaysOnTop(false);
  }

  // 在 macOS 上固定在桌面上：所有桌面空间可见、全屏空间可见，且不被台前调度/点按壁纸挤开
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
  if (isTop) {
    mainWindow.setAlwaysOnTop(true, 'floating', 1);
  } else {
    mainWindow.setAlwaysOnTop(false);
  }
  if (mainWindow.setVisibleOnAllWorkspaces) {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
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

  // 监听显示器拔插与分辨率变动事件，动态自适应纠偏窗口
  screen.on('display-removed', () => {
    ensureWindowVisible();
  });
  screen.on('display-added', () => {
    ensureWindowVisible();
  });
  screen.on('display-metrics-changed', () => {
    ensureWindowVisible();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
