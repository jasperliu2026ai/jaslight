// ─────────────────────────────────────────────────────────────────────────────
// 监控源模板库 —— 通用版核心
// 每个模板定义：日志路径（按平台）、状态匹配正则、进程名、应用名
// 用户可直接启用模板，也可复制后修改，或从零自定义
// ─────────────────────────────────────────────────────────────────────────────

const os = require('os');
const path = require('path');

const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

// 常用目录
const APPDATA   = process.env.APPDATA   || path.join(HOME, 'AppData', 'Roaming');
const LOCALAPP  = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const MAC_APPSUP = path.join(HOME, 'Library', 'Application Support');
const MAC_LOGS   = path.join(HOME, 'Library', 'Logs');

// ── 通用状态匹配正则（大多数 Agent 类工具通用） ──────────────────────────────
// 这些是「宽松通用」模式，适合日志格式未知的工具
//
// ⚠️ 匹配顺序：start → done → decision → working
//    decision 必须在 working 之前 —— 审批日志常常同时包含工具调用关键词，
//    若 working 先命中就会 return，红灯永远不亮。
const GENERIC = {
  // 用户发起 → 立即进入工作中
  start:    'user_input.*enqueu|new.*(user )?message|prompt.*(sent|submit)|turn.*start|user.*turn.*begin|starting queued user message',

  // 工具调用 / 模型输出 → 工作中
  working:  'tool_call|tool_use|function_call|tool_start|first.token|streaming|generating|thinking|invoke.*tool|executing|running.*command|read_file|write_file|edit_file|shell.*exec|execution-service|⚡ \\[tool\\]',

  // 等待用户确认 → 决策（务必比 working 更早匹配）
  // 覆盖：needsApproval:N（N≥1）/ requires_approval:true / 创建批量审批请求 / ApprovalManager 收到请求
  // 注意：不要写 allow.*tool 这类宽松词 —— "allowed":1 ... [TOOL] 会误命中
  decision: 'needs_?approval"?\\s*:\\s*[1-9]|requires?_?approval\\s*[":=]*\\s*true|创建.*审批请求|收到.*审批请求|approvalmanager.*(收到|receiv)|(approval|permission)\\s*(request|required)\\s*(created|received|pending)|awaiting\\s+(user|approval|confirmation)|waiting\\s+for\\s+(user|approval|confirmation)|confirmation\\s+required|tool\\s+permission\\s+(request|required)',

  // 完成 → 已完成
  // 注意：必须写得足够精确 —— 裸的 request.*completed 会被 HTTP 轮询日志每几秒误触发，
  // 裸的 turn.*end 会被 "queued user messages wait for turn end" 误触发。
  done:     'execution-queue.*user_input.*request.completed|cleared.completed.rounds|session-preview-ready|response\\.completed|"?stop_reason"?\\s*[":=]|"type"\\s*:\\s*"message_stop"|\\bend_turn\\b|turn\\s+(completed|finished)|conversation\\s+(completed|finished)|task\\s+(completed|finished)|round\\s+completed|stream\\s+(ended|finished)',
};

// ── 模板定义 ──────────────────────────────────────────────────────────────────
// logPath 支持数组（依次探测，取第一个存在的）
// glob 支持：*.log、YYYY-MM-DD（自动替换为当天日期）、latest（取目录内最新 .log）
const PRESETS = [
  // ─── CodeBuddy ────────────────────────────────────────────────────────────
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    icon: '🤖',
    desc: '腾讯云 CodeBuddy AI 编程助手',
    processName: IS_WIN ? 'CodeBuddy.exe' : 'CodeBuddy',
    appName: 'CodeBuddy',
    logPath: IS_WIN
      ? [path.join(HOME, '.codebuddy', 'logs', '{DATE}', '{LATEST}'), path.join(HOME, '.codebuddy', 'logs', '{LATEST_DIR}', '{LATEST}')]
      : [path.join(HOME, '.codebuddy', 'logs', '{DATE}', '{LATEST}'), path.join(HOME, '.codebuddy', 'logs', '{LATEST_DIR}', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── WorkBuddy ────────────────────────────────────────────────────────────
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    icon: '💼',
    desc: 'WorkBuddy AI 工作助手',
    processName: IS_WIN ? 'WorkBuddy.exe' : 'WorkBuddy',
    appName: 'WorkBuddy',
    logPath: IS_WIN
      ? [path.join(APPDATA, 'WorkBuddy', 'logs', 'main.log'), path.join(LOCALAPP, 'WorkBuddy', 'logs', '{LATEST}')]
      : [path.join(MAC_LOGS, 'WorkBuddy', 'main.log'), path.join(MAC_APPSUP, 'WorkBuddy', 'logs', '{LATEST_DIR}', '{LATEST}')],
    patterns: {
      start:    GENERIC.start,
      working:  'tool_call|function_call|streaming|generating|dispatch.*start|connector.*connect|agent.*run|chat\\.completion|first_token',
      decision: GENERIC.decision,
      done:     'conversation.*complet|agent.*done|task.*finish|response.*complet',
    },
  },

  // ─── Trae ─────────────────────────────────────────────────────────────────
  {
    id: 'trae',
    name: 'Trae',
    icon: '⚡',
    desc: '字节跳动 Trae AI IDE',
    processName: IS_WIN ? 'Trae.exe' : 'Trae',
    appName: 'Trae',
    logPath: IS_WIN
      ? [path.join(APPDATA, 'Trae', 'logs', '{LATEST_DIR}', '{LATEST}'), path.join(APPDATA, 'Trae', 'logs', 'main.log')]
      : [path.join(MAC_APPSUP, 'Trae', 'logs', '{LATEST_DIR}', '{LATEST}'), path.join(MAC_APPSUP, 'Trae', 'logs', 'main.log')],
    patterns: GENERIC,
  },

  // ─── Claude Code ──────────────────────────────────────────────────────────
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: '🧠',
    desc: 'Anthropic Claude Code CLI',
    processName: IS_WIN ? 'claude.exe' : 'claude',
    appName: IS_MAC ? 'Terminal' : '',
    logPath: IS_WIN
      ? [path.join(HOME, '.claude', 'logs', '{LATEST}'), path.join(HOME, '.claude', 'projects', '{LATEST_DIR}', '{LATEST}')]
      : [path.join(HOME, '.claude', 'logs', '{LATEST}'), path.join(HOME, '.claude', 'projects', '{LATEST_DIR}', '{LATEST}')],
    patterns: {
      start:    'user.*message|human.*turn|prompt.*submit|"role"\\s*:\\s*"user"',
      working:  'tool_use|tool_result|"type"\\s*:\\s*"tool_use"|bash|str_replace|create_file|assistant.*content',
      decision: 'permission.*(request|prompt)|awaiting.*approval|tool.*permission|allow.*tool|confirm.*edit',
      done:     'stop_reason|"type"\\s*:\\s*"message_stop"|turn.*complete|end_turn',
    },
  },

  // ─── ChatGPT Codex CLI ────────────────────────────────────────────────────
  {
    id: 'codex',
    name: 'Codex (ChatGPT CLI)',
    icon: '🌐',
    desc: 'OpenAI Codex / ChatGPT CLI',
    processName: IS_WIN ? 'codex.exe' : 'codex',
    appName: IS_MAC ? 'Terminal' : '',
    logPath: IS_WIN
      ? [path.join(HOME, '.codex', 'log', '{LATEST}'), path.join(HOME, '.codex', 'sessions', '{LATEST_DIR}', '{LATEST}')]
      : [path.join(HOME, '.codex', 'log', '{LATEST}'), path.join(HOME, '.codex', 'sessions', '{LATEST_DIR}', '{LATEST}')],
    patterns: {
      start:    'user.*(message|turn|input)|submit.*prompt|"role"\\s*:\\s*"user"',
      working:  'function_call|tool_call|exec.*command|apply_patch|shell|"type"\\s*:\\s*"function_call"|reasoning|delta',
      decision: 'approval.*(request|required)|ask.*user|confirm.*(patch|command)|awaiting.*approve|sandbox.*deny',
      done:     'task.*complete|turn.*(done|complete)|response\\.completed|"type"\\s*:\\s*"response.completed"',
    },
  },

  // ─── Kimi Code ────────────────────────────────────────────────────────────
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    icon: '🌙',
    desc: '月之暗面 Kimi Code',
    processName: IS_WIN ? 'kimi.exe' : 'kimi',
    appName: IS_MAC ? 'Terminal' : '',
    logPath: IS_WIN
      ? [path.join(HOME, '.kimi', 'logs', '{LATEST}'), path.join(APPDATA, 'Kimi', 'logs', '{LATEST}')]
      : [path.join(HOME, '.kimi', 'logs', '{LATEST}'), path.join(MAC_LOGS, 'Kimi', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── Cursor ───────────────────────────────────────────────────────────────
  {
    id: 'cursor',
    name: 'Cursor',
    icon: '🖱️',
    desc: 'Cursor AI 代码编辑器',
    processName: IS_WIN ? 'Cursor.exe' : 'Cursor',
    appName: 'Cursor',
    logPath: IS_WIN
      ? [path.join(APPDATA, 'Cursor', 'logs', '{LATEST_DIR}', '{LATEST}')]
      : [path.join(MAC_APPSUP, 'Cursor', 'logs', '{LATEST_DIR}', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── Windsurf ─────────────────────────────────────────────────────────────
  {
    id: 'windsurf',
    name: 'Windsurf',
    icon: '🏄',
    desc: 'Codeium Windsurf IDE',
    processName: IS_WIN ? 'Windsurf.exe' : 'Windsurf',
    appName: 'Windsurf',
    logPath: IS_WIN
      ? [path.join(APPDATA, 'Windsurf', 'logs', '{LATEST_DIR}', '{LATEST}')]
      : [path.join(MAC_APPSUP, 'Windsurf', 'logs', '{LATEST_DIR}', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── GitHub Copilot (VS Code) ─────────────────────────────────────────────
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    icon: '🐙',
    desc: 'VS Code 中的 GitHub Copilot',
    processName: IS_WIN ? 'Code.exe' : 'Code',
    appName: IS_MAC ? 'Visual Studio Code' : 'Code',
    logPath: IS_WIN
      ? [path.join(APPDATA, 'Code', 'logs', '{LATEST_DIR}', 'window1', 'exthost', 'GitHub.copilot-chat', '{LATEST}')]
      : [path.join(MAC_APPSUP, 'Code', 'logs', '{LATEST_DIR}', 'window1', 'exthost', 'GitHub.copilot-chat', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── Gemini CLI ───────────────────────────────────────────────────────────
  {
    id: 'gemini',
    name: 'Gemini CLI',
    icon: '💎',
    desc: 'Google Gemini CLI',
    processName: IS_WIN ? 'gemini.exe' : 'gemini',
    appName: IS_MAC ? 'Terminal' : '',
    logPath: [path.join(HOME, '.gemini', 'logs', '{LATEST}'), path.join(HOME, '.gemini', 'tmp', '{LATEST_DIR}', '{LATEST}')],
    patterns: GENERIC,
  },

  // ─── 自定义（空白模板） ───────────────────────────────────────────────────
  {
    id: 'custom',
    name: '自定义源',
    icon: '⚙️',
    desc: '手动填写日志路径与匹配规则',
    processName: '',
    appName: '',
    logPath: [''],
    patterns: { ...GENERIC },
  },
];

// ── 路径占位符解析 ────────────────────────────────────────────────────────────
// {DATE}       → 2026-08-31
// {LATEST}     → 所在目录下最新的 .log / .jsonl 文件
// {LATEST_DIR} → 所在位置下最新的子目录
const fs = require('fs');

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function newestIn(dir, opts = {}) {
  try {
    if (!fs.existsSync(dir)) return null;
    const items = fs.readdirSync(dir).map(n => {
      const full = path.join(dir, n);
      let st; try { st = fs.statSync(full); } catch(e) { return null; }
      return { name: n, full, isDir: st.isDirectory(), mtime: st.mtimeMs };
    }).filter(Boolean);
    let pool = opts.dirOnly ? items.filter(i => i.isDir) : items.filter(i => !i.isDir);
    if (!opts.dirOnly) {
      const logs = pool.filter(i => /\.(log|jsonl|txt|ndjson)$/i.test(i.name));
      if (logs.length) pool = logs;
    }
    if (!pool.length) return null;
    pool.sort((a, b) => b.mtime - a.mtime);
    return pool[0].full;
  } catch(e) { return null; }
}

/** 把带占位符的模板路径解析成真实存在的文件路径，失败返回 null */
function resolveLogPath(tpl) {
  if (!tpl || !tpl.trim()) return null;
  let p = tpl.trim();

  // ~ 展开
  if (p.startsWith('~')) p = path.join(HOME, p.slice(1));
  // 环境变量（Windows %APPDATA% 风格）
  p = p.replace(/%([A-Za-z_]+)%/g, (_, k) => process.env[k] || '');
  // 日期
  p = p.replace(/\{DATE\}/g, todayStr());

  const parts = p.split(/[\\/]+/);
  let cur = path.isAbsolute(p) || /^[A-Za-z]:$/.test(parts[0]) ? '' : HOME;
  if (p.startsWith('/')) cur = '/';

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) continue;
    if (seg === '{LATEST_DIR}') {
      const nd = newestIn(cur, { dirOnly: true });
      if (!nd) return null;
      cur = nd;
    } else if (seg === '{LATEST}') {
      const nf = newestIn(cur);
      if (!nf) return null;
      cur = nf;
    } else if (seg.includes('*')) {
      // 简单 glob：取匹配中最新的
      try {
        const rx = new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
        const cands = fs.readdirSync(cur).filter(n => rx.test(n))
          .map(n => ({ n, full: path.join(cur, n), m: (() => { try { return fs.statSync(path.join(cur,n)).mtimeMs; } catch(e){ return 0; } })() }))
          .sort((a,b) => b.m - a.m);
        if (!cands.length) return null;
        cur = cands[0].full;
      } catch(e) { return null; }
    } else {
      cur = cur ? path.join(cur, seg) : (path.sep + seg);
    }
  }
  return fs.existsSync(cur) ? cur : null;
}

/** 从模板生成用户源配置对象 */
function presetToSource(preset, overrides = {}) {
  return {
    uid: overrides.uid || `${preset.id}-${Date.now().toString(36)}`,
    presetId: preset.id,
    name: overrides.name || preset.name,
    icon: overrides.icon || preset.icon,
    enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    logPath: overrides.logPath !== undefined ? overrides.logPath : (Array.isArray(preset.logPath) ? preset.logPath[0] : preset.logPath),
    logPathFallbacks: Array.isArray(preset.logPath) ? preset.logPath.slice(1) : [],
    processName: overrides.processName !== undefined ? overrides.processName : preset.processName,
    appName: overrides.appName !== undefined ? overrides.appName : preset.appName,
    patterns: { ...preset.patterns, ...(overrides.patterns || {}) },
  };
}

module.exports = { PRESETS, GENERIC, resolveLogPath, presetToSource, todayStr, newestIn, IS_WIN, IS_MAC };
