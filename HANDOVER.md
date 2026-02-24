# Kawaii Homepage 交接指南

如果你换了一台电脑，或者想把项目分享给别人继续开发，请按照这份指南操作。

## 1. 准备工作

### 必须的文件
确保你带走了整个项目文件夹，特别是：
*   `server.js` (后端逻辑)
*   `package.json` (依赖列表)
*   `.env` (**重要！** 里面有腾讯云密钥，不要弄丢，也不要发给不信任的人)
*   `data/profile.json` (你的最新数据)

### 环境要求
新电脑上需要安装：
*   **Node.js** (v14 以上)
*   **Git**

## 2. 快速启动 (Dev Setup)

在新电脑的终端进入项目目录，执行以下命令：

```bash
# 1. 安装依赖
npm install

# 2. 启动后端 (API 服务)
node server.js
# 后端会在 http://localhost:3000 运行

# 3. 启动前端 (新开一个终端窗口)
python3 -m http.server 8080
# 前端访问 http://localhost:8080
```

## 3. 给 AI 助手 (Trae) 的提示词

在新电脑上打开 Trae，直接发送下面这段话，它就能立刻理解项目架构并开始工作：

> **Hi Trae, 我正在维护一个名为 "Kawaii Homepage" 的全栈个人主页项目。**
>
> **项目架构：**
> *   **前端**：纯静态 HTML/CSS/JS，使用 Vue 3 (CDN) 和 Tailwind CSS (CDN)。核心文件是 `index.html` (展示页) 和 `editor.html` (编辑页)。
> *   **后端**：`server.js` (Node.js)，运行在 3000 端口，提供两个接口：
>     *   `POST /api/save`: 将 JSON 数据保存到本地 `data/profile.json` 文件。
>     *   `POST /api/upload`: 接收图片并上传到腾讯云 COS，返回 URL。
> *   **数据**：核心数据存储在 `data/profile.json` 中。
> *   **部署**：生产环境使用 Nginx 反向代理，`/api/` 转发给 Node 服务，`.json` 文件配置了 `no-store` 禁止缓存。
>
> **当前状态**：
> 我已经配置好了本地 `.env` 环境变量，项目可以在本地正常运行。请基于现有逻辑协助我继续优化功能。

---
*文档生成时间：2026-02-10*
