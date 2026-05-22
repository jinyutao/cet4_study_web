#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

MODE="${1:-start}"
USERNAME="${2:-}"
NEW_PASS="${3:-}"

# ─── 当前用户 UID/GID（防止 Docker 创建的文件归属 root） ─
CURRENT_UID="$(id -u)"
CURRENT_GID="$(id -g)"

# ─── 帮助 ─────────────────────────────────────────
if [ "$MODE" = "--help" ] || [ "$MODE" = "-h" ] || [ "$MODE" = "help" ]; then
  echo ""
  echo "╔════════════════════════════════════════════════╗"
  echo "║        CET-4 背单词网站 — 管理脚本             ║"
  echo "╚════════════════════════════════════════════════╝"
  echo ""
echo "用法:"
echo "  bash start.sh                                   构建并启动服务"
echo "  bash start.sh [--test|-t]                       启动测试模式（50 词小数据库）"
echo "  bash start.sh build                             在容器内构建前端（改源码后刷新用）"
echo "  bash start.sh reset-password <用户名> [新密码]  重置用户密码"
echo "  bash start.sh fix-ownership                     修复 data/config/logs 所有权（容器创建的文件可能归属 root）"
echo "  bash start.sh --help                            显示此帮助"
echo ""
echo "常见操作流程:"
echo "  1. 首次部署:   bash start.sh"
echo "  2. 测试模式:   bash start.sh --test"
echo "  3. 改前端源码: bash start.sh build      # 然后刷新浏览器"
echo "  4. 管理用户:   bash start.sh reset-password zhangsan"
echo "  5. 文件所有权修复: bash start.sh fix-ownership"
  echo ""
  exit 0
fi

# ─── 启动模式 ────────────────────────────────────
if [ "$MODE" = "start" ]; then
  mkdir -p ./data ./config ./logs
  [ -f ./config/jwt_secret ] || openssl rand -base64 32 > ./config/jwt_secret

  # 尝试拉取基础镜像（如果 Docker Hub 不可达，使用国内镜像）
  if ! docker image inspect node:20-alpine >/dev/null 2>&1; then
    echo "正在拉取 node:20-alpine..."
    docker pull swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine 2>/dev/null && \
      docker tag swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine node:20-alpine || \
      echo "提示: 镜像拉取失败，尝试直接构建（Dockerfile 可能从其它源拉取）"
  fi

  docker compose -f docker/docker-compose.yml up -d --build
  docker compose -f docker/docker-compose.yml ps

  # 检查文件所有权
  if ls -la ./data ./config ./logs 2>/dev/null | grep -q '^[^d].*root ' 2>/dev/null || [ "$(stat -c '%u' ./data/cet4.db 2>/dev/null)" != "$(id -u)" ] 2>/dev/null; then
    echo "⚠️  volume 文件归属 root，当前用户无法写入" >&2
    echo "   请执行: bash start.sh fix-ownership" >&2
    exit 1
  fi

  echo "访问 http://$(hostname -I | awk '{print $1}'):9098"
  echo ""
echo "═══════════════════════════════════════════"
echo "  前端构建: bash start.sh build"
echo "  测试模式: bash start.sh --test"
echo "  密码重置: bash start.sh reset-password <用户名> [新密码]"
echo "  查看帮助: bash start.sh --help"
echo "═══════════════════════════════════════════"
  exit 0
fi

# ─── 前端构建（容器内，无需宿主机 Node.js） ──────
if [ "$MODE" = "build" ]; then
  IMG=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'cet4-web' | head -1)
  if [ -z "$IMG" ]; then
    echo "错误: cet4-web 镜像不存在，请先执行 bash start.sh 构建"
    exit 1
  fi
  echo "在容器内构建前端..."
  docker run --rm --user "$CURRENT_UID:$CURRENT_GID" -v "$(pwd):/workspace" -w /workspace "$IMG" npm run build:client
  echo "✅ 构建完成！刷新浏览器即可查看效果"
  exit 0
fi

# ─── 测试模式（50 词小数据库）────────────────────
if [ "$MODE" = "--test" ] || [ "$MODE" = "-t" ] || [ "$MODE" = "test" ]; then
  mkdir -p ./data ./config ./logs
  [ -f ./config/jwt_secret ] || openssl rand -base64 32 > ./config/jwt_secret

  if ! docker image inspect node:20-alpine >/dev/null 2>&1; then
    echo "正在拉取 node:20-alpine..."
    docker pull swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine 2>/dev/null && \
      docker tag swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-alpine node:20-alpine || \
      echo "提示: 镜像拉取失败，尝试直接构建（Dockerfile 可能从其它源拉取）"
  fi

  docker compose -f docker/docker-compose.yml -f docker/docker-compose.test.yml up -d --build
  echo "等待容器就绪..."
  sleep 3
  echo "创建测试数据库（50 词）..."
  docker exec cet4-web node cli/seed-test.js

  # 检查文件所有权
  if ls -la ./data ./config ./logs 2>/dev/null | grep -q '^[^d].*root ' 2>/dev/null || [ "$(stat -c '%u' ./data/cet4_test.db 2>/dev/null)" != "$(id -u)" ] 2>/dev/null; then
    echo "⚠️  volume 文件归属 root，当前用户无法写入" >&2
    echo "   请执行: bash start.sh fix-ownership" >&2
    exit 1
  fi
  docker compose -f docker/docker-compose.yml ps
  echo "访问 http://$(hostname -I | awk '{print $1}'):9098"
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  🧪 测试模式"
  echo "  测试账号: test / test123 (管理员)"
  echo "  单词数量: 50"
  echo "═══════════════════════════════════════════"
  exit 0
fi

# ─── 重置密码 ────────────────────────────────────
if [ "$MODE" = "reset-password" ]; then
  if [ -z "$USERNAME" ]; then
    echo "用法: bash start.sh reset-password <用户名> [新密码]"
    exit 1
  fi
  if ! docker ps --format '{{.Names}}' | grep -q '^cet4-web$'; then
    echo "错误: 容器未运行，请先执行 bash start.sh"
    exit 1
  fi
  if [ -z "$NEW_PASS" ]; then
    NEW_PASS="$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c12)"
    echo "生成随机密码: $NEW_PASS"
  fi
  docker exec --user "$CURRENT_UID:$CURRENT_GID" cet4-web node cli/reset-password.js "$USERNAME" "$NEW_PASS"
  echo "✅ 用户 '$USERNAME' 密码已重置: $NEW_PASS"
  exit 0
fi

# ─── 修复所有权 ────────────────────────────────────
if [ "$MODE" = "fix-ownership" ]; then
  echo "修复 data/ config/ logs/ 所有权为 $CURRENT_UID:$CURRENT_GID ..."
  sudo chown -R "$CURRENT_UID:$CURRENT_GID" ./data ./config ./logs 2>/dev/null && \
    echo "✅ 已修复" || \
    echo "⚠️ 修复失败（可能需要手动执行: sudo chown -R $CURRENT_UID:$CURRENT_GID data config logs）"
  exit 0
fi

# ─── 未知参数 ────────────────────────────────────
echo "错误: 未知命令 '$MODE'"
echo "用法: bash start.sh --help 查看帮助"
exit 1
