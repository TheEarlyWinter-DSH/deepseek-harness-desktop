window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-desktop-control",
  factory: () => {
    const module = { exports: {} };
    const PANEL_ID = '__dsh_desktop_panel__';
const STYLE_ID = '__dsh_desktop_panel_css__';

const PERMISSIONS = [
  {
    id: 'read-only',
    title: '只读',
    description: '可以分析项目和读取文件，文件修改会被阻止。',
  },
  {
    id: 'workspace-write',
    title: '工作区写入',
    description: '可修改当前项目；越出工作区时需要批准。推荐日常使用。',
    recommended: true,
  },
  {
    id: 'danger-full-access',
    title: '完全访问',
    description: '不限制文件修改，也不会弹出批准请求。仅用于可信任务。',
    danger: true,
  },
];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${PANEL_ID}{position:fixed;inset:36px 0 0;z-index:2147482999;display:grid;place-items:center;padding:24px;
  background:rgba(3,7,18,.68);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  font-family:var(--dsw-font-family,"Segoe UI","Microsoft YaHei",system-ui,sans-serif);-webkit-app-region:no-drag}
#${PANEL_ID}[hidden]{display:none}
#${PANEL_ID} .ddp-shell{width:min(760px,calc(100vw - 40px));max-height:calc(100vh - 84px);overflow:auto;
  color:var(--dsw-alias-label-primary,#e7edff);background:var(--dsw-alias-bg-layer-1,#101827);
  border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));border-radius:8px;
  box-shadow:0 24px 80px rgba(0,0,0,.58)}
#${PANEL_ID} .ddp-head{display:flex;align-items:flex-start;gap:16px;padding:22px 24px 18px;
  border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}
#${PANEL_ID} .ddp-title{font-size:19px;font-weight:650;line-height:26px}
#${PANEL_ID} .ddp-sub{margin-top:4px;color:var(--dsw-alias-label-tertiary,#94a3b8);font-size:12.5px;line-height:19px}
#${PANEL_ID} .ddp-close{margin-left:auto;width:30px;height:30px;border:0;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary,#b8c5ea);font-size:20px;cursor:pointer}
#${PANEL_ID} .ddp-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
#${PANEL_ID} .ddp-body{padding:20px 24px 24px}
#${PANEL_ID} .ddp-section+ .ddp-section{margin-top:22px}
#${PANEL_ID} .ddp-label{font-size:13px;font-weight:600;margin-bottom:9px}
#${PANEL_ID} .ddp-readiness{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#${PANEL_ID} .ddp-status{min-width:0;padding:11px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));
  border-radius:7px;background:var(--dsw-alias-bg-module-platform,rgba(255,255,255,.035))}
#${PANEL_ID} .ddp-status strong{display:block;font-size:12.5px;line-height:18px}
#${PANEL_ID} .ddp-status span{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary,#94a3b8);
  font-size:11.5px;line-height:17px;overflow-wrap:anywhere}
#${PANEL_ID} .ddp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:#eab308}
#${PANEL_ID} .ddp-dot.ok{background:#35c873}
#${PANEL_ID} .ddp-permissions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#${PANEL_ID} .ddp-permission{position:relative;display:block;min-width:0;padding:13px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.11));
  border-radius:7px;background:var(--dsw-alias-bg-module-platform,rgba(255,255,255,.035));cursor:pointer}
#${PANEL_ID} .ddp-permission:has(input:checked){border-color:var(--dsw-alias-accent-primary,#5b8cff);
  box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#5b8cff) inset;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8cff) 9%,transparent)}
#${PANEL_ID} .ddp-permission input{position:absolute;opacity:0;pointer-events:none}
#${PANEL_ID} .ddp-permission strong{display:block;font-size:13px;line-height:19px}
#${PANEL_ID} .ddp-permission span{display:block;margin-top:4px;color:var(--dsw-alias-label-tertiary,#94a3b8);font-size:11.5px;line-height:17px}
#${PANEL_ID} .ddp-tag{display:inline-flex!important;width:max-content;margin:0 0 5px!important;padding:1px 6px;border-radius:4px;
  color:#9ec0ff!important;background:rgba(91,140,255,.14);font-size:10px!important;line-height:16px!important}
#${PANEL_ID} .ddp-tag.danger{color:#ff9ba4!important;background:rgba(239,68,68,.14)}
#${PANEL_ID} .ddp-checks{display:grid;gap:8px}
#${PANEL_ID} .ddp-check{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--dsw-alias-label-secondary,#c5d0eb)}
#${PANEL_ID} .ddp-note{padding:10px 12px;border-left:3px solid #5b8cff;background:rgba(91,140,255,.08);
  color:var(--dsw-alias-label-secondary,#c5d0eb);font-size:11.5px;line-height:18px}
#${PANEL_ID} .ddp-actions{position:sticky;bottom:-24px;z-index:2;display:flex;justify-content:flex-end;gap:8px;
  margin:22px -24px -24px;padding:14px 24px 18px;background:var(--dsw-alias-bg-layer-1,#101827);
  border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}
#${PANEL_ID} .ddp-btn{min-height:32px;padding:0 13px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));
  border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#e7edff);font:inherit;font-size:12.5px;cursor:pointer}
#${PANEL_ID} .ddp-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
#${PANEL_ID} .ddp-btn.primary{border-color:#4f79e8;background:#4f79e8;color:white}
#${PANEL_ID} .ddp-btn:disabled{opacity:.55;cursor:wait}
#${PANEL_ID} .ddp-error{margin-top:10px;color:#ff8a96;font-size:11.5px;text-align:right}
#${PANEL_ID} .ddp-diag{display:grid;grid-template-columns:170px minmax(0,1fr);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));border-radius:7px;overflow:hidden}
#${PANEL_ID} .ddp-diag dt,#${PANEL_ID} .ddp-diag dd{margin:0;padding:9px 11px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));font-size:12px;line-height:18px}
#${PANEL_ID} .ddp-diag dt{color:var(--dsw-alias-label-tertiary,#94a3b8);background:rgba(255,255,255,.025)}
#${PANEL_ID} .ddp-diag dd{font-family:var(--ds-font-family-code,Consolas,monospace);overflow-wrap:anywhere}
#${PANEL_ID} .ddp-diag dt:last-of-type,#${PANEL_ID} .ddp-diag dd:last-of-type{border-bottom:0}
@media(max-width:680px){#${PANEL_ID}{padding:10px}#${PANEL_ID} .ddp-shell{width:100%;max-height:calc(100vh - 56px)}
  #${PANEL_ID} .ddp-readiness,#${PANEL_ID} .ddp-permissions{grid-template-columns:1fr}#${PANEL_ID} .ddp-diag{grid-template-columns:1fr}
  #${PANEL_ID} .ddp-diag dt{border-bottom:0;padding-bottom:2px}#${PANEL_ID} .ddp-diag dd{padding-top:2px}}
`;
  document.head.appendChild(style);
}

function createPanel() {
  ensureStyles();
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closePanel();
  });
  document.body.appendChild(panel);
  return panel;
}

function closePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.hidden = true;
}

function bindClose(panel) {
  panel.querySelector('.ddp-close')?.addEventListener('click', closePanel);
}

function readinessCard(title, ok, detail) {
  return `<div class="ddp-status"><strong><i class="ddp-dot ${ok ? 'ok' : ''}"></i>${esc(title)}</strong><span>${esc(detail)}</span></div>`;
}

async function openSetup(dshDesktop, force = false) {
  const panel = createPanel();
  const response = await dshDesktop.setup.get();
  if (!response?.ok) return;
  const setup = response.setup;
  if (setup.completed && !force) return;
  const selected = PERMISSIONS.some((item) => item.id === setup.permissionPreset) ? setup.permissionPreset : 'workspace-write';
  panel.innerHTML = `
    <div class="ddp-shell" role="dialog" aria-modal="true" aria-labelledby="ddp-setup-title">
      <div class="ddp-head"><div><div class="ddp-title" id="ddp-setup-title">开始使用 DeepSeek Harness</div>
        <div class="ddp-sub">确认运行环境与默认权限。密钥仍由 DSH 设置页保存，桌面向导不会读取密钥内容。</div></div>
        <button class="ddp-close" title="关闭" aria-label="关闭">×</button></div>
      <div class="ddp-body">
        <section class="ddp-section"><div class="ddp-label">环境状态</div><div class="ddp-readiness">
          ${readinessCard('DSH 内核', true, `v${setup.agentVersion || '已内置'}`)}
          ${readinessCard('模型配置', setup.modelConfigured, setup.modelConfigured ? setup.defaultModel : '请在 DSH 设置中选择默认模型')}
          ${readinessCard('API 凭据', setup.credentialsConfigured, setup.credentialsConfigured ? '已检测到凭据文件' : '请在 DSH 设置中配置 Provider')}
        </div></section>
        <section class="ddp-section"><div class="ddp-label">新会话默认权限</div><div class="ddp-permissions">
          ${PERMISSIONS.map((item) => `<label class="ddp-permission">
            <input type="radio" name="permission" value="${item.id}" ${item.id === selected ? 'checked' : ''}>
            ${item.recommended ? '<span class="ddp-tag">推荐</span>' : item.danger ? '<span class="ddp-tag danger">高风险</span>' : ''}
            <strong>${item.title}</strong><span>${item.description}</span></label>`).join('')}
        </div></section>
        <section class="ddp-section"><div class="ddp-label">桌面偏好</div><div class="ddp-checks">
          <label class="ddp-check"><input type="checkbox" data-field="notify" ${setup.notifyOnTurnEnd ? 'checked' : ''}> 会话完成后发送系统通知</label>
          <label class="ddp-check"><input type="checkbox" data-field="tray" ${setup.closeToTray ? 'checked' : ''}> 关闭窗口时继续在系统托盘运行</label>
        </div></section>
        <div class="ddp-note">权限设置应用于之后创建的新会话。当前会话仍可使用输入框旁的 DSH 原生权限控件单独切换。</div>
        <div class="ddp-error" hidden></div>
        <div class="ddp-actions"><button class="ddp-btn" data-act="later">稍后设置</button><button class="ddp-btn primary" data-act="save">保存并重启服务</button></div>
      </div>
    </div>`;
  panel.hidden = false;
  bindClose(panel);
  panel.querySelector('[data-act="later"]')?.addEventListener('click', closePanel);
  panel.querySelector('[data-act="save"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const error = panel.querySelector('.ddp-error');
    const permissionPreset = panel.querySelector('input[name="permission"]:checked')?.value || 'workspace-write';
    button.disabled = true;
    error.hidden = true;
    const saved = await dshDesktop.setup.save({
      permissionPreset,
      notifyOnTurnEnd: panel.querySelector('[data-field="notify"]').checked,
      closeToTray: panel.querySelector('[data-field="tray"]').checked,
    });
    if (!saved?.ok) {
      button.disabled = false;
      error.textContent = saved?.error || '保存失败';
      error.hidden = false;
      return;
    }
    closePanel();
    if (saved.restartRecommended) await dshDesktop.restartService();
  });
}

const DIAGNOSTIC_LABELS = {
  appVersion: '桌面端版本', agentVersion: 'DSH 内核版本', agentSource: '内核来源', permissionPreset: '默认权限',
  platform: '平台', runtime: 'Electron Node', packaged: '发行模式', serverRunning: '服务状态', serverPid: '服务 PID',
  webUrl: 'Web UI', userDataDir: '桌面数据目录', dshHome: 'DSH_HOME', settingsPath: '设置文件', logsDir: '日志目录',
  overlayVersion: 'Overlay 版本', bundledVersion: '内置版本',
};

function formatDiagnostic(key, value) {
  if (key === 'packaged') return value ? '安装包' : '开发模式';
  if (key === 'serverRunning') return value ? '运行中' : '未运行';
  if (value === '' || value == null) return '—';
  return String(value);
}

async function openDiagnostics(dshDesktop) {
  const panel = createPanel();
  const data = await dshDesktop.diagnostics();
  if (!data) return;
  const rows = Object.keys(DIAGNOSTIC_LABELS).map((key) => `<dt>${esc(DIAGNOSTIC_LABELS[key])}</dt><dd>${esc(formatDiagnostic(key, data[key]))}</dd>`).join('');
  panel.innerHTML = `
    <div class="ddp-shell" role="dialog" aria-modal="true" aria-labelledby="ddp-diag-title">
      <div class="ddp-head"><div><div class="ddp-title" id="ddp-diag-title">版本与诊断</div>
        <div class="ddp-sub">这里只展示运行状态和本机路径，不包含 API Key、凭据内容或对话数据。</div></div>
        <button class="ddp-close" title="关闭" aria-label="关闭">×</button></div>
      <div class="ddp-body"><dl class="ddp-diag">${rows}</dl>
        <div class="ddp-actions"><button class="ddp-btn" data-act="setup">重新运行向导</button><button class="ddp-btn" data-act="logs">打开日志目录</button><button class="ddp-btn primary" data-act="copy">复制诊断信息</button></div>
      </div>
    </div>`;
  panel.hidden = false;
  bindClose(panel);
  panel.querySelector('[data-act="setup"]')?.addEventListener('click', () => openSetup(dshDesktop, true));
  panel.querySelector('[data-act="logs"]')?.addEventListener('click', () => dshDesktop.menu.action('open-logs'));
  panel.querySelector('[data-act="copy"]')?.addEventListener('click', async (event) => {
    const text = Object.keys(DIAGNOSTIC_LABELS).map((key) => `${DIAGNOSTIC_LABELS[key]}: ${formatDiagnostic(key, data[key])}`).join('\n');
    await dshDesktop.copyText(text);
    event.currentTarget.textContent = '已复制';
  });
}

function installDesktopPanels(dshDesktop) {
  return {
    openSetup: (force = true) => openSetup(dshDesktop, force),
    openDiagnostics: () => openDiagnostics(dshDesktop),
    openFirstRun: () => openSetup(dshDesktop, false),
    close: closePanel,
  };
}

function apply() {
  if (!window.dshDesktop) return;
  const panels = installDesktopPanels(window.dshDesktop);
  const onOpen = (event) => {
    if (event.detail === 'setup') panels.openSetup(true);
    else if (event.detail === 'diagnostics') panels.openDiagnostics();
  };
  window.addEventListener('dsh-desktop-open-panel', onOpen);
  setTimeout(() => panels.openFirstRun(), 350);
  return () => {
    window.removeEventListener('dsh-desktop-open-panel', onOpen);
    panels.close();
  };
}

module.exports.apply = apply;
return module.exports;
  },
});
