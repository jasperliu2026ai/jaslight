<div align="center">

<img src="docs/icon.png" width="120" alt="JasLight">

# JasLight

**通用 AI 工作信号灯 · Universal AI Work Signal Light**

一眼看清任何 AI Agent 在干什么 —— 工作中、等你决策、已完成，还是卡住了

*See what any AI agent is doing at a glance — working, waiting for you, done, or stuck*

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)](https://github.com/jasperliu2026ai/jaslight/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.1-orange)](https://github.com/jasperliu2026ai/jaslight/releases)

**[🇨🇳 中文](#-中文文档) · [🇬🇧 English](#-english) · [🌐 官网 Website](https://jasperliu2026ai.github.io/jaslight/)**

</div>

---

## 📖 中文文档

### 这是什么

用 AI 编程/办公时，你大概经常这样：切到别的窗口做事，回头一看 —— AI 早就跑完了，或者卡在一个需要点「允许」的弹窗上等了十分钟。

JasLight 是一个**常驻桌面的小信号灯**，读取 AI 工具自己写的日志文件来判断状态，用颜色和动画告诉你：

| 颜色 | 状态 | 含义 |
|:---:|---|---|
| 🟢 绿 | AI空闲 | 在等你输入 |
| 🟠 橙 | 工作中 | 正在调用工具 / 生成内容 |
| 🔴 红 | 请你决策 | **等你点确认**（会响铃提醒） |
| 🔵 蓝 | 已完成 | 本轮任务结束 |
| 🟣 紫 | 疑似卡住 | 长时间无新日志 |
| ⚫ 灰 | 未监控 | 应用没运行 / 日志找不到 |

**不需要任何 API Key，不联网，不读取你的对话内容** —— 只做日志的正则匹配。

### 核心特性

- **🔌 通用适配** — 内置 10 种主流 AI 工具模板（CodeBuddy / WorkBuddy / Trae / Claude Code / Codex / Kimi Code / Cursor / Windsurf / Copilot / Gemini CLI），也可**完全自定义**任意工具
- **🔍 一键自动探测** — 扫描本机已安装的 AI 工具并自动配置
- **📊 多源同时监控** — 同时盯多个 AI，悬浮灯显示最紧急的那个状态
- **🐱 11 种皮肤** — 光球 + 10 种宠物，每种状态有不同表情和动作
- **🔔 声音提示** — 需要决策时响铃，比系统通知更难被忽略
- **🎯 一键跳转** — 红灯时点一下，直接把对应 AI 应用拉到前台
- **📈 工时报表** — 今日概览 / 24 小时状态色带 / 近 7 天柱状图 / CSV 导出
- **🍅 番茄钟联动** — 只在 AI 真正工作时累计专注时长
- **⌨️ 全局快捷键** + **开机自启**

### 下载安装

前往 **[Releases](https://github.com/jasperliu2026ai/jaslight/releases/latest)** 下载对应版本：

| 系统 | 文件 | 说明 |
|---|---|---|
| macOS Apple 芯片 (M1/M2/M3/M4) | `JasLight-2.0.1-arm64.dmg` | 推荐 |
| macOS Intel | `JasLight-2.0.1.dmg` | macOS 11+ |
| Windows 安装版 | `JasLight Setup 2.0.1.exe` | 可选安装路径 |
| Windows 免安装版 | `JasLight 2.0.1.exe` | 单文件绿色版 |

<details>
<summary><b>macOS 首次打开提示「已损坏」或「无法验证开发者」？</b></summary>

因为没有 Apple 付费开发者签名。执行一次即可：

```bash
sudo xattr -rd com.apple.quarantine /Applications/JasLight.app
```

或者：**右键点击 App → 打开 → 仍要打开**
</details>

<details>
<summary><b>Windows 提示「Windows 已保护你的电脑」？</b></summary>

点击 **更多信息 → 仍要运行**。这是未购买代码签名证书的应用的正常提示。
</details>

### ⚙️ 配置监控源（重要）

JasLight 靠**读日志**判断状态，所以**必须先告诉它日志在哪**。

#### 方式一：自动探测（推荐）

打开 **偏好设置 → 监控源 → 🔍 自动探测本机 AI 工具**，会列出所有找到日志的 AI 工具，点击即添加。

首次启动时也会自动探测一次。

#### 方式二：从模板添加

在 **偏好设置 → 监控源 → 从模板添加** 里点击对应工具，添加后可展开修改。

#### 方式三：完全自定义

选择 **⚙️ 自定义源** 模板，然后填写四项：

**1. 日志路径** — 支持这些占位符：

| 占位符 | 含义 | 例子 |
|---|---|---|
| `{DATE}` | 当天日期 `2026-08-31` | `app.{DATE}.log` |
| `{LATEST}` | 目录内**最新**的 .log/.jsonl 文件 | `logs/{LATEST}` |
| `{LATEST_DIR}` | **最新**的子目录 | `logs/{LATEST_DIR}/main.log` |
| `*` | 通配符（取最新匹配项） | `logs/session-*.log` |
| `~` | 用户主目录 | `~/.claude/logs/{LATEST}` |
| `%APPDATA%` | Windows 环境变量 | `%APPDATA%\App\logs\{LATEST}` |

填完点 **测试路径**，会显示实际解析到的文件、大小和修改时间。

**2. 进程名** — 用于判断应用是否在运行（macOS 用 `pgrep`，Windows 用 `tasklist`）。留空则只看日志文件是否存在。

**3. 应用名** — 一键跳转时激活的应用。macOS 填 App 名（如 `Cursor`），Windows 填 exe 名（如 `Cursor.exe`）。

**4. 状态匹配正则**（不区分大小写，逐行匹配）：

| 字段 | 触发状态 | 该写什么 |
|---|---|---|
| 开始 | 🟠 工作中 | 用户发消息的日志行特征 |
| 工作中 | 🟠 工作中 | 工具调用 / token 生成的特征 |
| 需要决策 | 🔴 决策 | 等待用户批准的特征 |
| 完成 | 🔵 完成 | 本轮结束的特征 |

匹配顺序：**开始 → 决策 → 完成 → 工作中**（先匹配到的生效）

> ⚠️ 决策规则必须比工作中更早匹配 —— 审批日志行常常同时含有工具调用关键词，若工作中先命中，红灯就永远不会亮。

#### 📋 预置模板参考

<details>
<summary><b>点击展开全部 10 个模板的路径与规则</b></summary>

**CodeBuddy**
```
两平台:  ~/.codebuddy/logs/{DATE}/{LATEST}
        ~/.codebuddy/logs/{LATEST_DIR}/{LATEST}
进程名:  CodeBuddy / CodeBuddy.exe
规则:    通用规则
```

**WorkBuddy**
```
macOS:   ~/Library/Logs/WorkBuddy/main.log
Windows: %APPDATA%\WorkBuddy\logs\main.log
进程名:  WorkBuddy / WorkBuddy.exe

工作中:   tool_call|function_call|streaming|generating|dispatch.*start|first_token
完成:     conversation.*complet|agent.*done|task.*finish|response.*complet
```

**Trae**（字节 AI IDE）
```
macOS:   ~/Library/Application Support/Trae/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Trae\logs\{LATEST_DIR}\{LATEST}
进程名:  Trae / Trae.exe
规则:    通用规则
```

**Claude Code**（Anthropic CLI）
```
两平台:  ~/.claude/logs/{LATEST}
        ~/.claude/projects/{LATEST_DIR}/{LATEST}
进程名:  claude / claude.exe
应用名:  Terminal（macOS）

开始:     user.*message|human.*turn|prompt.*submit|"role"\s*:\s*"user"
工作中:   tool_use|tool_result|"type"\s*:\s*"tool_use"|bash|str_replace|create_file
决策:     permission.*(request|prompt)|awaiting.*approval|tool.*permission|allow.*tool
完成:     stop_reason|"type"\s*:\s*"message_stop"|turn.*complete|end_turn
```

**Codex / ChatGPT CLI**（OpenAI）
```
两平台:  ~/.codex/log/{LATEST}
        ~/.codex/sessions/{LATEST_DIR}/{LATEST}
进程名:  codex / codex.exe

开始:     user.*(message|turn|input)|submit.*prompt|"role"\s*:\s*"user"
工作中:   function_call|tool_call|exec.*command|apply_patch|shell|reasoning|delta
决策:     approval.*(request|required)|ask.*user|confirm.*(patch|command)|sandbox.*deny
完成:     task.*complete|turn.*(done|complete)|response\.completed
```

**Kimi Code**（月之暗面）
```
macOS:   ~/.kimi/logs/{LATEST}  或  ~/Library/Logs/Kimi/{LATEST}
Windows: ~/.kimi/logs/{LATEST}  或  %APPDATA%\Kimi\logs\{LATEST}
进程名:  kimi / kimi.exe
规则:    通用规则
```

**Cursor**
```
macOS:   ~/Library/Application Support/Cursor/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Cursor\logs\{LATEST_DIR}\{LATEST}
进程名:  Cursor / Cursor.exe
规则:    通用规则
```

**Windsurf**（Codeium）
```
macOS:   ~/Library/Application Support/Windsurf/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Windsurf\logs\{LATEST_DIR}\{LATEST}
进程名:  Windsurf / Windsurf.exe
规则:    通用规则
```

**GitHub Copilot**（VS Code）
```
macOS:   ~/Library/Application Support/Code/logs/{LATEST_DIR}/window1/exthost/GitHub.copilot-chat/{LATEST}
Windows: %APPDATA%\Code\logs\{LATEST_DIR}\window1\exthost\GitHub.copilot-chat\{LATEST}
进程名:  Code / Code.exe
应用名:  Visual Studio Code（macOS）/ Code.exe（Windows）
规则:    通用规则
```

**Gemini CLI**（Google）
```
两平台:  ~/.gemini/logs/{LATEST}
        ~/.gemini/tmp/{LATEST_DIR}/{LATEST}
进程名:  gemini / gemini.exe
规则:    通用规则
```

**通用规则**（适合日志格式未知的工具，也是自定义源的默认值）

> ⚠️ 匹配顺序：**开始 → 决策 → 完成 → 工作中**。decision 必须早于 working，因为审批日志行常常同时含有工具调用关键词，若 working 先命中就会导致红灯不亮。

```
开始:   user_input.*enqueu|new.*(user )?message|prompt.*(sent|submit)|turn.*start|
       user.*turn.*begin|starting queued user message

工作中: tool_call|tool_use|function_call|tool_start|first.token|streaming|generating|thinking|
       invoke.*tool|executing|running.*command|read_file|write_file|edit_file|shell.*exec|
       execution-service|⚡ \[tool\]

决策:   needs_?approval"?\s*:\s*[1-9]|requires?_?approval\s*[":=]*\s*true|创建.*审批请求|收到.*审批请求|
       approvalmanager.*(收到|receiv)|(approval|permission)\s*(request|required)\s*(created|
       received|pending)|awaiting\s+(user|approval|confirmation)|waiting\s+for\s+(user|approval|
       confirmation)|confirmation\s+required|tool\s+permission\s+(request|required)

完成:   execution-queue.*user_input.*request.completed|cleared.completed.rounds|
       session-preview-ready|response\.completed|"?stop_reason"?\s*[":=]|
       "type"\s*:\s*"message_stop"|\bend_turn\b|turn\s+(completed|finished)|
       conversation\s+(completed|finished)|task\s+(completed|finished)|round\s+completed|
       stream\s+(ended|finished)
```

</details>

#### 🔧 怎么给一个全新工具写规则

1. **找日志目录** — 常见位置：
   - macOS: `~/Library/Logs/<App>/`、`~/Library/Application Support/<App>/logs/`
   - Windows: `%APPDATA%\<App>\logs\`、`%LOCALAPPDATA%\<App>\logs\`
   - CLI 工具: `~/.<tool>/logs/`

2. **边用边看** — 一边用那个 AI，一边跟踪日志：
   ```bash
   # macOS / Linux
   tail -f "路径/到/日志.log"

   # Windows PowerShell
   Get-Content "路径\到\日志.log" -Wait -Tail 20
   ```

3. **找特征词** — 记下这几个时刻打印了什么：
   - 你刚发出消息时
   - AI 调用工具时
   - 弹出「允许/拒绝」时
   - 回复结束时

4. **填进设置页** — 用 `|` 分隔多个候选词，如 `tool_call|function_call|invoke_tool`

5. **验证** — 点「测试路径」确认文件能找到，然后实际用一次 AI，看信号灯是否跟着变色

> 💡 完全不知道从哪下手？直接用通用规则试试 —— 它对大多数 Agent 类工具都能覆盖 60% 以上的状态。

### 使用技巧

| 操作 | 效果 |
|---|---|
| **单击悬浮灯** | 打开信息流面板（红灯时 = 跳转到 AI 应用） |
| **右键悬浮灯** | 快捷菜单：切皮肤、开关源、跳转、退出 |
| **拖动悬浮灯** | 移动位置（自动记住） |
| **`⌥⌘J`** / `Alt+Shift+J` | 显示/隐藏信息流面板 |
| **`⌥⌘L`** / `Alt+Shift+L` | 显示/隐藏悬浮灯 |
| **`⌘T`** / `Ctrl+T` | 打开工时报表 |
| **`⌘,`** / `Ctrl+,` | 打开偏好设置 |

### 配置文件位置

```
macOS:   ~/Library/Application Support/JasLight/config.json
Windows: %APPDATA%\JasLight\config.json
```

历史数据在同目录 `history.json`（保留 60 天）。设置页支持**导出/导入配置**，方便在多台机器间同步。

### 隐私说明

- ✅ 完全本地运行，**零网络请求**
- ✅ 只对日志做正则匹配，**不解析、不存储、不上传**任何对话内容
- ✅ 统计数据只有时长和次数，存在本机
- ✅ 源码开放，可自行审计与构建

### 从源码构建

```bash
git clone https://github.com/jasperliu2026ai/jaslight.git
cd jaslight
npm install

npm start                                  # 开发模式

npx electron-builder --mac --x64 --arm64   # macOS 双架构
npx electron-builder --win --x64           # Windows
```

---

## 📖 English

### What is this

When working with AI coding/office assistants, this probably sounds familiar: you switch to another window, come back later — and the AI either finished ages ago, or has been sitting on an "Allow?" prompt for ten minutes.

JasLight is a **tiny always-on-top signal light** that reads the log files AI tools already write, and tells you the status through color and animation:

| Color | State | Meaning |
|:---:|---|---|
| 🟢 Green | Idle | Waiting for your input |
| 🟠 Amber | Working | Calling tools / generating |
| 🔴 Red | Needs you | **Waiting for your approval** (rings a sound) |
| 🔵 Blue | Done | Turn completed |
| 🟣 Purple | Stuck | No new log lines for a while |
| ⚫ Gray | Offline | App not running / log not found |

**No API key, no network, never reads your conversation** — just regex matching on log lines.

### Features

- **🔌 Works with anything** — 10 built-in presets (CodeBuddy / WorkBuddy / Trae / Claude Code / Codex / Kimi Code / Cursor / Windsurf / Copilot / Gemini CLI) plus **fully custom** sources
- **🔍 One-click auto-detect** — scans your machine for installed AI tools and configures them
- **📊 Multi-source monitoring** — watch several AIs at once; the light shows the most urgent state
- **🐱 11 skins** — glowing orb + 10 pets, each with distinct expressions and animations per state
- **🔔 Sound alerts** — rings when a decision is needed, harder to miss than a notification
- **🎯 One-click jump** — click the red light to bring the AI app to the front
- **📈 Work reports** — today overview / 24h status band / 7-day bars / CSV export
- **🍅 Pomodoro** — accumulates focus time only while the AI is actually working
- **⌨️ Global hotkeys** + **launch at login**

### Download

Grab the right build from **[Releases](https://github.com/jasperliu2026ai/jaslight/releases/latest)**:

| OS | File | Notes |
|---|---|---|
| macOS Apple Silicon (M1/M2/M3/M4) | `JasLight-2.0.1-arm64.dmg` | Recommended |
| macOS Intel | `JasLight-2.0.1.dmg` | macOS 11+ |
| Windows installer | `JasLight Setup 2.0.1.exe` | Choose install path |
| Windows portable | `JasLight 2.0.1.exe` | Single-file, no install |

<details>
<summary><b>macOS says "damaged" or "unidentified developer"?</b></summary>

The app isn't signed with a paid Apple Developer certificate. Run once:

```bash
sudo xattr -rd com.apple.quarantine /Applications/JasLight.app
```

Or: **right-click the app → Open → Open anyway**
</details>

<details>
<summary><b>Windows shows "Windows protected your PC"?</b></summary>

Click **More info → Run anyway**. Normal for apps without a paid code-signing certificate.
</details>

### ⚙️ Configuring sources (important)

JasLight determines status by **tailing log files**, so you must **tell it where the logs are**.

#### Option 1: Auto-detect (recommended)

Open **Preferences → Sources → 🔍 Auto-detect AI tools**. It lists every AI tool whose logs it can find — click to add.

This also runs automatically on first launch.

#### Option 2: Add from preset

In **Preferences → Sources → Add from preset**, click a tool. Expand the card afterwards to tweak anything.

#### Option 3: Fully custom

Pick the **⚙️ Custom** preset, then fill in four things:

**1. Log path** — supports these placeholders:

| Placeholder | Meaning | Example |
|---|---|---|
| `{DATE}` | Today, `2026-08-31` | `app.{DATE}.log` |
| `{LATEST}` | **Newest** .log/.jsonl in the dir | `logs/{LATEST}` |
| `{LATEST_DIR}` | **Newest** subdirectory | `logs/{LATEST_DIR}/main.log` |
| `*` | Wildcard (newest match wins) | `logs/session-*.log` |
| `~` | Home directory | `~/.claude/logs/{LATEST}` |
| `%APPDATA%` | Windows env var | `%APPDATA%\App\logs\{LATEST}` |

Hit **Test path** to see the resolved file, its size and last-modified time.

**2. Process name** — used to check if the app is running (`pgrep` on macOS, `tasklist` on Windows). Leave empty to rely on the log file alone.

**3. App name** — activated on one-click jump. macOS: app name (e.g. `Cursor`). Windows: exe name (e.g. `Cursor.exe`).

**4. Status regex patterns** (case-insensitive, matched per line):

| Field | Triggers | What to put |
|---|---|---|
| Start | 🟠 Working | Signature of a user message being sent |
| Working | 🟠 Working | Tool calls / token generation |
| Decision | 🔴 Decision | Waiting for user approval |
| Done | 🔵 Done | End of turn |

Match order: **Start → Decision → Done → Working** (first match wins)

> ⚠️ Decision must match before Working — approval log lines often contain tool-call keywords, and if Working matched first the red light would never fire.

#### 📋 Preset reference

<details>
<summary><b>Expand for all 10 presets — paths and patterns</b></summary>

**CodeBuddy**
```
Both:    ~/.codebuddy/logs/{DATE}/{LATEST}
         ~/.codebuddy/logs/{LATEST_DIR}/{LATEST}
Process: CodeBuddy / CodeBuddy.exe
Rules:   generic
```

**WorkBuddy**
```
macOS:   ~/Library/Logs/WorkBuddy/main.log
Windows: %APPDATA%\WorkBuddy\logs\main.log
Process: WorkBuddy / WorkBuddy.exe

working: tool_call|function_call|streaming|generating|dispatch.*start|first_token
done:    conversation.*complet|agent.*done|task.*finish|response.*complet
```

**Trae** (ByteDance AI IDE)
```
macOS:   ~/Library/Application Support/Trae/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Trae\logs\{LATEST_DIR}\{LATEST}
Process: Trae / Trae.exe
Rules:   generic
```

**Claude Code** (Anthropic CLI)
```
Both:    ~/.claude/logs/{LATEST}
         ~/.claude/projects/{LATEST_DIR}/{LATEST}
Process: claude / claude.exe
App:     Terminal (macOS)

start:    user.*message|human.*turn|prompt.*submit|"role"\s*:\s*"user"
working:  tool_use|tool_result|"type"\s*:\s*"tool_use"|bash|str_replace|create_file
decision: permission.*(request|prompt)|awaiting.*approval|tool.*permission|allow.*tool
done:     stop_reason|"type"\s*:\s*"message_stop"|turn.*complete|end_turn
```

**Codex / ChatGPT CLI** (OpenAI)
```
Both:    ~/.codex/log/{LATEST}
         ~/.codex/sessions/{LATEST_DIR}/{LATEST}
Process: codex / codex.exe

start:    user.*(message|turn|input)|submit.*prompt|"role"\s*:\s*"user"
working:  function_call|tool_call|exec.*command|apply_patch|shell|reasoning|delta
decision: approval.*(request|required)|ask.*user|confirm.*(patch|command)|sandbox.*deny
done:     task.*complete|turn.*(done|complete)|response\.completed
```

**Kimi Code** (Moonshot AI)
```
macOS:   ~/.kimi/logs/{LATEST}  or  ~/Library/Logs/Kimi/{LATEST}
Windows: ~/.kimi/logs/{LATEST}  or  %APPDATA%\Kimi\logs\{LATEST}
Process: kimi / kimi.exe
Rules:   generic
```

**Cursor**
```
macOS:   ~/Library/Application Support/Cursor/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Cursor\logs\{LATEST_DIR}\{LATEST}
Process: Cursor / Cursor.exe
Rules:   generic
```

**Windsurf** (Codeium)
```
macOS:   ~/Library/Application Support/Windsurf/logs/{LATEST_DIR}/{LATEST}
Windows: %APPDATA%\Windsurf\logs\{LATEST_DIR}\{LATEST}
Process: Windsurf / Windsurf.exe
Rules:   generic
```

**GitHub Copilot** (VS Code)
```
macOS:   ~/Library/Application Support/Code/logs/{LATEST_DIR}/window1/exthost/GitHub.copilot-chat/{LATEST}
Windows: %APPDATA%\Code\logs\{LATEST_DIR}\window1\exthost\GitHub.copilot-chat\{LATEST}
Process: Code / Code.exe
App:     Visual Studio Code (macOS) / Code.exe (Windows)
Rules:   generic
```

**Gemini CLI** (Google)
```
Both:    ~/.gemini/logs/{LATEST}
         ~/.gemini/tmp/{LATEST_DIR}/{LATEST}
Process: gemini / gemini.exe
Rules:   generic
```

**Generic rules** (for unknown log formats; also the default for custom sources)

> ⚠️ Match order: **start → decision → done → working**. Decision must come before working, because approval log lines often contain tool-call keywords too — if working matched first, the red light would never fire.

```
start:    user_input.*enqueu|new.*(user )?message|prompt.*(sent|submit)|turn.*start|
          user.*turn.*begin|starting queued user message

working:  tool_call|tool_use|function_call|tool_start|first.token|streaming|generating|thinking|
          invoke.*tool|executing|running.*command|read_file|write_file|edit_file|shell.*exec|
          execution-service|⚡ \[tool\]

decision: needs_?approval"?\s*:\s*[1-9]|requires?_?approval\s*[":=]*\s*true|创建.*审批请求|收到.*审批请求|
          approvalmanager.*(收到|receiv)|(approval|permission)\s*(request|required)\s*(created|
          received|pending)|awaiting\s+(user|approval|confirmation)|waiting\s+for\s+(user|approval|
          confirmation)|confirmation\s+required|tool\s+permission\s+(request|required)

done:     execution-queue.*user_input.*request.completed|cleared.completed.rounds|
          session-preview-ready|response\.completed|"?stop_reason"?\s*[":=]|
          "type"\s*:\s*"message_stop"|\bend_turn\b|turn\s+(completed|finished)|
          conversation\s+(completed|finished)|task\s+(completed|finished)|round\s+completed|
          stream\s+(ended|finished)
```

</details>

#### 🔧 Writing rules for a brand-new tool

1. **Find the log directory** — common spots:
   - macOS: `~/Library/Logs/<App>/`, `~/Library/Application Support/<App>/logs/`
   - Windows: `%APPDATA%\<App>\logs\`, `%LOCALAPPDATA%\<App>\logs\`
   - CLI tools: `~/.<tool>/logs/`

2. **Watch while you work** — tail the log while using the AI:
   ```bash
   # macOS / Linux
   tail -f "path/to/log.log"

   # Windows PowerShell
   Get-Content "path\to\log.log" -Wait -Tail 20
   ```

3. **Note the signatures** printed at these moments:
   - Right after you send a message
   - When the AI calls a tool
   - When an Allow/Deny prompt appears
   - When the reply finishes

4. **Fill them in** — separate alternatives with `|`, e.g. `tool_call|function_call|invoke_tool`

5. **Verify** — hit "Test path", then actually use the AI and watch the light change

> 💡 No idea where to start? Just try the generic rules — they cover 60%+ of states for most agent-style tools.

### Usage tips

| Action | Effect |
|---|---|
| **Click the light** | Open the feed panel (red light = jump to AI app) |
| **Right-click the light** | Quick menu: skins, toggle sources, jump, quit |
| **Drag the light** | Move it (position is remembered) |
| **`⌥⌘J`** / `Alt+Shift+J` | Toggle feed panel |
| **`⌥⌘L`** / `Alt+Shift+L` | Toggle floating light |
| **`⌘T`** / `Ctrl+T` | Open work report |
| **`⌘,`** / `Ctrl+,` | Open preferences |

### Config location

```
macOS:   ~/Library/Application Support/JasLight/config.json
Windows: %APPDATA%\JasLight\config.json
```

History lives in `history.json` in the same folder (60 days). Preferences support **export/import** for syncing across machines.

### Privacy

- ✅ Fully local, **zero network requests**
- ✅ Regex matching only — **never parses, stores or uploads** conversation content
- ✅ Stats are just durations and counts, kept on your machine
- ✅ Open source — audit and build it yourself

### Build from source

```bash
git clone https://github.com/jasperliu2026ai/jaslight.git
cd jaslight
npm install

npm start                                  # dev mode

npx electron-builder --mac --x64 --arm64   # macOS universal
npx electron-builder --win --x64           # Windows
```

---

<div align="center">

**MIT License** · Made with Electron

If JasLight saves you from staring at a "waiting for approval" prompt, consider giving it a ⭐

</div>
