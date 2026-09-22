let ipcRenderer = null;
let os = null;
let fs = null;
try {
  const electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  os = require('os');
  fs = require('fs');
} catch (e) {
  console.log('Running in browser fallback mode');
}

// -------------------------------------------------------------
// 1. 5x7 点阵字体掩码（精准对齐设计图）
// -------------------------------------------------------------
const FONT_5X7 = {
  '0': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  '1': [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,1,1,0]
  ],
  '2': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,1,1,1,1]
  ],
  '3': [
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0]
  ],
  '4': [
    [0,0,0,1,0],
    [0,0,1,1,0],
    [0,1,0,1,0],
    [1,0,0,1,0],
    [1,1,1,1,1],
    [0,0,0,1,0],
    [0,0,0,1,0]
  ],
  '5': [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  '6': [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  '7': [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0]
  ],
  '8': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]
  ],
  '9': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [0,1,1,1,0]
  ]
};

// -------------------------------------------------------------
// 2. 主题调色盘色彩系统
// -------------------------------------------------------------
const THEMES = {
  dark: {
    bg: '#0e1011',
    lit: '#ececec',
    unlit: '#1c1f23',
    textMain: '#c8cdd3',
    textDim: '#5c636a',
    accent: '#d84a36'
  },
  matrix: {
    bg: '#081009',
    lit: '#48cf7a',
    unlit: '#121f14',
    textMain: '#7bc78f',
    textDim: '#3a5f45',
    accent: '#48cf7a'
  },
  amber: {
    bg: '#120d09',
    lit: '#e29b38',
    unlit: '#241a12',
    textMain: '#d8aa72',
    textDim: '#6a5038',
    accent: '#e29b38'
  },
  ice: {
    bg: '#090f14',
    lit: '#42b6d6',
    unlit: '#121f28',
    textMain: '#7db9cb',
    textDim: '#3c5a66',
    accent: '#42b6d6'
  },
  cyber: {
    bg: '#110912',
    lit: '#ce4d85',
    unlit: '#241324',
    textMain: '#cb7a9e',
    textDim: '#63384e',
    accent: '#ce4d85'
  }
};

let currentTheme = { ...THEMES.dark };

function applyTheme(themeObj) {
  currentTheme = { ...themeObj };
  const root = document.documentElement;
  root.style.setProperty('--bg-color', themeObj.bg);
  root.style.setProperty('--dot-lit', themeObj.lit);
  root.style.setProperty('--dot-unlit', themeObj.unlit);
  root.style.setProperty('--text-main', themeObj.textMain || '#c8cdd3');
  root.style.setProperty('--text-dim', themeObj.textDim || '#5c636a');
  root.style.setProperty('--accent', themeObj.accent || '#d84a36');

  // 保存至本地
  try {
    localStorage.setItem('pixel_clock_theme', JSON.stringify(themeObj));
  } catch (e) {}
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem('pixel_clock_theme');
    if (saved) {
      applyTheme(JSON.parse(saved));
      return;
    }
  } catch (e) {}
  applyTheme(THEMES.dark);
}

// -------------------------------------------------------------
// 3. Canvas Retina 2x 高清适配
// -------------------------------------------------------------
function setupRetinaCanvas(canvasId, logicalWidth, logicalHeight) {
  const canvas = document.getElementById(canvasId);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = logicalWidth + 'px';
  canvas.style.height = logicalHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

const clockSetup = setupRetinaCanvas('clockCanvas', 230, 65);
const clockCanvas = clockSetup.canvas;
const clockCtx = clockSetup.ctx;

const matrixSetup = setupRetinaCanvas('matrixCanvas', 72, 65);
const matrixCanvas = matrixSetup.canvas;
const matrixCtx = matrixSetup.ctx;

const DOT_SIZE = 7;
const DOT_GAP = 2;
const CELL_SIZE = DOT_SIZE + DOT_GAP; // 9px

let currentDigits = ['0', '0', '0', '0'];
let digitTransitions = [
  { from: '0', to: '0', progress: 1, startTime: 0 },
  { from: '0', to: '0', progress: 1, startTime: 0 },
  { from: '0', to: '0', progress: 1, startTime: 0 },
  { from: '0', to: '0', progress: 1, startTime: 0 }
];

// 绘制单点：精准还原原图的纯净哑光点阵面板质感（无强眩光晕影）
function drawDot(ctx, x, y, brightness, isLit) {
  if (isLit) {
    const alpha = Math.min(1, Math.max(0.15, brightness));
    ctx.fillStyle = currentTheme.lit;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = currentTheme.unlit;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  ctx.fillRect(x, y, DOT_SIZE, DOT_SIZE);
  ctx.globalAlpha = 1.0;
}

// 绘制 5x7 数字
function renderDigit(ctx, startX, startY, digitChar, transition) {
  const targetMatrix = FONT_5X7[digitChar] || FONT_5X7['0'];

  if (transition.progress >= 1) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        const isLit = targetMatrix[r][c] === 1;
        drawDot(ctx, startX + c * CELL_SIZE, startY + r * CELL_SIZE, 1, isLit);
      }
    }
  } else {
    const fromMatrix = FONT_5X7[transition.from] || FONT_5X7['0'];
    const p = transition.progress;

    for (let r = 0; r < 7; r++) {
      const rowDelay = (6 - r) * 0.08;
      const rowProgress = Math.min(1, Math.max(0, (p - rowDelay) / 0.5));

      for (let c = 0; c < 5; c++) {
        const fromLit = fromMatrix[r][c] === 1;
        const toLit = targetMatrix[r][c] === 1;

        let brightness = 1;
        let isLit = false;

        if (rowProgress < 0.5) {
          isLit = fromLit;
          brightness = 1 - rowProgress * 2;
        } else {
          isLit = toLit;
          brightness = (rowProgress - 0.5) * 2;
        }

        drawDot(ctx, startX + c * CELL_SIZE, startY + r * CELL_SIZE, brightness, isLit);
      }
    }
  }
}

// 绘制冒号
function renderColon(ctx, startX, startY, blinkState) {
  for (let r = 0; r < 7; r++) {
    const isColonDot = (r === 2 || r === 4);
    const isLit = isColonDot && blinkState;
    drawDot(ctx, startX, startY + r * CELL_SIZE, blinkState ? 1 : 0.2, isLit);
  }
}

// 绘制主时钟
function renderClockCanvas() {
  clockCtx.clearRect(0, 0, 230, 65);

  const startY = 1;
  let curX = 0;

  // 第1个字符
  renderDigit(clockCtx, curX, startY, currentDigits[0], digitTransitions[0]);
  curX += 5 * CELL_SIZE + CELL_SIZE;

  // 第2个字符
  renderDigit(clockCtx, curX, startY, currentDigits[1], digitTransitions[1]);
  curX += 5 * CELL_SIZE + CELL_SIZE;

  // 冒号
  const isSecondEven = Math.floor(Date.now() / 500) % 2 === 0;
  renderColon(clockCtx, curX, startY, isSecondEven);
  curX += CELL_SIZE + CELL_SIZE;

  // 第3个字符
  renderDigit(clockCtx, curX, startY, currentDigits[2], digitTransitions[2]);
  curX += 5 * CELL_SIZE + CELL_SIZE;

  // 第4个字符
  renderDigit(clockCtx, curX, startY, currentDigits[3], digitTransitions[3]);
}

// 右侧 8x8 动态矩阵
function renderDynamicMatrix() {
  matrixCtx.clearRect(0, 0, 72, 65);
  const now = Date.now();
  const t = now * 0.003;
  const startX = 0;
  const startY = 1;

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 8; c++) {
      const wave1 = Math.sin(c * 0.8 - r * 1.0 + t);
      const wave2 = Math.cos((c + r) * 0.6 - t * 1.4);
      const noise = (Math.sin(c * 13.98 + r * 79.23 + Math.floor(now / 160)) * 43758.5453) % 1;
      
      const intensity = (wave1 + wave2 + noise * 0.65);
      const isLit = intensity > 0.85;

      let brightness = 0;
      if (isLit) {
        brightness = Math.min(1, Math.max(0.25, (intensity - 0.85) * 1.8));
      }

      const x = startX + c * CELL_SIZE;
      const y = startY + r * CELL_SIZE;

      drawDot(matrixCtx, x, y, brightness, isLit);
    }
  }
}

// 更新时间
function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const targetChars = [hours[0], hours[1], minutes[0], minutes[1]];

  for (let i = 0; i < 4; i++) {
    if (currentDigits[i] !== targetChars[i]) {
      digitTransitions[i] = {
        from: currentDigits[i],
        to: targetChars[i],
        progress: 0,
        startTime: performance.now()
      };
      currentDigits[i] = targetChars[i];
    }
  }

  updateDateDisplay(now);
  updateActiveModuleData(now);
}

function updateTransitions(nowMs) {
  const DURATION = 380;
  for (let i = 0; i < 4; i++) {
    if (digitTransitions[i].progress < 1) {
      const elapsed = nowMs - digitTransitions[i].startTime;
      digitTransitions[i].progress = Math.min(1, elapsed / DURATION);
    }
  }
}

function updateDateDisplay(date) {
  const dateEl = document.getElementById('dateTimezone');
  if (!dateEl) return;
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();
  const tzOffset = -date.getTimezoneOffset() / 60;
  const tzStr = tzOffset >= 0 ? `+${tzOffset}` : `${tzOffset}`;
  dateEl.textContent = `${dayName}, ${monthName} ${dayNum} · CST ${tzStr}`;
}

// -------------------------------------------------------------
// 4. 模块系统管理
// -------------------------------------------------------------
const MODULES = [
  { id: 'modLife', name: '⏳ 时间人生进度', height: 256 },
  { id: 'modSys', name: '⚡ 系统性能监控', height: 278 },
  { id: 'modPomo', name: '🍅 番茄专注钟', height: 256 },
  { id: 'modWorld', name: '🌍 世界主要时钟', height: 256 },
  { id: 'modMarket', name: '📈 全球金融市场', height: 256 },
  { id: 'modMinimal', name: '⏱️ 极简纯钟模式', height: 136 }
];

let activeModuleIndex = 0;

function switchModule(index) {
  activeModuleIndex = (index + MODULES.length) % MODULES.length;
  const mod = MODULES[activeModuleIndex];

  // 切换 UI
  document.getElementById('currentModuleName').textContent = mod.name;
  document.querySelectorAll('.module-view').forEach(el => el.classList.remove('active'));
  const targetEl = document.getElementById(mod.id);
  if (targetEl) targetEl.classList.add('active');

  // 控制中间分割线与模块容器的显隐 (极简模式下隐藏底部)
  const midBar = document.getElementById('midBar');
  const modContainer = document.getElementById('moduleContainer');
  if (mod.id === 'modMinimal') {
    modContainer.style.display = 'none';
  } else {
    modContainer.style.display = 'flex';
  }

  // 调整窗口大小
  if (ipcRenderer) {
    ipcRenderer.send('resize-window', { width: 360, height: mod.height });
  }

  try {
    localStorage.setItem('pixel_clock_active_module', String(activeModuleIndex));
  } catch (e) {}

  updateActiveModuleData(new Date());
}

function loadSavedModule() {
  try {
    const saved = localStorage.getItem('pixel_clock_active_module');
    if (saved !== null) {
      activeModuleIndex = parseInt(saved, 10) || 0;
    }
  } catch (e) {}
  switchModule(activeModuleIndex);
}

// 像素进度条辅助生成器
function renderPixelBar(containerId, percent, totalSegments = 26) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const litCount = Math.round((percent / 100) * totalSegments);
  for (let i = 0; i < totalSegments; i++) {
    const cell = document.createElement('div');
    cell.className = `bar-cell ${i < litCount ? 'lit' : ''}`;
    container.appendChild(cell);
  }
}

// -------------------------------------------------------------
// 5. 各功能模块数据计算
// -------------------------------------------------------------
function updateActiveModuleData(now) {
  const mod = MODULES[activeModuleIndex];
  if (!mod) return;

  if (mod.id === 'modLife') {
    updateLifeProgress(now);
  } else if (mod.id === 'modSys') {
    updateSysMetrics();
  } else if (mod.id === 'modWorld') {
    updateWorldClocks(now);
  } else if (mod.id === 'modMarket') {
    updateMarketClocks(now);
  }
}

// 模块 1：人生与节日进度
function updateLifeProgress(now) {
  const year = now.getFullYear();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const totalDaysYear = isLeap ? 366 : 365;
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  const yearPercent = Math.min(100, Math.max(0, (dayOfYear / totalDaysYear) * 100));
  const yearDaysLeft = totalDaysYear - dayOfYear;

  const yLabel = document.getElementById('yearProgressLabel');
  const yLeft = document.getElementById('yearDaysLeft');
  if (yLabel) yLabel.textContent = `${year} 年进度: ${yearPercent.toFixed(1)}%`;
  if (yLeft) yLeft.textContent = `剩 ${yearDaysLeft} 天`;
  renderPixelBar('yearPixelBar', yearPercent, 26);

  // 月进度
  const month = now.getMonth();
  const totalDaysMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthPercent = Math.min(100, Math.max(0, (dayOfMonth / totalDaysMonth) * 100));
  const monthDaysLeft = totalDaysMonth - dayOfMonth;

  const mLabel = document.getElementById('monthProgressLabel');
  const mLeft = document.getElementById('monthDaysLeft');
  if (mLabel) mLabel.textContent = `${month + 1}月进度: ${monthPercent.toFixed(1)}%`;
  if (mLeft) mLeft.textContent = `剩 ${monthDaysLeft} 天`;
  renderPixelBar('monthPixelBar', monthPercent, 26);

  // 下一个节日
  const holidays = [
    { name: '元旦', month: 1, day: 1 },
    { name: '春节', month: 2, day: 17 },
    { name: '清明节', month: 4, day: 5 },
    { name: '劳动节', month: 5, day: 1 },
    { name: '端午节', month: 6, day: 19 },
    { name: '中秋节', month: 9, day: 25 },
    { name: '国庆节', month: 10, day: 1 },
    { name: '跨年夜', month: 12, day: 31 }
  ];

  const curMonth = now.getMonth() + 1;
  const curDay = now.getDate();
  let nextHoliday = null;
  let daysDiff = 9999;

  for (const h of holidays) {
    let targetDate = new Date(year, h.month - 1, h.day);
    if (targetDate < new Date(year, now.getMonth(), now.getDate())) {
      targetDate = new Date(year + 1, h.month - 1, h.day);
    }
    const diff = Math.ceil((targetDate - new Date(year, now.getMonth(), now.getDate())) / 86400000);
    if (diff >= 0 && diff < daysDiff) {
      daysDiff = diff;
      nextHoliday = { ...h, daysDiff: diff };
    }
  }

  const holiEl = document.getElementById('nextHolidayText');
  if (holiEl && nextHoliday) {
    const mm = String(nextHoliday.month).padStart(2, '0');
    const dd = String(nextHoliday.day).padStart(2, '0');
    holiEl.textContent = `${nextHoliday.name} · ${nextHoliday.daysDiff === 0 ? '今天!' : nextHoliday.daysDiff + '天后'} (${mm}-${dd})`;
  }
}

// 模块 2：系统性能监控
let lastCpuMeasure = null;
function updateSysMetrics() {
  if (!os) {
    // 浏览器模拟值
    renderPixelBar('cpuPixelBar', 22, 26);
    renderPixelBar('ramPixelBar', 58, 26);
    return;
  }

  // CPU 计算
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  let cpuPercent = 15;
  if (lastCpuMeasure) {
    const idleDiff = idle - lastCpuMeasure.idle;
    const totalDiff = total - lastCpuMeasure.total;
    if (totalDiff > 0) {
      cpuPercent = Math.min(100, Math.max(1, Math.round(100 - (idleDiff / totalDiff) * 100)));
    }
  }
  lastCpuMeasure = { idle, total };

  const cpuLabel = document.getElementById('cpuLabel');
  const cpuCores = document.getElementById('cpuCores');
  if (cpuLabel) cpuLabel.textContent = `CPU 占用率: ${cpuPercent}%`;
  if (cpuCores) cpuCores.textContent = `${cpus.length} Cores`;
  renderPixelBar('cpuPixelBar', cpuPercent, 26);

  // RAM 计算
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramPercent = Math.round((usedMem / totalMem) * 100);

  const ramLabel = document.getElementById('ramLabel');
  const ramDetail = document.getElementById('ramDetail');
  if (ramLabel) ramLabel.textContent = `内存占用: ${ramPercent}%`;
  if (ramDetail) ramDetail.textContent = `${(usedMem / 1073741824).toFixed(1)} / ${(totalMem / 1073741824).toFixed(1)} GB`;
  renderPixelBar('ramPixelBar', ramPercent, 26);

  // 磁盘剩余容量计算 (跨平台自适应)
  let diskPercent = 22;
  let diskFreeGB = '720.0';
  let diskTotalGB = '1000.0';
  const isWin = typeof process !== 'undefined' && process.platform === 'win32';
  const diskPath = isWin ? (process.env.SystemDrive || 'C:\\') : '/';
  const diskName = isWin ? `本地磁盘 (${process.env.SystemDrive || 'C:'})` : 'Macintosh HD';

  if (fs && fs.statfsSync) {
    try {
      const stats = fs.statfsSync(diskPath);
      const total = (stats.blocks * stats.bsize) / (1024**3);
      const free = (stats.bfree * stats.bsize) / (1024**3);
      const used = total - free;
      diskPercent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
      diskFreeGB = free.toFixed(1);
      diskTotalGB = total.toFixed(1);
    } catch (e) {}
  }
  const diskLabel = document.getElementById('diskLabel');
  const diskDetail = document.getElementById('diskDetail');
  if (diskLabel) diskLabel.textContent = `${diskName} 存储: ${diskPercent}%`;
  if (diskDetail) diskDetail.textContent = `剩 ${diskFreeGB} GB (共 ${diskTotalGB} GB)`;
  renderPixelBar('diskPixelBar', diskPercent, 26);

  // 运行时间
  const uptimeSec = os.uptime();
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const uptEl = document.getElementById('uptimeText');
  if (uptEl) uptEl.textContent = `${days}d ${hours}h ${Math.floor((uptimeSec % 3600) / 60)}m`;
}

// 模块 3：番茄专注钟
let pomoTimer = null;
let pomoSeconds = 25 * 60;
let pomoTotal = 25 * 60;
let pomoIsRunning = false;
let pomoMode = 'work'; // 'work' or 'break'

function initPomodoro() {
  const display = document.getElementById('pomoDisplay');
  const startBtn = document.getElementById('pomoStartBtn');
  const resetBtn = document.getElementById('pomoResetBtn');
  const modeBtn = document.getElementById('pomoModeBtn');

  function updatePomoUI() {
    const mins = String(Math.floor(pomoSeconds / 60)).padStart(2, '0');
    const secs = String(pomoSeconds % 60).padStart(2, '0');
    if (display) display.textContent = `${mins}:${secs}`;
    const pct = Math.round(((pomoTotal - pomoSeconds) / pomoTotal) * 100);
    renderPixelBar('pomoPixelBar', pct, 26);
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (pomoIsRunning) {
        clearInterval(pomoTimer);
        pomoIsRunning = false;
        startBtn.textContent = '▶ 继续';
      } else {
        pomoIsRunning = true;
        startBtn.textContent = '⏸ 暂停';
        pomoTimer = setInterval(() => {
          if (pomoSeconds > 0) {
            pomoSeconds--;
            updatePomoUI();
          } else {
            clearInterval(pomoTimer);
            pomoIsRunning = false;
            startBtn.textContent = '▶ 开始';
            alert(pomoMode === 'work' ? '🎉 番茄专注完成！休息一下吧。' : '⏰ 休息结束，准备开始下一轮专注！');
          }
        }, 1000);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      clearInterval(pomoTimer);
      pomoIsRunning = false;
      pomoSeconds = pomoTotal;
      if (startBtn) startBtn.textContent = '▶ 开始';
      updatePomoUI();
    });
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      clearInterval(pomoTimer);
      pomoIsRunning = false;
      if (pomoMode === 'work') {
        pomoMode = 'break';
        pomoTotal = 5 * 60;
        pomoSeconds = 5 * 60;
        modeBtn.textContent = '25m 专注';
      } else {
        pomoMode = 'work';
        pomoTotal = 25 * 60;
        pomoSeconds = 25 * 60;
        modeBtn.textContent = '5m 休息';
      }
      if (startBtn) startBtn.textContent = '▶ 开始';
      updatePomoUI();
    });
  }

  updatePomoUI();
}

// 模块 4：世界时钟
function updateWorldClocks(now) {
  const bj = getTimeInZone(now, 'Asia/Shanghai');
  const tk = getTimeInZone(now, 'Asia/Tokyo');
  const ld = getTimeInZone(now, 'Europe/London');

  const elBj = document.getElementById('worldTimeBeijing');
  const elTk = document.getElementById('worldTimeTokyo');
  const elLd = document.getElementById('worldTimeLondon');

  if (elBj) elBj.textContent = bj.timeStr;
  if (elTk) elTk.textContent = tk.timeStr;
  if (elLd) elLd.textContent = ld.timeStr;
}

// 模块 5：金融市场
function updateMarketClocks(now) {
  const shTime = getTimeInZone(now, 'Asia/Shanghai');
  const sseOpen = isMarketOpen(shTime, [
    { start: 9 * 60 + 30, end: 11 * 60 + 30 },
    { start: 13 * 60, end: 15 * 60 }
  ]);
  setMarketRow('sseStatus', 'sseTime', sseOpen, shTime);

  const hkTime = getTimeInZone(now, 'Asia/Hong_Kong');
  const hkexOpen = isMarketOpen(hkTime, [
    { start: 9 * 60 + 30, end: 12 * 60 },
    { start: 13 * 60, end: 16 * 60 }
  ]);
  setMarketRow('hkexStatus', 'hkexTime', hkexOpen, hkTime);

  const nyTime = getTimeInZone(now, 'America/New_York');
  const nyseOpen = isMarketOpen(nyTime, [
    { start: 9 * 60 + 30, end: 16 * 60 }
  ]);
  setMarketRow('nyseStatus', 'nyseTime', nyseOpen, nyTime);
}

function getTimeInZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = formatter.formatToParts(date);
  let hour = 0, minute = 0, weekday = 'Mon';
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }
  return { hour, minute, weekday, timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function isMarketOpen(timeObj, periods) {
  if (timeObj.weekday === 'Sat' || timeObj.weekday === 'Sun') return false;
  const curMin = timeObj.hour * 60 + timeObj.minute;
  return periods.some(p => curMin >= p.start && curMin < p.end);
}

function setMarketRow(statusId, timeId, isOpen, timeObj) {
  const statusEl = document.getElementById(statusId);
  const timeEl = document.getElementById(timeId);
  if (!statusEl || !timeEl) return;
  statusEl.textContent = isOpen ? 'OPEN' : 'CLOSED';
  statusEl.className = `market-status ${isOpen ? 'open' : 'closed'}`;
  timeEl.textContent = timeObj.timeStr;
}

// -------------------------------------------------------------
// 6. 设置抽屉与交互控制
// -------------------------------------------------------------
function initSettings() {
  const themeBtn = document.getElementById('themeBtn');
  const drawer = document.getElementById('settingsDrawer');
  const closeBtn = document.getElementById('closeSettingsBtn');

  if (themeBtn && drawer) {
    themeBtn.addEventListener('click', () => {
      drawer.classList.toggle('open');
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  }

  // 主题预设切换
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const themeKey = chip.getAttribute('data-theme');
      if (THEMES[themeKey]) {
        applyTheme(THEMES[themeKey]);
        document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('customBgColor').value = THEMES[themeKey].bg;
        document.getElementById('customLedColor').value = THEMES[themeKey].lit;
      }
    });
  });

  // 自定义颜色
  const bgPicker = document.getElementById('customBgColor');
  const ledPicker = document.getElementById('customLedColor');
  if (bgPicker) {
    bgPicker.addEventListener('input', (e) => {
      applyTheme({ ...currentTheme, bg: e.target.value });
    });
  }
  if (ledPicker) {
    ledPicker.addEventListener('input', (e) => {
      applyTheme({ ...currentTheme, lit: e.target.value, accent: e.target.value });
    });
  }

  // 模块默认配置
  const modSelect = document.getElementById('defaultModSelect');
  if (modSelect) {
    modSelect.value = String(activeModuleIndex);
    modSelect.addEventListener('change', (e) => {
      switchModule(parseInt(e.target.value, 10));
    });
  }

  // 系统常驻偏好配置 (开机自启、Dock栏、菜单栏)
  const autoLaunchToggle = document.getElementById('autoLaunchToggle');
  const dockToggle = document.getElementById('dockToggle');
  const trayToggle = document.getElementById('trayToggle');

  // Windows 平台专属文案自适应
  if (typeof process !== 'undefined' && process.platform === 'win32') {
    const dockLabel = document.getElementById('dockLabelText');
    if (dockLabel) dockLabel.textContent = '在 Windows 任务栏显示图标';
    const trayLabel = document.getElementById('trayLabelText');
    if (trayLabel) trayLabel.textContent = '在任务栏系统托盘显示图标';
  }

  if (ipcRenderer) {
    // 1. 开机自启
    if (autoLaunchToggle) {
      ipcRenderer.invoke('get-login-item-settings').then(openAtLogin => {
        autoLaunchToggle.checked = !!openAtLogin;
      }).catch(() => {});
      autoLaunchToggle.addEventListener('change', (e) => {
        ipcRenderer.send('set-login-item-settings', e.target.checked);
      });
    }

    // 2. Dock 栏显隐
    if (dockToggle) {
      ipcRenderer.invoke('get-dock-status').then(isDockVisible => {
        dockToggle.checked = !!isDockVisible;
      }).catch(() => {});
      dockToggle.addEventListener('change', (e) => {
        ipcRenderer.send('set-dock-status', e.target.checked);
      });
    }

    // 3. 菜单栏显隐
    if (trayToggle) {
      const savedTray = localStorage.getItem('pixel_clock_show_tray');
      trayToggle.checked = savedTray !== '0';
      trayToggle.addEventListener('change', (e) => {
        ipcRenderer.send('set-tray-status', e.target.checked);
        localStorage.setItem('pixel_clock_show_tray', e.target.checked ? '1' : '0');
      });
    }
  }
}

// 模块导航按钮
const prevBtn = document.getElementById('prevModuleBtn');
const nextBtn = document.getElementById('nextModuleBtn');
const nameBtn = document.getElementById('currentModuleName');

if (prevBtn) prevBtn.addEventListener('click', () => switchModule(activeModuleIndex - 1));
if (nextBtn) nextBtn.addEventListener('click', () => switchModule(activeModuleIndex + 1));
if (nameBtn) nameBtn.addEventListener('click', () => switchModule(activeModuleIndex + 1));

// 窗口原生控制
if (ipcRenderer) {
  const pinBtn = document.getElementById('pinBtn');
  const minBtn = document.getElementById('minBtn');
  const closeBtn = document.getElementById('closeBtn');

  if (pinBtn) {
    pinBtn.addEventListener('click', () => ipcRenderer.send('toggle-always-on-top'));
    ipcRenderer.on('always-on-top-changed', (e, isTop) => {
      pinBtn.classList.toggle('active', isTop);
      pinBtn.setAttribute('title', isTop ? '当前已始终置顶 (点击取消)' : '点击开启始终置顶');
    });
  }
  if (minBtn) minBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
  if (closeBtn) closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));
}

// -------------------------------------------------------------
// 7. 动画主循环与系统初始化
// -------------------------------------------------------------
function animationLoop(timeMs) {
  updateTransitions(timeMs);
  renderClockCanvas();
  renderDynamicMatrix();
  requestAnimationFrame(animationLoop);
}

// 初始化
loadSavedTheme();
loadSavedModule();
initPomodoro();
initSettings();
updateTime();
setInterval(updateTime, 1000);
requestAnimationFrame(animationLoop);
