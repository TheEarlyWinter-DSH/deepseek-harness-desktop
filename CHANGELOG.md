# Changelog — DeepSeek Harness Desktop

DeepSeek Harness（dsh）的零配置 Windows 桌面发行版：内置独立 Node 运行时、
dsh CLI、桌面工作流与配套插件。

## [2.6.0] — 2026-08-19

### 新增功能（移植自社区配套插件）
- **自动压缩（dsh-auto-compact）**：监听会话 contextPressure 投影，接近上下文上限（默认 80%，可调）时自动发送 /compact，长对话不再撑爆上下文。
- **字体自定义（dsh-font-custom）**：设置页直接调整界面字体家族、字号与文字/代码颜色，实时预览、localStorage 持久化。
- **临时会话（dsh-side-session）**：独立悬浮窗，自动导入当前主对话上下文，发起不污染主会话的临时追问。
- **消息倒带（dsh-message-rewind）**：Trae 风格对话回退，编辑任意已发送消息并从该点重新生成。
- **撤销保存点（dsh-undo-savepoint）**：配置文件变更时自动快照，支持从 Web UI 或聊天内撤销/回滚。
- **第三方模型思考强度（dsh-third-party-thinking）**：为未声明推理能力的 OpenAI 兼容第三方模型注入 off/high/max 思考强度控件。
- **文件拖放（dsh-file-drop）**：把本地文件直接拖入对话输入框，文本自动注入，图片/二进制文件注入路径提示。
- **图片粘贴（dsh-image-paste）**：Ctrl/Cmd+V 粘贴剪贴板图片，自动保存到临时目录并注入路径提示。
- **对话节点导航条（dsh-navbar）**：user 消息快速跳转导航条。

### 桌面壳改进
- 新增 `dsh:image-paste-save` IPC handler 和 `imagePasteSave` 函数，支持图片粘贴的受控文件保存。
- preload 桥暴露 `imagePaste.save` 和 `getPathForFile` 方法。
- 依赖新增 `schemastery`（为 dsh-side-session 提供设置校验）。
- 插件复制逻辑支持 `index.mjs` 入口文件。

## [2.5.0] — 2026-08-18

### 新增功能
- **独立会话分屏浮窗（Float Window）**：支持将单个会话弹出为无边框轻量浮窗（`chrome:float-window`），使用独立 session partition（`persist:dsh-float`）隔离 UI 状态与 localStorage，并内置优雅无边框迷你拖拽栏（`FLOAT_BAR`），支持最多 8 个多会话并排与分屏对照。
- **全量配置备份与原子恢复（Desktop Backup & Restore）**：新增 `desktop-backup.js` 模块与 `dsh:backup-export` / `dsh:backup-restore` IPC 契约，支持将 profile 与全局配置完整打包为防逃逸 JSON 文件；恢复时具备符号链接安全防写穿、两阶段令牌校验与自动回滚快照保护机制。

## [2.4.0] — 2026-08-18

### 新增与核心升级
- **会话监视器 v2（SessionWatcher v2）**：彻底重构为 `fs.watch` 事件驱动架构，配合 10s 兜底 stat 与 30s 目录巡检，增量解压 zstd 帧并在损坏帧前自动滑动容错。稳态 CPU 占用降低 75%，Agent 任务完成触发毫秒级原生系统通知。
- **渲染进程崩溃自愈引擎（RendererRecovery & Watchdog）**：多级自恢复状态机解决 0xC0000005 崩溃与白屏卡死问题。实现指数退避静默重载、连续第 3 次崩溃主窗口销毁重建、超限优雅回退本地内置错误恢复页（`recovery.html`），并由独立轻量 Node 看门狗守护主进程。
- **实时用量与账户余额监控（Balance & Token Cost）**：底栏实时显示「本轮费用 · 账户余额」，精准适配 DeepSeek 2026-08-17 起实施的官方峰谷分时电价计算（高峰 9-12/14-18 点全价，低谷半价），并支持 OpenCode Go 5 小时滚动/每周/每月订阅配额监控。
- **客户端双源自更新引擎（ClientUpdater）**：支持 GitHub 与 Gitee Releases 双源在线检查与一键升级，便携版支持进程外独立 cmd 脚本原地备份与热替换，自动感知系统 `HTTPS_PROXY` / `HTTP_PROXY` 企业代理。
- **插件安全保护中心（PluginGuard）**：在插件安装前自动创建 profile 声明性配置快照（秒级备份），内置静态木马模式正则扫描（拦截远程下载执行、Base64 Eval、注册表持久化注入），支持一键秒级回滚。
- **官方宣发落地页（Landing Page）**：新增 `landing/index.html` 暗黑玻璃科技风宣传单页，展示 5 款复古皮肤、自愈机制与特性矩阵。

## [2.3.1] — 2026-08-18

### 修复与自愈
- **插件加载自愈机制（Self-Healing）**：启动前自动探测 `cordis.patch.yml` 中激活插件的模块完整性（递归解析 `exports` / `main` / `lib` 入口文件），若缺少模块或未编译自动在配置层将其置为 `disabled: true`，彻底消除由于坏插件或未构建半成品导致的启动崩溃白屏循环（退出码 1）。
- **非破坏性安全防护**：自愈机制只在配置层安全降级，不执行任何硬编码物理文件删除，保护本地开发中的插件源码。
- **YAML 语法层级维护**：重构 patch 配置行状态机，在注入或修改 `disabled: true` 时精准定位层级，绝不破坏插件自定义 `config` 字典与语法树结构。

## [2.3.0] — 2026-08-16

### 新增
- **首次启动向导**：检测 DSH 内核、默认模型和凭据文件状态；集中设置通知、托盘偏好和新会话默认权限。
- **三档默认权限**：向导直接写入 DSH `settings.yaml` 的 `permission.defaultPreset`，支持 `read-only`、`workspace-write` 和 `danger-full-access`。
- **版本与诊断面板**：展示桌面端、内置/Overlay 内核、运行平台、服务 PID、数据目录、DSH_HOME、设置和日志路径；可复制不含密钥与对话内容的诊断文本。
- 标题栏菜单新增「首次设置与默认权限」和「版本与诊断」入口。

### 安全
- 项目 HTML 预览始终使用唯一源 iframe sandbox，并通过 CSP 禁止预览内容联网。
- 文件树与静态预览按会话 ID 限制到规范化后的会话工作目录，阻止绝对路径和符号链接越界。
- 终端 WebSocket 校验精确同源，工作目录由服务端根据会话 ID 解析，不再接受客户端提供的任意 cwd。

### 改进
- README 定位更新为「DeepSeek Harness 的零配置 Windows 桌面发行版」，补充首次使用流程与权限说明。
- 桌面端版本、`package-lock.json` 根版本统一为 `2.3.0`。

## [2.2.0] — 2026-08-15

### 新增
- 内置实验性 Agent Preset 完成中文本地化，默认使用锚定标准模式。
- 保留交互式卡片、技能、文件追踪、终端、插件市场与皮肤等核心配套插件。

## [2.1.0] — 2026-08-15

### 新增
- 增加交互式卡片与标准化 SKILL.md 技能体系。
- 配套插件和技能在打包阶段按原始目录结构复制，避免运行时文件缺失。

## [2.0.4] — 2026-08-15

### 修复
- 自定义 Provider 模型支持推理强度选择。

## [2.0.0] — 2026-08-15

### 新增
- **社区插件市场**（`dsh-webui-market`，@sanqi-normal）：设置 → 插件 → 市场，
  浏览 awesome-dsh-plugin.com 收录的 dsh 插件并一键安装/卸载到 profile。
- **外置视觉模型**（`dsh-tool-vision`，Scorp1o117）：`inspect_image` 工具把本地图片
  或图片 URL 发给任意 OpenAI 兼容视觉端点（qwen-vl / GLM-4V / Ollama 等），
  看图回答直接带回对话。
- **长期记忆**（`dsh-tdai-memory`，Scorp1o117）：腾讯云 Agent Memory 移植 ——
  L0 对话捕获 → L1 结构化记忆 → L2 场景 / L3 画像，自动召回注入 +
  记忆/对话搜索工具；复用现有 `~/.memory-tencentdb/memory-tdai` 数据。
- **soul.md 人设热重载**（`dsh-soul-md`，Scorp1o117）：markdown 人设文件注入
  系统提示词（`soul:persona`），文件变更即时热重载，Agent 边干活边角色扮演。
- **移动端布局修复**（`dsh-web-mobile-fix`，AcidGr）：窄屏（≤400px）下设置面板、
  弹窗、侧栏、会话头布局修复，纯前端 CSS。
- **NSIS 安装器定制**（`build/installer.nsh`）：安装流程接入自定义脚本。

### 改进
- **重启窗口期排队任务**：服务重启时先 `killTree` 旧进程并 `waitForProcExit`
  等待其完全退出（释放文件锁），再处理插件市场排队中的安装/卸载任务、
  同步配套插件、自愈 profile 模块，最后启动新服务，避免文件占用与半套改状态。
- **插件原样分发**（`after-pack.js`）：打包后把 `assets/plugins/` 原样拷回应用目录，
  社区插件自带的 vendor 依赖（sqlite-vec / jieba / AI SDK / BM25 语料等）不再被
  electron-builder 清掉。
- 内置插件/皮肤拷贝逻辑支持根目录入口文件、vendor、node_modules、data 目录。

### 说明
- 安装版数据目录使用 `%APPDATA%\DeepSeek Harness\`；便携版仍跟随 exe。
- 产物命名 `DeepSeek-Harness-v2.0-Portable/Setup-x64.exe`，自更新链路自动适配。

## [1.0.0] — 2026-08-15

### 品牌与新定位
- 项目统一命名为 **DeepSeek Harness**，Windows 桌面客户端正式释出，产物统一命名 `DeepSeek-Harness-v1.0-Portable/Setup-x64.exe`。
- 自更新链路同步指向新仓库，产物命名与 electron-builder 配置对齐。

### 新增
- **界面皮肤体系**（`assets/skins/` + `dsh-skin-switch`）：内置 10 款 Web UI 皮肤
  （9 款 dsh-web-ui：xp/qq98/ths/blue-fantasy/dragon-heir/minecraft/trading/whale-song/miku，
  1 款 dsh-deep-whale maid-atelier），设置页卡片式互斥切换、默认不启用、重启生效；
  出处与许可随包标注（BSD-3-Clause / CC BY-NC-SA 4.0）。
- **快速配置插件**（`dsh-easy-setup`）：设置页视觉模型提供商/模型一键选择、
  `soul.md` 人设可视化编辑、从 Codex / Claude Code 目录一键迁移 skills + MCP + 记忆。
- **插件市场加固**（`dsh-plugin-marketplace`）：宿主 typert local store 显式注册
  远端端点，修复跨模块实例 SRC 标记不可见导致的 HTTP 404。
- **profile 模块遮蔽自愈**（`profile-module-heal.js`）：清理 web profile 中遮蔽
  fallback junction 的真实目录副本，修复 `prompt section already registered`、
  模型列表/模式切换失效等问题。
- **自动化测试**：`test/` 新增 easy-setup、skin-switch、profile-module-heal、
  persona-scope、skin-chrome-zindex 等单测（`npm test`）。

### 说明
- 便携版数据目录跟随 exe（`data\`）；安装版在 `%APPDATA%\DeepSeek Harness\`。
- 与 dsh CLI 共享 `DSH_HOME`（默认 `~/.dsh`），已有会话/凭据直接生效。

## [0.2.0] — 2026-08-14

### 新增
- **伴侣插件体系（一切插件化）**：新增 `assets/plugins/` 机制——宿主启动时把
  配套插件同步进 web profile（`~/.dsh/profiles/web`）并幂等打 `cordis.patch.yml`
  补丁启用。本版随客户端分发的插件：
  - `dsh-terminal`：会话内终端标签页（与 对话/轨迹/文件 并列）。在当前会话项目目录
    启动持久 PowerShell（SSE 流式，非 PTY），命令历史/清屏/重启/断线重连（保留
    512KB 回放）；显式 UTF-8 mini-REPL 规避 PS 5.1 重定向 stdin 的代码页问题；
  - `dsh-file-changes` + `dsh-client-file-changes`：会话文件修改追踪与一键还原。
    「文件」标签页聚合当前会话 agent 修改过的全部文件（新建/修改/删除 + 行级 diff），
    支持逐文件/全部还原（桌面壳做内容精确匹配后替换，冲突安全提示）。数据只读复用
    会话日志已持久化的 `tool/result.meta.diffs`（fs 写前锁内全文 diff），零写入、
    零格式变更；另提供项目文件树（`/api/dsh-files/list`）、站内 HTML/端口预览
    （`/dsh-files/static/*`、`ports`、`check`），全部仅回环；
  - `dsh-balance`：对话底部统计栏内联「本轮 ¥X.XX · 余额 ¥Y.YY」小部件
    （桌面壳读 `~/.dsh/.credentials.yaml` 调 `api.deepseek.com/user/balance`，
    15 分钟刷新，可配置价格档）；
  - `dsh-plugin-marketplace`：插件市场入口。
- **客户端自更新**（`client-updater.js`）：GitHub Releases → Gitee Releases 双源回退
  （`DSH_DESKTOP_RELEASE_API` 可自定义镜像），Gitee 100MB 分片自动下载合并；
  便携版原地替换 + 自动重启，安装版引导新安装包；失败自动保留当前版本。
- **跟随官方更新**（`updater.js`）：检测 `@deepseek-ai/dsh` 新版本，经用户同意后
  用内置 node+npm 安装到数据目录 overlay，staging 原子切换、失败回退、
  启动失败一键回退内置版本；尊重 `NPM_CONFIG_REGISTRY`。
- **会话完成系统通知**：agent 任务跑完弹 Windows 通知，点击回到窗口。
- **快捷键自动维护**：便携版自动创建/重建桌面+开始菜单快捷方式（exe 移动后自愈）。

### 说明
- 便携版数据目录跟随 exe（`data\`）；安装版在 `%APPDATA%\DSH Desktop\`。
- 与 dsh CLI 共享 `DSH_HOME`（默认 `~/.dsh`），已有会话/凭据直接生效。
