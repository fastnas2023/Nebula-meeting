#!/bin/bash
set -e

# 定义目录
PROJECT_ROOT=$(pwd)
CLIENT_DIR="$PROJECT_ROOT/client"
SERVER_DIR="$PROJECT_ROOT/server"
RELEASE_DIR="$PROJECT_ROOT/release_temp"
OUTPUT_ZIP="$PROJECT_ROOT/nebula-meeting-baota.zip"

echo "🚀 开始构建宝塔部署包..."

# 1. 清理旧文件
rm -rf "$RELEASE_DIR"
rm -f "$OUTPUT_ZIP"
mkdir -p "$RELEASE_DIR"

# 2. 构建前端
echo "📦 构建前端 (Client)..."
cd "$CLIENT_DIR"
# 确保依赖已安装
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build

# 3. 准备后端文件
echo "📂 准备后端文件 (Server)..."
# 复制后端代码到临时目录
cp "$SERVER_DIR/package.json" "$RELEASE_DIR/"
cp "$SERVER_DIR/package-lock.json" "$RELEASE_DIR/"
cp "$SERVER_DIR/index.js" "$RELEASE_DIR/"
cp "$SERVER_DIR/healthcheck.js" "$RELEASE_DIR/"
cp "$SERVER_DIR/roleManager.js" "$RELEASE_DIR/"
cp "$SERVER_DIR/roles.json" "$RELEASE_DIR/"
# 复制 .env.example (如果存在)
if [ -f "$PROJECT_ROOT/.env.example" ]; then
    cp "$PROJECT_ROOT/.env.example" "$RELEASE_DIR/.env.example"
else
    # 创建一个基本的 .env 模板
    echo "PORT=5002
NODE_ENV=production
DATA_DIR=./data
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
MEETING_PASSWORD=" > "$RELEASE_DIR/.env.example"
fi

# 4. 整合静态资源
echo "🔗 整合前端资源到后端 public 目录..."
mkdir -p "$RELEASE_DIR/public"
cp -r "$CLIENT_DIR/dist/"* "$RELEASE_DIR/public/"

# 5. 创建数据目录
mkdir -p "$RELEASE_DIR/data"

# 6. 打包
echo "🗜️  正在压缩..."
cd "$RELEASE_DIR"
zip -r "$OUTPUT_ZIP" ./* .env.example

# 7. 清理
cd "$PROJECT_ROOT"
rm -rf "$RELEASE_DIR"

echo "✅ 部署包构建完成: $OUTPUT_ZIP"
echo "📝 请将此文件上传到宝塔服务器解压即可。"
