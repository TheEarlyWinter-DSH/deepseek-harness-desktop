# DeepSeek Harness Desktop

把官方 [@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）封装成开箱即用、轻量纯粹的 Windows 专属桌面客户端。

- ✅ **免安装 Node**：内置独立的 Node 运行时与 npm CLI，目标机器无需安装 Node.js
- ✅ **内置 dsh CLI**：完整打包 `@deepseek-ai/dsh` 及其核心组件，离线可用
- ✅ **一键启动**：双击即启动 `dsh web`，自动挑选空闲端口，就绪后加载到原生窗口
- ✅ **风格化无边框窗口**：无原生标题栏/菜单栏，自绘 36px 玻璃栏（专属图标 + 拖拽 + ⋯ 菜单 + 窗口控制），Win11 原生圆角；保留快捷键 Ctrl+R / F12 / F11
- ✅ **系统托盘常驻**：点关闭默认最小化到托盘（可设置），托盘菜单提供快速显示/退出
- ✅ **退出即清理**：退出应用自动结束 dsh 进程树，不留孤儿进程
- ✅ **便携绿色版**：数据与日志随心管理，拷到移动硬盘或任意目录即可运行
- ✅ **与 CLI 共享配置**：默认沿用 dsh 自身的 `DSH_HOME`（通常是 `~\.dsh`），已有会话与 API Key 直接生效
- ✅ **跟随官方更新**：官方 `@deepseek-ai/dsh` 发新版时弹窗提醒，经确认后自动下载安装，重启生效，失败自动保留旧版
- ✅ **快捷方式自动维护**：首次运行自动维护开始菜单快捷方式，支持系统级通知，exe 移动后自动纠正
- ✅ **文件更改追踪 + 一键还原**：详情面板「文件」标签页，聚合本会话 agent 修改过的全部文件（新建/修改/删除、行级 diff、逐文件或全部还原）
- ✅ **项目文件树与站内预览**：「文件」标签页提供层级文件树与站内 HTML/端口实时预览
- ✅ **会话内终端**：「终端」标签页内置持久 PowerShell shell，支持流式输出、命令历史、清屏与断线重连
- ✅ **会话完成系统通知**：Agent 任务跑完时弹 Windows 系统通知，点击回到窗口
- ✅ **界面皮肤切换**：设置页「皮肤」标签页内置多款精美 Web UI 皮肤，互斥切换、重启生效
- ✅ **极简纯粹**：剔除冗余插件，专注高效编程与纯净体验

## 快速运行与构建

### 运行环境要求
- Windows 10 / 11 (x64)
- Node.js (仅开发与构建时需要) + npm

### 开发与打包命令

```powershell
# 1. 安装依赖
npm install

# 2. 准备内置 Node 与 npm 运行时
npm run fetch-runtime

# 3. 本地开发调试运行
npm start

# 4. 快速构建免安装目录包（输出到 dist/win-unpacked/）
npm run pack

# 5. 构建完整 Windows 便携版 / 安装包
npm run dist
```

## 核心架构设计

```
┌──────────────────────────────────────────────────────────┐
│  Electron 壳层 (main.js)                                 │
│  · 单实例锁 / 窗口生命周期 / 托盘管理                     │
│  · 会话完成监听 (session-watcher.js) → 系统通知            │
│  · 官方内核更新 (updater.js) → 用户同意后安装 overlay     │
│  · 进程树生命周期托管与优雅退出                           │
└──────────────┬───────────────────────────────────────────┘
               │  dsh web --host 127.0.0.1 --port 0
               ▼
       内置 node.exe + @deepseek-ai/dsh
       路径解析：用户目录 overlay > 内置包
       输出 "dsh web: http://127.0.0.1:<port>"
               │  解析 URL，轮询 HTTP 200
               ▼
       原生窗口加载 Web UI（仅本机回环访问）
```

| 架构决策 | 设计原因 |
| --- | --- |
| `asar: false` | dsh 依赖 sharp / node-pty / koffi 等原生二进制模块，必须以真实文件落盘加载 |
| 内置独立 node.exe + npm | 预编译原生模块 ABI 与 Node 版本严格绑定。内置运行时保证完全一致且开箱即用 |
| `npmRebuild: false` | 绝不为 Electron 重编译原生模块，保证内置独立 node.exe 稳定调用 |
| `--port 0` 动态分配 | 由操作系统分配空闲端口，彻底杜绝端口冲突；仅回环绑定（127.0.0.1）保证安全 |
| 退出时进程树清理 | dsh 会派生 powershell 等子进程，退出时由桌面壳统一回收，不占系统资源 |
| Overlay 增量更新 | 官方内核更新安装在用户目录 `agent` overlay 层，原程序目录不受污染且支持秒级回滚 |

## 目录结构

```
dsh-desktop/
├── main.js               # Electron 主进程（窗口、托盘、自绘标题栏 IPC、快捷方式维护）
├── updater.js            # @deepseek-ai/dsh 官方内核更新引擎（npm view 检查 / overlay 安装）
├── session-watcher.js    # 会话完成监听（zstd 多帧解码 + turn/end 检测）
├── preload.js            # 预加载脚本（自绘玻璃标题栏、窗口控制、菜单 IPC）
├── preset-sync.js        # 预设同步与初始化
├── profile-module-heal.js# 模块阴影修复与环境自愈
├── patch-row-heal.js     # profile patch 配置管理与插件行维护
├── assets/               # 静态资源、加载动画、图标、配套插件
│   ├── icon.ico          # 多分辨率专属 Windows 图标
│   ├── plugins/          # 核心配套插件（文件追踪、终端、皮肤切换、移动端修复等）
│   └── skins/            # 内置主题皮肤包
├── scripts/
│   ├── fetch-node.js     # 内置 node.exe 拉取与复制
│   ├── fetch-npm.js      # 内置 npm CLI 拉取与复制
│   └── after-pack.js     # 构建后处理（npm 依赖补全、图标注入、冗余清理）
├── test/                 # 自动化单元测试套件
└── electron-builder.yml  # 打包配置文件
```

## 许可证

本项目基于 MIT License 开源。内置第三方组件遵循各自开源协议。
