'use strict';

// plugin-guard.js — 桌面端内置的插件保护中心
const fs = require('node:fs');
const path = require('node:path');

const GUARD_FILES = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml'];
const MAX_SNAPSHOTS = 10;

// 静态高危木马扫描特征
const TROJAN_PATTERNS = [
  { code: 'TROJAN_REMOTE_EXEC', re: /(?:child_process|execSync|spawnSync|exec|spawn)\s*\(\s*['"`](?:curl|wget|powershell|cmd|bash|sh)\b[^'"`]*['"`][\s\S]{0,200}(?:\|\s*(?:sh|bash|iex|Invoke-Expression)|-enc\b)/i },
  { code: 'TROJAN_DOWNLOAD_EXEC', re: /(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr)\b[\s\S]{0,160}?(?:\|\s*(?:sh|bash|iex|Invoke-Expression)\b|Out-File[\s\S]{0,80}\.(?:ps1|bat|cmd|vbs))/i },
  { code: 'TROJAN_BASE64_EVAL', re: /(?:eval|Function)\s*\(\s*(?:atob\s*\(|Buffer\.from\([^)]*,\s*['"]base64['"]\)|window\.atob\s*\()/i },
  { code: 'TROJAN_PERSISTENCE', re: /(?:reg(?:\.exe)?\s+add[\s\S]{0,120}(?:Run|RunOnce)|Startup[\\\\/][\w.-]+\.(?:bat|cmd|ps1|vbs|lnk)|schtasks\s+\/create|Register-ScheduledTask)/i },
  { code: 'TROJAN_EXFIL_ENV', re: /(?:process\.env|os\.env)[\s\S]{0,120}(?:https?:\/\/|fetch\s*\(|XMLHttpRequest|net\.connect|dgram)/i },
];
const SCAN_MAX_FILE_BYTES = 2 * 1024 * 1024;
const SCAN_MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const SCAN_EXTS = /\.(c?js|mjs|cjs|json|yml|yaml|sh|ps1|bat|cmd)$/i;

function createGuard(opts) {
  const {
    getHome,
    getProfile,
    dshBin,
    log = () => {},
  } = opts;

  const home = () => getHome() || path.join(require('node:os').homedir(), '.dsh');
  const profileDir = () => path.join(home(), 'profiles', getProfile());
  const guardDir = () => path.join(home(), 'guard');
  const rollbacksDir = () => path.join(home(), 'rollbacks', getProfile());
  const stateFile = () => path.join(guardDir(), 'state.json');
  const incidentsDir = () => path.join(guardDir(), 'incidents');

  function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
  }

  function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp-' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
    try { fs.renameSync(tmp, file); } catch {
      fs.rmSync(file, { force: true, maxRetries: 3 });
      fs.renameSync(tmp, file);
    }
  }

  function patchRowIds(patch) {
    const ids = [];
    const re = /^\s*-\s*id:\s*([\w.-]+)\s*$/gm;
    let m;
    while ((m = re.exec(String(patch || ''))) !== null) ids.push(m[1]);
    return ids;
  }

  function snapshot(reason) {
    try {
      const dir = profileDir();
      if (!fs.existsSync(dir)) return null;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
      const dest = path.join(rollbacksDir(), stamp);
      fs.mkdirSync(dest, { recursive: true });
      const files = [];
      const rows = [];
      for (const name of GUARD_FILES) {
        const src = path.join(dir, name);
        if (!fs.existsSync(src)) continue;
        fs.copyFileSync(src, path.join(dest, name));
        files.push(name);
        if (name === 'cordis.patch.yml') {
          for (const id of patchRowIds(fs.readFileSync(src, 'utf8'))) rows.push(id);
        }
      }
      const meta = {
        id: stamp, reason: String(reason || 'manual'), at: new Date().toISOString(),
        files, pluginRows: rows,
      };
      writeJson(path.join(dest, 'meta.json'), meta);
      pruneSnapshots();
      log('guard', `已创建快照 ${stamp}（${reason}，${files.length} 个文件，${rows.length} 个插件行）`);
      return meta;
    } catch (err) {
      log('guard', '创建快照失败: ' + err.message);
      return null;
    }
  }

  function listSnapshots() {
    try {
      const root = rollbacksDir();
      if (!fs.existsSync(root)) return [];
      const out = [];
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const meta = readJson(path.join(root, entry.name, 'meta.json'));
        if (!meta || !Array.isArray(meta.files) || meta.files.length === 0) continue;
        out.push(meta);
      }
      out.sort((a, b) => String(b.id).localeCompare(String(a.id)));
      return out;
    } catch {
      return [];
    }
  }

  function pruneSnapshots() {
    try {
      const list = listSnapshots();
      for (let i = MAX_SNAPSHOTS; i < list.length; i += 1) {
        fs.rmSync(path.join(rollbacksDir(), list[i].id), { recursive: true, force: true, maxRetries: 2 });
      }
    } catch {}
  }

  function restore(id) {
    try {
      if (!/^[\w.-]+$/.test(String(id || ''))) return { ok: false, error: 'bad snapshot id' };
      const snapDir = path.join(rollbacksDir(), String(id));
      if (!fs.existsSync(snapDir)) return { ok: false, error: 'snapshot not found' };
      const dir = profileDir();
      fs.mkdirSync(dir, { recursive: true });
      snapshot('pre-restore:' + id);
      const restored = [];
      for (const name of GUARD_FILES) {
        const src = path.join(snapDir, name);
        if (!fs.existsSync(src)) continue;
        fs.copyFileSync(src, path.join(dir, name));
        restored.push(name);
      }
      log('guard', `已回滚 profile 到快照 ${id}（${restored.join(', ')}）`);
      return { ok: true, restored };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }

  function state() {
    return readJson(stateFile(), {});
  }

  function markGood(id) {
    try {
      const s = state();
      s.lastGood = id || null;
      s.lastGoodAt = new Date().toISOString();
      writeJson(stateFile(), s);
    } catch {}
  }

  function lastGoodSnapshot() {
    const s = state();
    if (!s.lastGood) return null;
    return listSnapshots().find((m) => m.id === s.lastGood) || null;
  }

  function trojanFindings(dir) {
    const out = [];
    try {
      const builtin = new Set(readJson(path.join(dir, '.dsh-builtin-plugins.json'), { names: [] }).names || []);
      const modulesDir = path.join(dir, 'node_modules');
      if (!fs.existsSync(modulesDir)) return out;
      let total = 0;
      const walk = (d, depth) => {
        if (depth > 4 || total > SCAN_MAX_TOTAL_BYTES || out.length >= 20) return;
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (e.name === '.pnpm' || e.name.startsWith('.')) continue;
          const p = path.join(d, e.name);
          if (e.isDirectory()) {
            const pkg = readJson(path.join(p, 'package.json'), null);
            if (pkg && builtin.has(pkg.name)) continue;
            walk(p, depth + 1);
          } else if (e.isFile() && SCAN_EXTS.test(e.name)) {
            let st;
            try { st = fs.statSync(p); } catch { continue; }
            if (st.size > SCAN_MAX_FILE_BYTES || total + st.size > SCAN_MAX_TOTAL_BYTES) continue;
            total += st.size;
            let text;
            try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
            for (const { code, re } of TROJAN_PATTERNS) {
              if (re.test(text)) {
                out.push({
                  code,
                  severity: 'high',
                  message: `静态扫描命中高危模式（${code}）：${path.relative(modulesDir, p)}`,
                  fixable: false,
                });
                break;
              }
            }
          }
        }
      };
      walk(modulesDir, 0);
    } catch {}
    return out;
  }

  function healthCheck() {
    const findings = [];
    const dir = profileDir();
    findings.push(...trojanFindings(dir));
    return { at: new Date().toISOString(), profile: getProfile(), findings };
  }

  return {
    snapshot,
    listSnapshots,
    restore,
    state,
    markGood,
    lastGoodSnapshot,
    healthCheck,
    trojanFindings,
  };
}

module.exports = {
  createGuard,
  TROJAN_PATTERNS,
  GUARD_FILES,
};
