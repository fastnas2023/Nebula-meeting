# Nebula Meeting 部署指南 (Deployment Guide)

本文档详细介绍了 Nebula Meeting 的部署流程，包括 Docker 部署（推荐）和传统 Node.js 部署。

## 📋 目录 (Table of Contents)

1.  [环境准备 (Prerequisites)](#1-环境准备-prerequisites)
2.  [配置说明 (Configuration)](#2-配置说明-configuration)
3.  [部署方案 A: Docker Compose (推荐)](#3-部署方案-a-docker-compose-推荐)
4.  [部署方案 B: 手动 Docker 构建](#4-部署方案-b-手动-docker-构建)
5.  [部署方案 C: 传统 Node.js 部署](#5-部署方案-c-传统-nodejs-部署)
6.  [运维与监控 (Operations)](#6-运维与监控-operations)
7.  [常见问题 (Troubleshooting)](#7-常见问题-troubleshooting)

---

## 1. 环境准备 (Prerequisites)

### 必需环境
*   **Git**: 用于克隆代码。
*   **服务器**: 建议 2核 CPU / 4GB 内存以上 (WebRTC 编解码和 3D 背景需要一定资源)。

### 针对 Docker 部署
*   **Docker Engine**: 20.10+
*   **Docker Compose**: 2.0+

### 针对 Node.js 部署
*   **Node.js**: v18.0.0+ (推荐 v20 LTS)
*   **npm**: v9.0.0+

---

## 2. 配置说明 (Configuration)

在项目根目录下创建 `.env` 文件。你可以复制 `.env.example` (如果存在) 或使用以下模板：

```env
# 服务端口
PORT=5002

# 环境模式 (production / development)
NODE_ENV=production

# Agora (声网) 配置 - 视频通话必需
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate

# 会议安全 (可选)
# 设置后，所有会议都需要此密码才能加入
MEETING_PASSWORD=optional_meeting_password

# 数据持久化目录 (Docker 内部路径，通常无需修改)
DATA_DIR=/app/data
```

> **注意**: `AGORA_APP_ID` 和 `AGORA_APP_CERTIFICATE` 是必需的，否则视频通话功能将无法正常工作。请前往 [Agora Console](https://console.agora.io/) 获取。

---

## 3. 部署方案 A: Docker Compose (推荐)

这是最简单、最稳定的部署方式。

### 步骤

1.  **启动服务**
    ```bash
    docker-compose up -d
    ```

2.  **查看状态**
    ```bash
    docker-compose ps
    ```

3.  **查看日志**
    ```bash
    docker-compose logs -f
    ```

4.  **停止服务**
    ```bash
    docker-compose down
    ```

### 更新部署

如果代码有更新，执行以下命令平滑升级：

```bash
# 拉取最新代码
git pull

# 重新构建并启动 (Docker Compose 会智能重建变更部分)
docker-compose up -d --build
```

或者使用内置脚本：
```bash
./scripts/deploy.sh
```

---

## 4. 部署方案 B: 手动 Docker 构建

如果你需要手动控制镜像构建过程：

1.  **构建镜像**
    ```bash
    docker build -t freemeeting:latest .
    ```

2.  **运行容器**
    ```bash
    docker run -d \
      --name freemeeting-app \
      -p 5002:5002 \
      -v $(pwd)/data:/app/data \
      --env-file .env \
      freemeeting:latest
    ```

---

## 5. 部署方案 C: 传统 Node.js 部署

适用于没有 Docker 环境的服务器。

### 1. 构建前端
```bash
cd client
npm install
npm run build
# 构建产物将生成在 client/dist 目录
```

### 2. 准备后端
```bash
cd ../server
npm install --production
```

### 3. 整合静态资源
将前端构建产物复制到后端 `public` 目录，以便由 Express 服务器托管。
```bash
# 确保在项目根目录
mkdir -p server/public
cp -r client/dist/* server/public/
```

### 4. 启动服务
```bash
cd server
# 确保 .env 文件在 server 目录下，或者通过环境变量传入
export PORT=5002
export NODE_ENV=production
# ... 导出其他环境变量 ...

npm start
```
推荐使用 PM2 进行进程管理：
```bash
npm install -g pm2
pm2 start index.js --name "nebula-meeting"
```

---

## 6. 运维与监控 (Operations)

### 数据持久化
所有持久化数据（如角色配置、审计日志）存储在 `./data` 目录中。
*   `roles.json`: 角色权限配置。
*   `audit_logs.json`: 权限变更日志。

**建议**: 定期备份 `./data` 目录。

### 回滚策略 (Rollback)
如果使用 Docker 部署且保留了旧镜像：

```bash
# 查看历史镜像
docker images freemeeting

# 切换到指定 Tag
IMAGE_TAG=20231026_090000 docker-compose up -d
```

### 健康检查 (Healthcheck)
服务内置了健康检查接口：
*   URL: `http://localhost:5002/api/rooms`
*   Docker 内部检查脚本: `healthcheck.js`

---

## 7. 常见问题 (Troubleshooting)

**Q: 启动后无法访问页面？**
*   检查防火墙是否放行了端口 (默认 5002)。
*   检查 Docker 容器状态: `docker-compose ps`。
*   查看日志: `docker-compose logs -f`。

**Q: 视频无法连接？**
*   检查 `.env` 中的 `AGORA_APP_ID` 和 `AGORA_APP_CERTIFICATE` 是否正确。
*   确保服务器时间已同步。

**Q: 权限或文件传输失败？**
*   检查 `./data` 目录的写入权限。
*   如果是 Docker 部署，确保 volume 挂载正确。

**Q: Node.js 部署遇到 `EACCES: permission denied`?**
*   使用 `sudo` 运行命令，或修复目录权限：`sudo chown -R $USER:$USER .`。

**Q: Docker 遇到 `permission denied` connecting to socket?**
*   将当前用户加入 `docker` 组：`sudo usermod -aG docker $USER`，然后重新登录。

**Q: 面板部署 (宝塔/1Panel) 遇到 `ENOENT: process.cwd failed`?**
*   这是因为工作目录可能被重建。解决方法：`cd .. && cd server` 刷新目录上下文。
