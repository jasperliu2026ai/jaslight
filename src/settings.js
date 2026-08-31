const { ipcRenderer } = require('electron');

let cfg = {};
let presets = [];
let platform = 'darwin';
const openCards = new Set();

const SKIN_OPTS = [
  ['orb','光球（默认）','Orb (default)'],
  ['cat','🐱 猫咪','🐱 Cat'], ['dog','🐶 小狗','🐶 Dog'],
  ['penguin','🐧 企鹅','🐧 Penguin'], ['fox','🦊 狐狸','🦊 Fox'],
  ['panda','🐼 熊猫','🐼 Panda'], ['chick','🐥 小鸡','🐥 Chick'],
  ['rabbit','🐰 兔子','🐰 Rabbit'], ['hamster','🐹 仓鼠','🐹 Hamster'],
  ['frog','🐸 青蛙','🐸 Frog'], ['bear','🐻 小熊','🐻 Bear'],
];
const SOUNDS_MAC = ['Ping','Glass','Pop','Tink','Submarine','Hero','Blow','Bottle'];
const SOUNDS_WIN = ['Windows Notify','Windows Ding','Windows Exclamation','Windows Critical Stop','Beep'];

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── Tab ──
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('pane-' + t.dataset.pane).classList.add('active');
  });
});

document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('close-win'));
document.getElementById('langBtn').addEventListener('click', () => {
  window.LANG = window.LANG === 'zh' ? 'en' : 'zh';
  document.getElementById('langBtn').textContent = window.LANG === 'zh' ? 'EN' : '中';
  cfg.lang = window.LANG;
  window.applyI18n();
  renderSkins(); renderSounds(); renderSources(); renderPresets();
});

document.getElementById('autoDetect').addEventListener('click', () => ipcRenderer.send('auto-detect'));
document.getElementById('exportCfg').addEventListener('click', () => ipcRenderer.send('export-config'));
document.getElementById('importCfg').addEventListener('click', () => ipcRenderer.send('import-config'));
document.getElementById('testSound').addEventListener('click', () => ipcRenderer.send('test-sound', document.getElementById('soundName').value));
document.getElementById('saveBtn').addEventListener('click', save);
document.getElementById('opacity').addEventListener('input', e => {
  document.getElementById('opacity-val').textContent = e.target.value + '%';
});

// ── 下拉选项 ──
function renderSkins() {
  const sel = document.getElementById('skin');
  const cur = cfg.skin || 'orb';
  sel.innerHTML = SKIN_OPTS.map(([id, zh, en]) =>
    `<option value="${id}"${id===cur?' selected':''}>${esc(window.LANG==='zh'?zh:en)}</option>`).join('');
}
function renderSounds() {
  const sel = document.getElementById('soundName');
  const list = platform === 'win32' ? SOUNDS_WIN : SOUNDS_MAC;
  const cur = cfg.soundName || list[0];
  sel.innerHTML = list.map(s => `<option value="${esc(s)}"${s===cur?' selected':''}>${esc(s)}</option>`).join('');
}

// ── 源卡片 ──
function renderSources() {
  const box = document.getElementById('srcList');
  const list = cfg.sources || [];
  if (!list.length) {
    box.innerHTML = `<div class="hint" style="padding:14px;text-align:center">${esc(window.t('noSources'))}</div>`;
    return;
  }
  box.innerHTML = list.map(s => {
    const open = openCards.has(s.uid);
    const p = s.patterns || {};
    return `
    <div class="src-card ${open?'open':''} ${s.enabled?'':'disabled'}" data-uid="${esc(s.uid)}">
      <div class="src-head" data-act="toggle-open">
        <span class="src-arrow">▶</span>
        <span class="src-icon">${esc(s.icon||'•')}</span>
        <span class="src-name">${esc(s.name)}</span>
        <span class="src-badge ${s.enabled?'':'err'}">${esc(s.enabled?window.t('enabled'):window.t('disabled'))}</span>
        <label class="toggle" style="width:34px;height:19px" onclick="event.stopPropagation()">
          <input type="checkbox" data-field="enabled" ${s.enabled?'checked':''}>
          <span class="slider" style="border-radius:10px"></span>
        </label>
      </div>
      <div class="src-body">
        <div class="field">
          <span class="field-label">${esc(window.t('fName'))}</span>
          <input type="text" data-field="name" value="${esc(s.name)}">
        </div>
        <div class="field">
          <span class="field-label">${esc(window.t('fLogPath'))}</span>
          <input type="text" data-field="logPath" value="${esc(s.logPath||'')}">
          <span class="field-hint">${esc(window.t('fLogPathHint'))}</span>
          <div class="btn-row" style="margin-top:3px">
            <button class="btn" data-act="test">${esc(window.t('testPath'))}</button>
            <button class="btn danger" data-act="remove">${esc(window.t('remove'))}</button>
          </div>
          <div class="test-out" data-out style="display:none"></div>
        </div>
        <div style="display:flex;gap:9px">
          <div class="field" style="flex:1">
            <span class="field-label">${esc(window.t('fProcess'))}</span>
            <input type="text" data-field="processName" value="${esc(s.processName||'')}">
          </div>
          <div class="field" style="flex:1">
            <span class="field-label">${esc(window.t('fApp'))}</span>
            <input type="text" data-field="appName" value="${esc(s.appName||'')}">
          </div>
        </div>
        <div class="field">
          <span class="field-label">${esc(window.t('patterns'))}</span>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:2px">
            <div><div class="field-hint">${esc(window.t('pStart'))}</div><input type="text" data-pattern="start" value="${esc(p.start||'')}"></div>
            <div><div class="field-hint">${esc(window.t('pWorking'))}</div><input type="text" data-pattern="working" value="${esc(p.working||'')}"></div>
            <div><div class="field-hint">${esc(window.t('pDecision'))}</div><input type="text" data-pattern="decision" value="${esc(p.decision||'')}"></div>
            <div><div class="field-hint">${esc(window.t('pDone'))}</div><input type="text" data-pattern="done" value="${esc(p.done||'')}"></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // 事件绑定
  box.querySelectorAll('.src-card').forEach(card => {
    const uid = card.dataset.uid;
    card.querySelector('[data-act="toggle-open"]').addEventListener('click', () => {
      if (openCards.has(uid)) openCards.delete(uid); else openCards.add(uid);
      card.classList.toggle('open');
    });
    const testBtn = card.querySelector('[data-act="test"]');
    if (testBtn) testBtn.addEventListener('click', () => {
      const tpl = card.querySelector('[data-field="logPath"]').value;
      ipcRenderer.send('test-log-path', { tpl, id: uid });
    });
    const rmBtn = card.querySelector('[data-act="remove"]');
    if (rmBtn) rmBtn.addEventListener('click', () => {
      openCards.delete(uid);
      ipcRenderer.send('remove-source', { uid });
    });
  });
}

// ── 模板网格 ──
function renderPresets() {
  document.getElementById('presetGrid').innerHTML = presets.map(p => `
    <div class="preset-item" data-preset="${esc(p.id)}" title="${esc(p.desc)}">
      <span class="pi-icon">${esc(p.icon)}</span>
      <span class="pi-name">${esc(p.name)}</span>
    </div>`).join('');
  document.querySelectorAll('[data-preset]').forEach(el => {
    el.addEventListener('click', () => ipcRenderer.send('add-source', { presetId: el.dataset.preset }));
  });
}

// ── 填充表单 ──
function fill(c) {
  cfg = c;
  if (c.lang && c.lang !== window.LANG) {
    window.LANG = c.lang;
    document.getElementById('langBtn').textContent = window.LANG === 'zh' ? 'EN' : '中';
    window.applyI18n();
  }
  renderSkins(); renderSounds(); renderSources();

  document.getElementById('opacity').value = Math.round((c.opacity||1)*100);
  document.getElementById('opacity-val').textContent = Math.round((c.opacity||1)*100) + '%';
  document.getElementById('locked').checked          = !!c.locked;
  document.getElementById('showMiniStats').checked   = c.showMiniStats !== false;
  document.getElementById('showSourceRows').checked  = c.showSourceRows !== false;
  document.getElementById('autoLaunch').checked      = !!c.autoLaunch;
  document.getElementById('jumpOnDecision').checked  = c.jumpOnDecision !== false;
  document.getElementById('hotkeyPanel').value       = c.hotkeyPanel || '';
  document.getElementById('hotkeyFloat').value       = c.hotkeyFloat || '';
  document.getElementById('soundAlert').checked      = c.soundAlert !== false;
  document.getElementById('soundOnDone').checked     = !!c.soundOnDone;
  document.getElementById('pomodoro').checked        = c.pomodoro !== false;
  document.getElementById('pomodoroMin').value       = c.pomodoroMin || 25;
  document.getElementById('pomodoroBreakMin').value  = c.pomodoroBreakMin || 5;
  document.getElementById('alertWorking').checked    = c.alertWorking !== false;
  document.getElementById('alertWorkingMin').value   = c.alertWorkingMin || 10;
  document.getElementById('alertDecision').checked   = c.alertDecision !== false;
  document.getElementById('alertDecisionMin').value  = c.alertDecisionMin || 5;
  document.getElementById('alertIdle').checked       = c.alertIdle !== false;
  document.getElementById('alertIdleMin').value      = c.alertIdleMin || 30;
  document.getElementById('stuckMin').value          = Math.round((c.stuckThresholdMs||120000)/60000);
}

// ── 保存 ──
function save() {
  // 收集源卡片
  const sources = [];
  document.querySelectorAll('.src-card').forEach(card => {
    const uid = card.dataset.uid;
    const old = (cfg.sources||[]).find(s => s.uid === uid) || {};
    const g = sel => { const el = card.querySelector(sel); return el ? el.value : ''; };
    const patterns = {};
    card.querySelectorAll('[data-pattern]').forEach(el => { patterns[el.dataset.pattern] = el.value; });
    sources.push({
      ...old, uid,
      name:        g('[data-field="name"]') || old.name,
      logPath:     g('[data-field="logPath"]'),
      processName: g('[data-field="processName"]'),
      appName:     g('[data-field="appName"]'),
      enabled:     !!card.querySelector('[data-field="enabled"]')?.checked,
      patterns,
    });
  });
  if (sources.length && !sources.some(s => s.enabled)) sources[0].enabled = true;

  const newCfg = {
    sources,
    lang:            window.LANG,
    opacity:         parseInt(document.getElementById('opacity').value) / 100,
    locked:          document.getElementById('locked').checked,
    showMiniStats:   document.getElementById('showMiniStats').checked,
    showSourceRows:  document.getElementById('showSourceRows').checked,
    skin:            document.getElementById('skin').value,
    autoLaunch:      document.getElementById('autoLaunch').checked,
    jumpOnDecision:  document.getElementById('jumpOnDecision').checked,
    hotkeyPanel:     document.getElementById('hotkeyPanel').value.trim(),
    hotkeyFloat:     document.getElementById('hotkeyFloat').value.trim(),
    soundAlert:      document.getElementById('soundAlert').checked,
    soundName:       document.getElementById('soundName').value,
    soundOnDone:     document.getElementById('soundOnDone').checked,
    pomodoro:        document.getElementById('pomodoro').checked,
    pomodoroMin:     parseInt(document.getElementById('pomodoroMin').value)||25,
    pomodoroBreakMin:parseInt(document.getElementById('pomodoroBreakMin').value)||5,
    alertWorking:    document.getElementById('alertWorking').checked,
    alertWorkingMin: parseInt(document.getElementById('alertWorkingMin').value)||10,
    alertDecision:   document.getElementById('alertDecision').checked,
    alertDecisionMin:parseInt(document.getElementById('alertDecisionMin').value)||5,
    alertIdle:       document.getElementById('alertIdle').checked,
    alertIdleMin:    parseInt(document.getElementById('alertIdleMin').value)||30,
    stuckThresholdMs:(parseInt(document.getElementById('stuckMin').value)||2)*60000,
  };
  ipcRenderer.send('save-config', newCfg);
  const tip = document.getElementById('saved-tip');
  tip.textContent = window.t('saved');
  setTimeout(() => { tip.textContent = ''; }, 2000);
}

// ── IPC ──
ipcRenderer.on('config-data', (_, c) => fill(c));
ipcRenderer.on('presets-data', (_, d) => {
  presets = d.presets || [];
  platform = d.platform || 'darwin';
  renderPresets(); renderSounds();
});
ipcRenderer.on('test-log-path-result', (_, r) => {
  const card = document.querySelector(`.src-card[data-uid="${r.id}"]`);
  if (!card) return;
  const out = card.querySelector('[data-out]');
  out.style.display = '';
  if (r.ok) {
    out.className = 'test-out ok';
    out.textContent = `✓ ${window.t('resolved')}: ${r.resolved}  (${window.t('size')} ${(r.size/1024).toFixed(1)}KB, ${window.t('modified')} ${r.mtime})`;
  } else {
    out.className = 'test-out err';
    out.textContent = `✗ ${window.t('notFound')}`;
  }
});
ipcRenderer.on('auto-detect-result', (_, d) => {
  const box = document.getElementById('detectOut');
  if (!d.found || !d.found.length) {
    box.innerHTML = `<div class="hint">${esc(window.t('detectNone'))}</div>`;
    return;
  }
  const existing = new Set((cfg.sources||[]).map(s => s.presetId));
  box.innerHTML = `<div class="hint" style="margin-bottom:6px">${esc(window.t('detectFound'))}</div>
    <div class="preset-grid">` + d.found.map(f => `
      <div class="preset-item" data-detect="${esc(f.presetId)}" title="${esc(f.resolved)}">
        <span class="pi-icon">${esc(f.icon)}</span>
        <span class="pi-name">${esc(f.name)}${existing.has(f.presetId) ? ' ✓' : ''}</span>
      </div>`).join('') + '</div>';
  box.querySelectorAll('[data-detect]').forEach(el => {
    el.addEventListener('click', () => ipcRenderer.send('add-source', { presetId: el.dataset.detect }));
  });
});
ipcRenderer.on('export-done', (_, r) => {
  const tip = document.getElementById('saved-tip');
  tip.textContent = r.ok ? '✓ ' + r.path : (r.error ? '✗ ' + r.error : '');
  setTimeout(() => { tip.textContent = ''; }, 3000);
});

window.applyI18n();
ipcRenderer.send('get-config');
ipcRenderer.send('get-presets');
