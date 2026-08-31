const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  screen, ipcMain, Notification, globalShortcut, shell, dialog
} = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { exec } = require('child_process');
const { PRESETS, GENERIC, resolveLogPath, presetToSource, todayStr, IS_WIN, IS_MAC } = require('./presets');

// ─── 路径 ────────────────────────────────────────────────────────────────────
const DATA_DIR = IS_WIN
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'JasLight')
  : path.join(os.homedir(), 'Library', 'Application Support', 'JasLight');
const CONFIG_PATH  = path.join(DATA_DIR, 'config.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');

// ─── 默认配置 ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  // 监控源：用户可配置的数组，每项由 presetToSource() 生成
  sources: [],
  opacity: 1.0,
  position: null,
  locked: false,
  showMiniStats: true,
  showSourceRows: true,
  stuckThresholdMs: 120000,
  alertWorking: true,  alertWorkingMin: 10,
  alertDecision: true, alertDecisionMin: 5,
  alertIdle: true,     alertIdleMin: 30,
  skin: 'orb',
  autoLaunch: false,
  soundAlert: true,
  soundName: IS_WIN ? 'Windows Notify' : 'Ping',
  soundOnDone: false,
  hotkeyPanel: IS_WIN ? 'Alt+Shift+J' : 'Alt+Command+J',
  hotkeyFloat: IS_WIN ? 'Alt+Shift+L' : 'Alt+Command+L',
  jumpOnDecision: true,
  pomodoro: true,
  pomodoroMin: 25,
  pomodoroBreakMin: 5,
  lang: 'zh',
};

const SKINS = [
  { id: 'orb',     label: '光球（默认）',  labelEn: 'Orb (default)' },
  { id: 'cat',     label: '🐱 猫咪',       labelEn: '🐱 Cat' },
  { id: 'dog',     label: '🐶 小狗',       labelEn: '🐶 Dog' },
  { id: 'penguin', label: '🐧 企鹅',       labelEn: '🐧 Penguin' },
  { id: 'fox',     label: '🦊 狐狸',       labelEn: '🦊 Fox' },
  { id: 'panda',   label: '🐼 熊猫',       labelEn: '🐼 Panda' },
  { id: 'chick',   label: '🐥 小鸡',       labelEn: '🐥 Chick' },
  { id: 'rabbit',  label: '🐰 兔子',       labelEn: '🐰 Rabbit' },
  { id: 'hamster', label: '🐹 仓鼠',       labelEn: '🐹 Hamster' },
  { id: 'frog',    label: '🐸 青蛙',       labelEn: '🐸 Frog' },
  { id: 'bear',    label: '🐻 小熊',       labelEn: '🐻 Bear' },
];

// macOS 系统音 / Windows 用 PowerShell beep
const SOUNDS_MAC = ['Ping', 'Glass', 'Pop', 'Tink', 'Submarine', 'Hero', 'Blow', 'Bottle'];
const SOUNDS_WIN = ['Windows Notify', 'Windows Ding', 'Windows Exclamation', 'Windows Critical Stop', 'Beep'];

let cfg = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      const merged = { ...DEFAULTS, ...raw };
      // 兼容老版本：把 source / enabledSources 迁移成 sources[]
      if (!Array.isArray(merged.sources) || !merged.sources.length) {
        merged.sources = migrateLegacy(raw);
      }
      return merged;
    }
  } catch(e) {}
  const d = JSON.parse(JSON.stringify(DEFAULTS));
  // 首次启动：自动探测本机可用的模板并启用
  d.sources = autoDetectSources();
  return d;
}

function migrateLegacy(raw) {
  const list = [];
  const legacyEnabled = raw.enabledSources || {};
  const ids = raw.multiSource
    ? Object.keys(legacyEnabled).filter(k => legacyEnabled[k])
    : (raw.source ? [raw.source] : []);
  ids.forEach(id => {
    const p = PRESETS.find(x => x.id === id);
    if (p) list.push(presetToSource(p, { logPath: (raw.logPaths || {})[id] || undefined }));
  });
  return list.length ? list : autoDetectSources();
}

/** 扫描本机，自动启用能找到日志的模板 */
function autoDetectSources() {
  const found = [];
  PRESETS.filter(p => p.id !== 'custom').forEach(p => {
    const cands = Array.isArray(p.logPath) ? p.logPath : [p.logPath];
    for (const c of cands) {
      if (resolveLogPath(c)) { found.push(presetToSource(p, { logPath: c })); break; }
    }
  });
  if (!found.length) {
    // 全都没找到：放一个自定义空模板，引导用户手动配置
    const custom = PRESETS.find(p => p.id === 'custom');
    if (custom) found.push(presetToSource(custom, { enabled: true }));
  }
  return found;
}

function saveConfig() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch(e) {}
}

// ─── 状态定义 ─────────────────────────────────────────────────────────────────
const STATES = {
  off:      { color: '#6b7280', label: '未监控',   labelEn: 'Offline',   anim: 'slow'   },
  idle:     { color: '#22c55e', label: 'AI空闲',   labelEn: 'Idle',      anim: 'breath' },
  working:  { color: '#f59e0b', label: '工作中',   labelEn: 'Working',   anim: 'fast'   },
  decision: { color: '#ef4444', label: '请你决策', labelEn: 'Needs you', anim: 'blink'  },
  done:     { color: '#3b82f6', label: '已完成',   labelEn: 'Done',      anim: 'blink'  },
  stuck:    { color: '#a855f7', label: '疑似卡住', labelEn: 'Stuck',     anim: 'slow'   },
};
const PRIORITY = { decision: 6, stuck: 5, working: 4, done: 3, idle: 2, off: 1 };

// ─── 运行时 ───────────────────────────────────────────────────────────────────
let floatWin = null, panelWin = null, settingsWin = null, statsWin = null, tray = null;
let currentState = 'off';
let monitorTimer = null, logRotateTimer = null, persistTimer = null;

// 每个源独立上下文，key = source.uid
const CTX = {};

function ensureCtx(src) {
  if (!CTX[src.uid]) {
    CTX[src.uid] = {
      state: 'off', lastEvent: Date.now(),
      logPath: null, watcher: null, size: 0,
      doneTimer: null, decisionTimer: null, notified: false,
      rx: null,
      stats: { workingMs: 0, idleMs: 0, decisionCount: 0, taskCount: 0, lastStateTime: Date.now() },
    };
  }
  return CTX[src.uid];
}

const stats = { startTime: Date.now(), workingMs:0, idleMs:0, decisionCount:0, taskCount:0, lastStateTime:Date.now() };
const timeline = [];
const feed     = [];
const pomo = { focusMs: 0, completed: 0, lastTick: Date.now(), onBreak: false, breakUntil: 0 };

function enabledSources() {
  return (cfg.sources || []).filter(s => s.enabled);
}

// 把源的 patterns 编译成正则
function compileRx(src) {
  const p = src.patterns || GENERIC;
  const safe = (s, fallback) => {
    try { return new RegExp(s || fallback, 'i'); } catch(e) { try { return new RegExp(fallback, 'i'); } catch(e2) { return null; } }
  };
  return {
    start:    safe(p.start,    GENERIC.start),
    working:  safe(p.working,  GENERIC.working),
    decision: safe(p.decision, GENERIC.decision),
    done:     safe(p.done,     GENERIC.done),
  };
}

// ─── 监控 ─────────────────────────────────────────────────────────────────────
function resolveSourceLog(src) {
  const cands = [src.logPath, ...(src.logPathFallbacks || [])].filter(Boolean);
  for (const c of cands) {
    const p = resolveLogPath(c);
    if (p) return p;
  }
  return null;
}

function startMonitor() {
  // 清理所有旧 watcher
  Object.keys(CTX).forEach(uid => {
    const c = CTX[uid];
    if (c.watcher) { try { c.watcher.close(); } catch(e){} c.watcher = null; }
    if (c.doneTimer) clearTimeout(c.doneTimer);
    if (c.decisionTimer) clearTimeout(c.decisionTimer);
    c.doneTimer = c.decisionTimer = null;
    c.logPath = null; c.notified = false; c.state = 'off';
  });
  clearInterval(monitorTimer);
  clearInterval(logRotateTimer);

  enabledSources().forEach(attachSource);

  monitorTimer = setInterval(() => {
    checkProcess();
    checkStuck();
    checkAlerts();
    tickPomodoro();
  }, 3000);

  logRotateTimer = setInterval(() => {
    enabledSources().forEach(src => {
      const c = ensureCtx(src);
      const np = resolveSourceLog(src);
      if (np && np !== c.logPath) {
        if (c.watcher) { try { c.watcher.close(); } catch(e){} c.watcher = null; }
        c.logPath = np;
        try { c.size = fs.statSync(np).size; } catch(e) { c.size = 0; }
        try { c.watcher = fs.watch(np, { persistent: false }, () => readNewLog(src)); } catch(e) {}
      }
    });
  }, 30000);

  recomputeAggregate();
}

function attachSource(src) {
  const c = ensureCtx(src);
  c.rx = compileRx(src);
  const p = resolveSourceLog(src);
  c.logPath = p;
  if (p) {
    try { c.size = fs.statSync(p).size; } catch(e) { c.size = 0; }
    try { c.watcher = fs.watch(p, { persistent: false }, () => readNewLog(src)); } catch(e) {}
    setSourceState(src, 'idle');
    pushFeed('system', `开始监控 ${src.name} (${path.basename(p)})`, src);
  } else {
    setSourceState(src, 'off');
    if (!c.notified) { pushFeed('system', `未找到 ${src.name} 日志，检查路径配置`, src); c.notified = true; }
  }
}

function readNewLog(src) {
  const c = ensureCtx(src);
  if (!c.logPath) return;
  try {
    const sz = fs.statSync(c.logPath).size;
    if (sz <= c.size) { if (sz < c.size) c.size = sz; return; }
    const fd = fs.openSync(c.logPath, 'r');
    const buf = Buffer.alloc(sz - c.size);
    fs.readSync(fd, buf, 0, buf.length, c.size);
    fs.closeSync(fd);
    c.size = sz;
    buf.toString('utf-8').split('\n').filter(Boolean).forEach(line => parseLine(src, line));
  } catch(e) {}
}

function parseLine(src, line) {
  const c = ensureCtx(src);
  if (!c.rx) c.rx = compileRx(src);
  c.lastEvent = Date.now();
  const rx = c.rx;

  // 匹配顺序很重要：start → decision → done → working
  // decision 必须早于 working —— 审批日志行常常同时含有工具调用关键词，
  // 若 working 抢先命中并 return，红灯永远不会亮。

  // 1. 用户发起 → working
  if (rx.start && rx.start.test(line)) {
    if (c.decisionTimer) { clearTimeout(c.decisionTimer); c.decisionTimer = null; }
    if (c.state !== 'working') { setSourceState(src, 'working'); pushFeed('system', '收到用户消息，开始处理', src); }
    return;
  }
  // 2. 需要审批 → decision（优先级最高的运行态）
  if (rx.decision && rx.decision.test(line)) {
    if (c.doneTimer) { clearTimeout(c.doneTimer); c.doneTimer = null; }
    if (c.state !== 'decision') pushFeed('decision', '需要你做出选择', src);
    setSourceState(src, 'decision');
    if (c.decisionTimer) clearTimeout(c.decisionTimer);
    // 超时保护：120 秒仍在 decision 则退回 working（防止用户已处理但没匹配到响应行）
    c.decisionTimer = setTimeout(() => { if (c.state === 'decision') { setSourceState(src, 'working'); c.decisionTimer = null; } }, 120000);
    return;
  }
  // 3. 审批已响应 → 立即解除 decision，回到 working
  if (/审批.*已响应|approvedcount|批量审批提交成功|approval.*(submitted|responded|resolved)|"action"\s*:\s*"(approve|deny)"/i.test(line)) {
    if (c.decisionTimer) { clearTimeout(c.decisionTimer); c.decisionTimer = null; }
    if (c.state === 'decision') setSourceState(src, 'working');
    return;
  }
  // 4. 完成
  if (rx.done && rx.done.test(line)) {
    if (c.decisionTimer) { clearTimeout(c.decisionTimer); c.decisionTimer = null; }
    setSourceState(src, 'done');
    pushFeed('done', '任务已完成', src);
    c.stats.taskCount++;
    if (c.doneTimer) clearTimeout(c.doneTimer);
    c.doneTimer = setTimeout(() => { if (c.state === 'done') setSourceState(src, 'idle'); }, 15000);
    return;
  }
  // 5. 工具调用 / 生成中 → working
  if (rx.working && rx.working.test(line)) {
    // decision 状态下遇到普通工具日志不要立刻抢走红灯
    if (c.state === 'decision') return;
    if (c.doneTimer) { clearTimeout(c.doneTimer); c.doneTimer = null; }
    const tm = line.match(/tool_start:\s*([\w_]+)/i) || line.match(/"name"\s*:\s*"([\w_]+)"/);
    if (tm) pushFeed('cmd', '调用工具: ' + tm[1], src);
    if (c.state !== 'working') setSourceState(src, 'working');
    return;
  }
}

function checkProcess() {
  enabledSources().forEach(src => {
    const c = ensureCtx(src);
    if (!src.processName) {
      // 没配进程名：只要日志文件存在就算在线
      if (!c.logPath && c.state !== 'off') setSourceState(src, 'off');
      return;
    }
    const cmd = IS_WIN
      ? `tasklist /FI "IMAGENAME eq ${src.processName}" 2>nul | findstr /I "${src.processName}"`
      : `pgrep -f "${src.processName}" 2>/dev/null`;
    exec(cmd, (err, out) => {
      if (err || !out.trim()) {
        if (c.state !== 'off') setSourceState(src, 'off');
      } else if (c.state === 'off') {
        setSourceState(src, 'idle');
        if (!c.watcher) attachSource(src);
      }
    });
  });
}

function checkStuck() {
  enabledSources().forEach(src => {
    const c = ensureCtx(src);
    if (c.state !== 'working') return;
    const idleFor = Date.now() - c.lastEvent;
    if (idleFor > cfg.stuckThresholdMs) {
      setSourceState(src, 'stuck');
      notify('疑似卡住', `${src.name} 超过 ${Math.floor(cfg.stuckThresholdMs/60000)} 分钟无响应`);
    } else if (idleFor > 45000 && !c.doneTimer) {
      setSourceState(src, 'done');
      c.doneTimer = setTimeout(() => { if (c.state === 'done') setSourceState(src, 'idle'); }, 15000);
    }
  });
}

let alertLastSent = {};
function checkAlerts() {
  const now = Date.now();
  const elapsed = now - stats.lastStateTime;
  const cooldown = 5 * 60 * 1000;
  const fire = (key, title, body) => {
    if (!alertLastSent[key] || now - alertLastSent[key] > cooldown) { notify(title, body); alertLastSent[key] = now; }
  };
  if (cfg.alertWorking  && currentState === 'working'  && elapsed > cfg.alertWorkingMin  * 60000) fire('working',  '工作时间较长',  `AI 已连续工作 ${Math.floor(elapsed/60000)} 分钟`);
  if (cfg.alertDecision && currentState === 'decision' && elapsed > cfg.alertDecisionMin * 60000) fire('decision', '等你决策超时',  `AI 已等待 ${Math.floor(elapsed/60000)} 分钟`);
  if (cfg.alertIdle     && currentState === 'idle'     && elapsed > cfg.alertIdleMin     * 60000) fire('idle',     'AI 长时间空闲', `AI 已空闲 ${Math.floor(elapsed/60000)} 分钟`);
}

function tickPomodoro() {
  if (!cfg.pomodoro) return;
  const now = Date.now();
  const dt = now - pomo.lastTick;
  pomo.lastTick = now;
  if (pomo.onBreak) {
    if (now >= pomo.breakUntil) { pomo.onBreak = false; notify('休息结束', '新的一轮专注开始'); }
    return;
  }
  if (currentState === 'working' || currentState === 'decision') {
    pomo.focusMs += dt;
    const target = (cfg.pomodoroMin || 25) * 60000;
    if (pomo.focusMs >= target) {
      pomo.completed++; pomo.focusMs = 0; pomo.onBreak = true;
      pomo.breakUntil = now + (cfg.pomodoroBreakMin || 5) * 60000;
      notify('番茄完成 🍅', `已完成第 ${pomo.completed} 个番茄，休息 ${cfg.pomodoroBreakMin || 5} 分钟`);
      playSound(cfg.soundName);
    }
  }
}

// ─── 状态聚合 ─────────────────────────────────────────────────────────────────
function setSourceState(src, next) {
  const c = ensureCtx(src);
  if (c.state === next) return;
  const now = Date.now();
  const dur = now - c.stats.lastStateTime;
  if (c.state === 'working')  c.stats.workingMs += dur;
  if (c.state === 'idle')     c.stats.idleMs    += dur;
  if (next  === 'decision')   c.stats.decisionCount++;
  timeline.push({ time: now, uid: src.uid, name: src.name, from: c.state, to: next, duration: dur });
  if (timeline.length > 2000) timeline.shift();
  c.stats.lastStateTime = now;
  c.state = next;
  recomputeAggregate();
}

function recomputeAggregate() {
  const list = enabledSources();
  let best = 'off';
  list.forEach(src => {
    const s = ensureCtx(src).state || 'off';
    if ((PRIORITY[s] || 0) > (PRIORITY[best] || 0)) best = s;
  });

  const now = Date.now();
  let wm = 0, im = 0, dc = 0, tc = 0;
  list.forEach(src => {
    const c = ensureCtx(src);
    wm += c.stats.workingMs + (c.state === 'working' ? now - c.stats.lastStateTime : 0);
    im += c.stats.idleMs    + (c.state === 'idle'    ? now - c.stats.lastStateTime : 0);
    dc += c.stats.decisionCount;
    tc += c.stats.taskCount;
  });
  stats.workingMs = wm; stats.idleMs = im; stats.decisionCount = dc; stats.taskCount = tc;

  if (best !== currentState) {
    stats.lastStateTime = now;
    currentState = best;
    if (cfg.soundAlert && best === 'decision') playSound(cfg.soundName);
    if (cfg.soundOnDone && best === 'done')    playSound(IS_WIN ? 'Windows Ding' : 'Glass');
    if (cfg.alertDecision && best === 'decision') notify('请做出决策', 'AI 正在等待你的确认');
  }
  broadcastState();
  updateTray();
}

function perSourcePayload() {
  const out = {};
  enabledSources().forEach(src => {
    const c = ensureCtx(src);
    out[src.uid] = {
      name: src.name, icon: src.icon || '',
      state: c.state, color: (STATES[c.state]||STATES.off).color,
      hasLog: !!c.logPath, logPath: c.logPath || '',
    };
  });
  return out;
}

function broadcastState() {
  broadcast('state-change', {
    state: currentState, states: STATES,
    multiSource: enabledSources().length > 1,
    showSourceRows: cfg.showSourceRows !== false,
    perSource: perSourcePayload(),
  });
}

function broadcast(channel, data) {
  [floatWin, panelWin, statsWin, settingsWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send(channel, data);
  });
}

function pushFeed(type, text, src) {
  const entry = {
    type, text,
    uid: src ? src.uid : '', srcLabel: src ? src.name : '',
    time: new Date().toLocaleTimeString('zh-CN', { hour12:false }),
  };
  feed.unshift(entry);
  if (feed.length > 200) feed.pop();
  [panelWin, statsWin].forEach(w => { if (w && !w.isDestroyed()) w.webContents.send('feed-update', feed.slice(0, 40)); });
}

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title: `JasLight · ${title}`, body }).show();
}

// ─── 声音（跨平台） ───────────────────────────────────────────────────────────
function playSound(name) {
  if (IS_WIN) {
    const map = {
      'Windows Notify':          'Notification.Default',
      'Windows Ding':            'Windows Ding',
      'Windows Exclamation':     'Windows Exclamation',
      'Windows Critical Stop':   'Windows Critical Stop',
    };
    if (name === 'Beep') {
      exec('powershell -NoProfile -Command "[console]::beep(880,200)"', () => {});
    } else {
      const wav = {
        'Windows Notify':        'C:\\Windows\\Media\\Windows Notify System Generic.wav',
        'Windows Ding':          'C:\\Windows\\Media\\Windows Ding.wav',
        'Windows Exclamation':   'C:\\Windows\\Media\\Windows Exclamation.wav',
        'Windows Critical Stop': 'C:\\Windows\\Media\\Windows Critical Stop.wav',
      }[name] || 'C:\\Windows\\Media\\Windows Notify System Generic.wav';
      exec(`powershell -NoProfile -Command "(New-Object Media.SoundPlayer '${wav}').PlaySync()"`, () => {});
    }
  } else {
    const sound = SOUNDS_MAC.includes(name) ? name : 'Ping';
    exec(`afplay /System/Library/Sounds/${sound}.aiff 2>/dev/null &`, () => {});
  }
}

// ─── 一键跳转（跨平台） ───────────────────────────────────────────────────────
function jumpToApp() {
  const list = enabledSources();
  let target = list.find(s => ensureCtx(s).state === 'decision')
            || list.find(s => ensureCtx(s).state === 'working')
            || list[0];
  if (!target) return;
  const appName = target.appName || target.processName;
  if (!appName) { pushFeed('system', `${target.name} 未配置应用名，无法跳转`, target); return; }

  if (IS_WIN) {
    // 用 PowerShell 激活窗口
    const exe = appName.replace(/\.exe$/i, '');
    const ps = `powershell -NoProfile -Command "$p=Get-Process '${exe}' -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){ Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }"`;
    exec(ps, () => {});
  } else {
    exec(`osascript -e 'tell application "${appName}" to activate' 2>/dev/null`, (err) => {
      if (err) exec(`open -a "${appName}" 2>/dev/null`);
    });
  }
  pushFeed('system', `已切换到 ${appName}`, target);
}

// ─── 历史持久化 ───────────────────────────────────────────────────────────────
function loadHistory() {
  try { if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')); } catch(e) {}
  return {};
}

function persistHistory() {
  try {
    const hist = loadHistory();
    const key  = todayStr();
    const day  = hist[key] || { workingMs:0, idleMs:0, decisionCount:0, taskCount:0, pomodoro:0, bands: [] };
    day.workingMs     = Math.max(day.workingMs,     stats.workingMs);
    day.idleMs        = Math.max(day.idleMs,        stats.idleMs);
    day.decisionCount = Math.max(day.decisionCount, stats.decisionCount);
    day.taskCount     = Math.max(day.taskCount,     stats.taskCount);
    day.pomodoro      = Math.max(day.pomodoro,      pomo.completed);
    const bands = [];
    let last = null;
    timeline.forEach(ev => {
      const minute = Math.floor(ev.time / 60000);
      if (last && last.m === minute) { last.s = ev.to; return; }
      last = { m: minute, s: ev.to };
      bands.push(last);
    });
    if (bands.length) day.bands = bands.slice(-1440);
    hist[key] = day;
    const keys = Object.keys(hist).sort().slice(-60);
    const trimmed = {};
    keys.forEach(k => trimmed[k] = hist[k]);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed));
  } catch(e) {}
}

function applyAutoLaunch(enable) {
  try { app.setLoginItemSettings({ openAtLogin: !!enable, openAsHidden: true }); } catch(e) {}
}

function registerHotkeys() {
  try { globalShortcut.unregisterAll(); } catch(e) {}
  const reg = (accel, fn) => { if (accel && accel.trim()) { try { globalShortcut.register(accel.trim(), fn); } catch(e) {} } };
  reg(cfg.hotkeyPanel, togglePanel);
  reg(cfg.hotkeyFloat, toggleFloat);
  reg('CommandOrControl+Shift+L', toggleFloat);
  reg('CommandOrControl+T', () => { if (!statsWin) createStatsWin(); else statsWin.focus(); });
  reg('CommandOrControl+,', createSettingsWin);
}

// ─── 窗口 ─────────────────────────────────────────────────────────────────────
function floatHeight() {
  let h = 100;
  if (cfg.showMiniStats) h += 75;
  const n = enabledSources().length;
  if (cfg.showSourceRows !== false && n > 1) h += n * 16 + 4;
  return h;
}

function createFloatWin() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const pos = cfg.position || { x: width - 130, y: 80 };
  floatWin = new BrowserWindow({
    width: 100, height: floatHeight(),
    x: pos.x, y: pos.y,
    frame: false, transparent: true, alwaysOnTop: true,
    hasShadow: false, resizable: false, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  floatWin.loadFile(path.join(__dirname, 'float.html'));
  floatWin.setOpacity(cfg.opacity);
  try { floatWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch(e) {}
  if (cfg.locked) floatWin.setIgnoreMouseEvents(true, { forward: true });
  floatWin.on('moved', () => {
    cfg.position = { x: floatWin.getPosition()[0], y: floatWin.getPosition()[1] };
    saveConfig();
  });
  floatWin.on('closed', () => { floatWin = null; });
}

function createPanelWin() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  panelWin = new BrowserWindow({
    width: 340, height: 520, x: width - 360, y: 200,
    frame: false, transparent: true, alwaysOnTop: true,
    hasShadow: true, resizable: false, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  panelWin.loadFile(path.join(__dirname, 'panel.html'));
  try { panelWin.setVisibleOnAllWorkspaces(true); } catch(e) {}
  panelWin.on('closed', () => { panelWin = null; });
}

function createStatsWin() {
  statsWin = new BrowserWindow({
    width: 740, height: 730,
    frame: false, titleBarStyle: IS_MAC ? 'hidden' : 'default',
    transparent: false, resizable: true, minWidth: 640, minHeight: 560,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  statsWin.loadFile(path.join(__dirname, 'stats.html'));
  statsWin.on('closed', () => { statsWin = null; });
}

function createSettingsWin() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 620, height: 800,
    frame: false, titleBarStyle: IS_MAC ? 'hidden' : 'default',
    transparent: false, resizable: true, minWidth: 520, minHeight: 500,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ─── Tray 图标 ────────────────────────────────────────────────────────────────
function hexToRgb(hex) { return hex.replace('#','').match(/.{2}/g).map(x => parseInt(x, 16)); }

function makeTrayIcon(colorHex) {
  const zlib = require('zlib');
  const W = 44, H = 44;
  const [r, g, b] = hexToRgb(colorHex);
  const rows = [];
  const cx = W/2, cy = H/2, radius = 18;
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(W*4);
    for (let x = 0; x < W; x++) {
      const d = Math.sqrt((x-cx+0.5)**2 + (y-cy+0.5)**2);
      const alpha = d < radius ? (d < radius-1.5 ? 255 : Math.round((radius-d)/1.5*255)) : 0;
      row[x*4]=r; row[x*4+1]=g; row[x*4+2]=b; row[x*4+3]=alpha;
    }
    rows.push(row);
  }
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (const byte of buf) { crc ^= byte; for (let i=0;i<8;i++) crc=(crc>>>1)^(crc&1?0xEDB88320:0); }
    return (crc^0xFFFFFFFF)|0;
  }
  function chunk(type, data) {
    const t=Buffer.from(type), len=Buffer.alloc(4), c=Buffer.alloc(4);
    len.writeUInt32BE(data.length); c.writeInt32BE(crc32(Buffer.concat([t,data])));
    return Buffer.concat([len,t,data,c]);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=6;
  const raw=Buffer.concat(rows.map(r2=>Buffer.concat([Buffer.from([0]),r2])));
  const png=Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0)),
  ]);
  return nativeImage.createFromBuffer(png, { scaleFactor: IS_WIN ? 1.0 : 2.0 });
}

function createTray() {
  try {
    tray = new Tray(makeTrayIcon('#6b7280'));
    tray.setToolTip('JasLight · AI Work Signal');
    if (IS_WIN) tray.on('click', () => togglePanel());
    updateTray();
  } catch(e) { console.error('createTray error:', e.message); }
}

function updateTray() {
  if (!tray) return;
  const s = STATES[currentState] || STATES.off;
  tray.setImage(makeTrayIcon(s.color));
  tray.setToolTip(`JasLight · ${s.label}`);

  const srcItems = (cfg.sources || []).length
    ? cfg.sources.map(src => {
        const c = ensureCtx(src);
        const st = src.enabled ? (STATES[c.state]||STATES.off).label : '未启用';
        return {
          label: `${src.icon || '•'} ${src.name} — ${st}`,
          type: 'checkbox', checked: !!src.enabled,
          click: () => toggleSourceEnabled(src.uid),
        };
      })
    : [{ label: '未配置监控源，请到设置添加', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: `● ${s.label}`, enabled: false },
    { label: `监控源: ${enabledSources().length} 个已启用`, enabled: false },
    ...(cfg.pomodoro ? [{ label: `🍅 今日番茄: ${pomo.completed}${pomo.onBreak ? '（休息中）' : ''}`, enabled: false }] : []),
    { type: 'separator' },
    { label: '监控源', submenu: srcItems },
    { label: '悬浮灯皮肤', submenu: SKINS.map(sk => ({
        label: sk.label, type: 'radio',
        checked: (cfg.skin || 'orb') === sk.id, click: () => switchSkin(sk.id),
      })) },
    { type: 'separator' },
    { label: '跳转到 AI 应用', click: jumpToApp },
    { label: floatWin?.isVisible() ? '隐藏悬浮灯' : '显示悬浮灯',    click: toggleFloat },
    { label: panelWin?.isVisible() ? '隐藏信息流' : '显示信息流面板', click: togglePanel },
    { type: 'separator' },
    { label: '工时报表 / 统计', click: () => { if (!statsWin) createStatsWin(); else statsWin.focus(); } },
    { label: '偏好设置…',      click: createSettingsWin },
    { type: 'separator' },
    { label: '退出 JasLight', click: () => { persistHistory(); app.exit(0); } },
  ]);
  tray.setContextMenu(menu);
}

function toggleFloat() {
  if (!floatWin) { createFloatWin(); return; }
  floatWin.isVisible() ? floatWin.hide() : floatWin.show();
}
function togglePanel() {
  if (!panelWin) { createPanelWin(); return; }
  panelWin.isVisible() ? panelWin.hide() : panelWin.show();
}

function switchSkin(skin) {
  cfg.skin = skin; saveConfig();
  broadcast('config-data', cfg); updateTray();
}

function resetAllStats() {
  Object.keys(CTX).forEach(uid => {
    CTX[uid].stats = { workingMs:0, idleMs:0, decisionCount:0, taskCount:0, lastStateTime: Date.now() };
  });
  timeline.length = 0;
  Object.assign(stats, { startTime: Date.now(), workingMs:0, idleMs:0, decisionCount:0, taskCount:0, lastStateTime: Date.now() });
}

function toggleSourceEnabled(uid) {
  const src = (cfg.sources || []).find(s => s.uid === uid);
  if (!src) return;
  src.enabled = !src.enabled;
  if (!enabledSources().length) src.enabled = true;   // 至少留一个
  saveConfig();
  startMonitor();
  broadcast('config-data', cfg);
  if (floatWin) floatWin.setSize(100, floatHeight());
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.on('get-state', e => {
  e.reply('state-change', {
    state: currentState, states: STATES,
    multiSource: enabledSources().length > 1,
    showSourceRows: cfg.showSourceRows !== false,
    perSource: perSourcePayload(),
  });
});
ipcMain.on('get-feed', e => e.reply('feed-update', feed.slice(0, 40)));
ipcMain.on('get-stats', e => {
  recomputeAggregate();
  const per = {};
  enabledSources().forEach(src => {
    const c = ensureCtx(src);
    per[src.uid] = { ...c.stats, state: c.state, label: src.name, icon: src.icon || '', hasLog: !!c.logPath };
  });
  e.reply('stats-data', {
    stats, timeline: timeline.slice(-1500), currentState, states: STATES,
    pomodoro: { ...pomo, targetMin: cfg.pomodoroMin, enabled: !!cfg.pomodoro },
    perSource: per,
  });
});
ipcMain.on('get-config',  e => e.reply('config-data', cfg));
ipcMain.on('get-presets', e => e.reply('presets-data', {
  presets: PRESETS.map(p => ({
    id: p.id, name: p.name, icon: p.icon, desc: p.desc,
    processName: p.processName, appName: p.appName,
    logPath: Array.isArray(p.logPath) ? p.logPath[0] : p.logPath,
    logPathAll: Array.isArray(p.logPath) ? p.logPath : [p.logPath],
    patterns: p.patterns,
  })),
  generic: GENERIC,
  platform: process.platform,
  arch: process.arch,
}));
ipcMain.on('get-history', e => {
  persistHistory();
  e.reply('history-data', { history: loadHistory(), today: todayStr() });
});
ipcMain.on('close-win',     e => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('toggle-float',  () => toggleFloat());
ipcMain.on('toggle-panel',  () => togglePanel());
ipcMain.on('open-stats',    () => { if (!statsWin) createStatsWin(); else statsWin.focus(); });
ipcMain.on('open-settings', () => createSettingsWin());
ipcMain.on('jump-to-app',   () => jumpToApp());
ipcMain.on('test-sound',    (_, name) => playSound(name || cfg.soundName));
ipcMain.on('reset-pomodoro',() => { pomo.completed = 0; pomo.focusMs = 0; pomo.onBreak = false; updateTray(); });

// 测试某个日志路径能否解析到真实文件
ipcMain.on('test-log-path', (e, { tpl, id }) => {
  const resolved = resolveLogPath(tpl);
  let size = 0, mtime = null;
  if (resolved) { try { const st = fs.statSync(resolved); size = st.size; mtime = st.mtime.toLocaleString('zh-CN'); } catch(err) {} }
  e.reply('test-log-path-result', { id, ok: !!resolved, resolved: resolved || '', size, mtime });
});

// 自动探测本机所有可用源
ipcMain.on('auto-detect', e => {
  const found = [];
  PRESETS.filter(p => p.id !== 'custom').forEach(p => {
    const cands = Array.isArray(p.logPath) ? p.logPath : [p.logPath];
    for (const c of cands) {
      const r = resolveLogPath(c);
      if (r) { found.push({ presetId: p.id, name: p.name, icon: p.icon, logPath: c, resolved: r }); break; }
    }
  });
  e.reply('auto-detect-result', { found });
});

// 从模板添加源
ipcMain.on('add-source', (e, { presetId }) => {
  const p = PRESETS.find(x => x.id === presetId);
  if (!p) return;
  if (!Array.isArray(cfg.sources)) cfg.sources = [];
  cfg.sources.push(presetToSource(p));
  saveConfig();
  startMonitor();
  e.reply('config-data', cfg);
  broadcast('config-data', cfg);
  updateTray();
  if (floatWin) floatWin.setSize(100, floatHeight());
});

ipcMain.on('remove-source', (e, { uid }) => {
  cfg.sources = (cfg.sources || []).filter(s => s.uid !== uid);
  delete CTX[uid];
  saveConfig();
  startMonitor();
  e.reply('config-data', cfg);
  broadcast('config-data', cfg);
  updateTray();
  if (floatWin) floatWin.setSize(100, floatHeight());
});

// CSV 导出
ipcMain.on('export-csv', async (e, { scope }) => {
  persistHistory();
  const hist = loadHistory();
  const keys = Object.keys(hist).sort();
  const rows = [['日期 Date','工作时长(分) Working(min)','空闲时长(分) Idle(min)','决策次数 Decisions','完成任务 Tasks','番茄数 Pomodoros']];
  const days = scope === 'week' ? keys.slice(-7) : scope === 'month' ? keys.slice(-30) : keys;
  days.forEach(k => {
    const d = hist[k];
    rows.push([k, Math.round(d.workingMs/60000), Math.round(d.idleMs/60000), d.decisionCount, d.taskCount, d.pomodoro || 0]);
  });
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出工时报表 / Export report',
    defaultPath: path.join(os.homedir(), IS_WIN ? 'Downloads' : 'Downloads', `JasLight-report-${todayStr()}.csv`),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!canceled && filePath) {
    try { fs.writeFileSync(filePath, csv, 'utf-8'); e.reply('export-done', { ok: true, path: filePath }); }
    catch(err) { e.reply('export-done', { ok: false, error: err.message }); }
  } else {
    e.reply('export-done', { ok: false, canceled: true });
  }
});

// 导出 / 导入配置
ipcMain.on('export-config', async (e) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出配置 / Export config',
    defaultPath: path.join(os.homedir(), 'Downloads', 'jaslight-config.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!canceled && filePath) {
    try { fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf-8'); e.reply('export-done', { ok: true, path: filePath }); }
    catch(err) { e.reply('export-done', { ok: false, error: err.message }); }
  }
});

ipcMain.on('import-config', async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入配置 / Import config',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!canceled && filePaths && filePaths[0]) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
      cfg = { ...DEFAULTS, ...raw };
      if (!Array.isArray(cfg.sources)) cfg.sources = autoDetectSources();
      saveConfig();
      resetAllStats();
      startMonitor();
      e.reply('config-data', cfg);
      broadcast('config-data', cfg);
      updateTray();
    } catch(err) { e.reply('export-done', { ok: false, error: err.message }); }
  }
});

// 悬浮球拖拽
let _dragOffset = null;
ipcMain.on('drag-start', () => {
  if (!floatWin) return;
  const [wx, wy] = floatWin.getPosition();
  const cursor = screen.getCursorScreenPoint();
  _dragOffset = { dx: cursor.x - wx, dy: cursor.y - wy };
});
ipcMain.on('drag-move', (e, { x, y }) => {
  if (!floatWin || !_dragOffset) return;
  floatWin.setPosition(x - _dragOffset.dx, y - _dragOffset.dy);
});

ipcMain.on('save-config', (e, newCfg) => {
  const prevSources     = JSON.stringify(cfg.sources || []);
  const prevAutoLaunch  = cfg.autoLaunch;
  const prevHkPanel     = cfg.hotkeyPanel;
  const prevHkFloat     = cfg.hotkeyFloat;

  cfg = { ...cfg, ...newCfg };
  if (!Array.isArray(cfg.sources)) cfg.sources = [];
  saveConfig();

  if (floatWin) {
    floatWin.setOpacity(cfg.opacity);
    floatWin.setIgnoreMouseEvents(cfg.locked, { forward: true });
    floatWin.setSize(100, floatHeight());
  }
  if (cfg.autoLaunch !== prevAutoLaunch) applyAutoLaunch(cfg.autoLaunch);
  if (cfg.hotkeyPanel !== prevHkPanel || cfg.hotkeyFloat !== prevHkFloat) registerHotkeys();

  if (JSON.stringify(cfg.sources) !== prevSources) {
    resetAllStats();
    startMonitor();
  }

  e.reply('config-data', cfg);
  broadcast('config-data', cfg);
  updateTray();
});

ipcMain.on('show-float-menu', (e) => {
  const menu = Menu.buildFromTemplate([
    { label: '跳转到 AI 应用', click: jumpToApp },
    { type: 'separator' },
    { label: '悬浮灯皮肤', submenu: SKINS.map(sk => ({
        label: sk.label, type: 'radio',
        checked: (cfg.skin || 'orb') === sk.id, click: () => switchSkin(sk.id),
      })) },
    { label: '监控源', submenu: (cfg.sources||[]).length
        ? cfg.sources.map(src => ({
            label: `${src.icon||'•'} ${src.name}`, type: 'checkbox',
            checked: !!src.enabled, click: () => toggleSourceEnabled(src.uid),
          }))
        : [{ label: '未配置', enabled: false }] },
    { type: 'separator' },
    { label: '显示信息流面板', click: togglePanel },
    { label: '工时报表 / 统计', click: () => { if (!statsWin) createStatsWin(); else statsWin.focus(); } },
    { label: '偏好设置…',     click: createSettingsWin },
    { type: 'separator' },
    { label: '退出 JasLight', click: () => { persistHistory(); app.exit(0); } },
  ]);
  menu.popup({ window: BrowserWindow.fromWebContents(e.sender) });
});

// ─── App ──────────────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (panelWin) { panelWin.show(); panelWin.focus(); } else togglePanel(); });

  app.whenReady().then(() => {
    if (IS_MAC) { try { app.setActivationPolicy('accessory'); } catch(e) {} }
    fs.mkdirSync(DATA_DIR, { recursive: true });

    createTray();
    createFloatWin();
    startMonitor();
    registerHotkeys();
    applyAutoLaunch(cfg.autoLaunch);

    persistTimer = setInterval(persistHistory, 120000);

    // 首次运行且没有任何源解析成功 → 打开设置页引导
    const anyResolved = enabledSources().some(s => resolveSourceLog(s));
    if (!anyResolved) setTimeout(createSettingsWin, 1200);
  });

  app.on('will-quit', () => {
    persistHistory();
    globalShortcut.unregisterAll();
    Object.keys(CTX).forEach(uid => { const c = CTX[uid]; if (c.watcher) try { c.watcher.close(); } catch(e) {} });
    clearInterval(monitorTimer);
    clearInterval(logRotateTimer);
    clearInterval(persistTimer);
  });

  app.on('window-all-closed', e => { if (e && e.preventDefault) e.preventDefault(); });
}
