#!/bin/bash
set -u
APP_NAME="像素时钟.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

candidates=(
  "/Applications/${APP_NAME}"
  "${SCRIPT_DIR}/${APP_NAME}"
  "${HOME}/Applications/${APP_NAME}"
  "${HOME}/Desktop/${APP_NAME}"
  "${HOME}/Downloads/${APP_NAME}"
)

resolve_app() {
  local path
  for path in "${candidates[@]}"; do
    if [ -d "$path" ]; then
      printf '%s\n' "$path"
      return 0
    fi
  done
  return 1
}

echo "══════════════════════════════════════"
echo "  像素时钟 · 解除 macOS 无法验证开发者限制"
echo "══════════════════════════════════════"
echo ""

APP_PATH="$(resolve_app || true)"

if [ -z "${APP_PATH:-}" ]; then
  echo "未在「应用程序」中找到 ${APP_NAME}。"
  echo "请先将 像素时钟.app 拖入「应用程序」后再次双击运行本脚本。"
  echo ""
  read -r -p "按回车退出..."
  exit 1
fi

echo "目标应用: ${APP_PATH}"
echo "正在解除 Gatekeeper 拦截..."
xattr -cr "$APP_PATH"
echo ""
echo "✅ 解除完成！正在启动 像素时钟..."
open "$APP_PATH" 2>/dev/null || true
echo ""
read -r -p "按回车退出窗口..."
