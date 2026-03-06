# Nebula Meeting (星云会议)

Nebula 是一个基于 WebRTC 的下一代即时会议平台，提供高质量的视频通话、屏幕共享、实时聊天和文件传输功能。项目采用现代化的技术栈，结合了 React 前端与 Node.js 后端，并集成了令人惊叹的 3D 交互式背景。

## ✨ 主要特性

*   **多模式会议支持**：
    *   **WebRTC (P2P)**: 适合小型会议，低延迟，支持 4K 屏幕共享。
    *   **Jitsi Meet**: 适合大型会议，功能丰富。
    *   **Agora (声网)**: 企业级稳定性与全球低延迟支持。
*   **沉浸式体验**: 基于 Three.js 的高性能 3D 粒子波浪背景 ("Electric Wave")。
*   **安全可靠**: 支持房间密码保护、管理员强制关闭房间。
*   **协作工具**:
    *   实时文字聊天。
    *   P2P 文件传输（支持拖拽发送）。
    *   屏幕共享（支持音频共享）。
*   **现代化 UI**: 响应式设计，支持暗色模式，Apple 风格的毛玻璃交互元素。

## 🛠 技术栈

*   **Frontend**: React 18, Vite, Tailwind CSS, Three.js (@react-three/fiber), Socket.io-client
*   **Backend**: Node.js, Express, Socket.io
*   **Protocols**: WebRTC, WebSocket

---

## 🚀 部署指南

本指南将帮助您在本地开发环境或生产服务器上部署 Nebula Meeting。

### 📋 环境要求

*   **Node.js**: v18.0.0 或更高版本
*   **npm**: v9.0.0 或更高版本
*   **Git**

### 💻 本地开发 (Development)

1.  **克隆仓库**
    ```bash
    git clone https://github.com/fastnas2023/freemeeting.git
    cd freemeeting
    ```

2.  **安装依赖**
    分别安装前端和后端的依赖：
    ```bash
    # 安装服务端依赖
    cd server
    npm install

    # 安装客户端依赖
    cd ../client
    npm install
    ```

3.  **启动开发服务**
    您需要同时启动后端信令服务器和前端开发服务器。

    *   **终端 1 (Server)**:
        ```bash
        cd server
        npm start
        # 服务器将运行在 http://localhost:5002
        ```

    *   **终端 2 (Client)**:
        ```bash
        cd client
        npm run dev
        # 客户端将运行在 http://localhost:5173
        ```

4.  **访问应用**
    打开浏览器访问 `http://localhost:5173`。

---

### 🌐 生产环境部署 (Production)

详细的生产环境部署指南（包括 Docker 和 Node.js 部署）请参阅 [DEPLOY.md](DEPLOY.md)。

我们强烈推荐使用 **Docker Compose** 进行部署，简单快捷且环境一致。

```bash
# 快速开始 (Docker Compose)
cp .env.example .env  # 如果没有 .env.example，请手动创建并配置
docker-compose up -d
```

## 🤝 贡献
欢迎提交 Issue 和 Pull Request！

## 📄 许可证
MIT License
