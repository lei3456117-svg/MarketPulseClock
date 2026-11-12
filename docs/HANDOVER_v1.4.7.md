# 像素时钟桌面组件 (Market Pulse Clock) - 项目交接文档

## 1. 项目基础信息
- **软件名称**：像素时钟 (desktop-pixel-clock / Market Pulse Clock)
- **当前发布版本**：`v1.4.7`
- **本地工作区目录**：`/Users/depp/Antigravity/桌面软件创作`
- **代码仓库**：`https://github.com/lei3456117-svg/MarketPulseClock.git`
- **当前分支**：`main`（已完全同步并发布 GitHub Release v1.4.7）
- **本地安装程序**：`/Applications/像素时钟.app`

---

## 2. 最近关键版本演进记录

| 版本 | 关键特性与修复 |
| :--- | :--- |
| **v1.4.1** | 实现窗口固定在 macOS 桌面背景层，防止切换空间或点按壁纸时被系统侧边栏缩退挤出。 |
| **v1.4.2** | 1. 恢复 5×7 匀称点阵数字比例；<br>2. 底部重构为 4 行加粗音频 EQ 动态频谱波形；<br>3. 默认启用类似 macOS 日历小组件的半透明磨砂毛玻璃皮肤（Glassmorphism）；<br>4. 修复窗口拉大（> 260px）时 6 大子功能模块的自适应完整显示；<br>5. 引入移动即时写入 `window-state.json`，解决退出时位置丢失问题。 |
| **v1.4.3** | 增加多屏幕相对比例坐标映射与断开屏幕回退机制，以及实时屏幕热插拔监听。 |
| **v1.4.4** | 修复全局置顶导致遮挡前台软件的问题：默认为原生桌面小组件层级（不遮挡工作软件），保留标题栏 📌 图钉供用户随时手动切换强悬浮。 |
| **v1.4.5** | **实现多显示器独立档案机制（Display-Aware Profile）**：Mac 内置屏幕与各类外接显示器独立记录坐标档案，切换/拔插屏幕时自动秒切对应屏幕位置。 |
| **v1.4.6** | **合盖（Clamshell）外接单屏适配**：修复原生属性判断，禁止单屏状态下将外接 QHD/4K 屏误判为内置屏 `builtin` 导致坐标覆盖污染。 |
| **v1.4.7** | **副屏热插拔智能防移位与官网发布**：<br>1. 接入新副屏时仅做可见性校验，严禁移动主屏正常窗口；<br>2. 磁吸阈值缩减为 6px，保护 13~16px 原生黄金边距；<br>3. 官网 `docs/index.html` 与全平台安装包（Mac arm64/x64、Win nsis/portable）全面构建发布上线。 |

---

## 3. 核心技术架构与关键代码点

### 3.1 窗口与多屏自适应逻辑 (`electron/main.js`)
1. **多屏幕独立档案存储 (`displayProfiles`)**：
   - 配置文件位置：`~/Library/Application Support/desktop-pixel-clock/window-state.json`
   - 内置屏幕 Key 为 `builtin`，外接屏幕 Key 为 `external_{width}x{height}`。
   - 每次移动窗口 (`moved`) 时即时同步保存对应显示器的物理坐标与相对比例。
2. **插拔与屏幕热切换 (`switchDisplayProfile`)**：
   - 监听 `screen.on('display-removed')`、`'display-added'`、`'display-metrics-changed'`。
   - 当屏幕拔掉或切回笔记本屏幕时，自动调取 `builtin` 配置，恢复到日历小组件下方规范位置 `(13, 229)`，并受工作区边界硬约束（`ensureWindowVisible`）。
3. **桌面小组件行为约束**：
   - `alwaysOnTop: false`（默认不阻挡普通应用窗口）；
   - `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })`（跨桌面与全屏空间可见）；
   - `hiddenInMissionControl: true`（防侧滑缩退）。

### 3.2 渲染进程与 UI (`src/app.js` & `src/styles.css`)
1. **小组件模式 (164×164)**：
   - `clockCanvas`：142×42，经典 5×7 点阵（5.6px 步长，4.8px 方块），上下间距匀称；
   - `matrixCanvas`：142×24，25 根加粗频柱 × 4 行音频 EQ 跳动频谱，多重正弦波驱动；
   - 磨砂玻璃质感：`backdrop-filter: blur(28px) saturate(180%)`，透出壁纸纹理。
2. **标准展开模式 (360×232 / 360×260)**：
   - 拖拽放大（宽 > 260px）自动展开为 6 大功能模块（人生进度、系统监控、番茄钟、世界时钟、市场脉冲等）。

---

## 4. 常用维护与打包命令

```bash
# 1. 本地语法与状态检查
node -c electron/main.js
node -c src/app.js
git status

# 2. 快速热更新到本地安装的 App
pkill -f "像素时钟" || true
npx asar pack . /Applications/像素时钟.app/Contents/Resources/app.asar
open /Applications/像素时钟.app

# 3. 完整跨平台构建安装包 (electron-builder)
npm run dist:arm64   # 构建 macOS arm64 DMG
npm run dist:win     # 构建 Windows 安装包与便携版
```

---

## 5. 新对话开启后的接续建议
在开启新对话后，可以直接向 AI 发送：
> “请读取文档 `/Users/depp/Antigravity/桌面软件创作/docs/HANDOVER_v1.4.5.md`，基于当前已稳定发布的 v1.4.5 继续进行接下来的任务。”
