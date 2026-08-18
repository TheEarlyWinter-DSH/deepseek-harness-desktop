'use strict';

// DeepSeek Harness Desktop 客户端自更新引擎
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { compareVersions } = require('./updater');

const DEFAULT_REPOS = {
  github: 'TheEarlyWinter-DSH/deepseek-harness-desktop',
  gitee: 'TheEarlyWinter/deepseek-harness-desktop',
};
const REPO_SLUG = /^[A-Za-z0-9_.-]{1,64}\/[A-Za-z0-9_.-]{1,64}$/;
const MIN_VALID_BYTES = 64 * 1024 * 1024; // 完整安装包远大于 64MB

function isPortable() {
  return !!process.env.PORTABLE_EXECUTABLE_DIR;
}

function currentArch() {
  const forced = String(process.env.DSH_DESKTOP_ARCH || '').trim();
  if (forced === 'x64' || forced === 'arm64') return forced;
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

function resolveRepos(repos) {
  const r = repos && typeof repos === 'object' ? repos : {};
  const github = REPO_SLUG.test(String(r.github || '')) ? r.github : DEFAULT_REPOS.github;
  const gitee = REPO_SLUG.test(String(r.gitee || '')) ? r.gitee : DEFAULT_REPOS.gitee;
  return { github, gitee };
}

function apiEndpoints() {
  if (process.env.DSH_DESKTOP_RELEASE_API) {
    return [{ name: '自定义镜像', url: process.env.DSH_DESKTOP_RELEASE_API }];
  }
  const { github, gitee } = resolveRepos();
  return [
    {
      name: 'GitHub',
      url: `https://api.github.com/repos/${github}/releases/latest`,
      headers: { Accept: 'application/vnd.github+json' },
    },
    { name: 'Gitee', url: `https://gitee.com/api/v5/repos/${gitee}/releases/latest` },
  ];
}

function resolveHttpProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy || '';
  const parts = String(raw).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(p) ? p : 'http://' + p);
      if (u.hostname) return { href: u.href };
    } catch {}
  }
  return null;
}

function rawRequest(url, requestHeaders, onResponse) {
  const proxy = resolveHttpProxy();
  if (proxy) {
    const proxyUrl = new URL(proxy.href);
    const mod = proxyUrl.protocol === 'https:' ? require('node:https') : require('node:http');
    return mod.request(proxyUrl, {
      method: 'GET',
      path: url,
      headers: { ...requestHeaders, Host: new URL(url).host },
    }, onResponse);
  }
  const u = new URL(url);
  const mod = u.protocol === 'https:' ? require('node:https') : require('node:http');
  return mod.request(u, { method: 'GET', headers: requestHeaders }, onResponse);
}

function httpGetJson(url, headers = {}, timeoutMs = 20000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const req = rawRequest(url, { 'User-Agent': 'DSH-Desktop', ...headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpGetJson(new URL(res.headers.location, url).toString(), headers, timeoutMs, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('error', reject);
      res.on('data', (c) => {
        body += c;
        if (body.length > 4 * 1024 * 1024) req.destroy(new Error('响应过大'));
      });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON 解析失败')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}

function normalizeRelease(source, data) {
  const tag = String(data.tag_name || data.tag || data.name || '').trim();
  const version = tag.replace(/^v/i, '');
  const assets = Array.isArray(data.assets)
    ? data.assets
        .map((a) => ({
          name: String(a.name || ''),
          url: String(a.browser_download_url || a.url || ''),
          size: Number(a.size || 0),
        }))
        .filter((a) => a.name && a.url)
    : [];
  return {
    source,
    version,
    name: data.name || null,
    body: String(data.body || ''),
    htmlUrl: data.html_url || null,
    assets,
  };
}

async function checkLatest(ctx, currentVersion) {
  const errors = [];
  const candidates = [];
  for (const ep of apiEndpoints()) {
    try {
      const data = await httpGetJson(ep.url, ep.headers || {});
      const rel = normalizeRelease(ep.name, data);
      if (!rel.version || !rel.assets.length) {
        throw new Error('上游 release 缺少版本号或安装包资产');
      }
      rel.isNewer = compareVersions(rel.version, currentVersion) > 0;
      candidates.push(rel);
      ctx.log('client-update', `[${ep.name}] latest=${rel.version} 当前=${currentVersion} 资产数=${rel.assets.length}`);
    } catch (err) {
      errors.push(`${ep.name}: ${err.message}`);
      ctx.log('client-update', `[${ep.name}] 查询失败: ${err.message}`);
    }
  }
  if (candidates.length === 0) {
    throw new Error('无法连接上游发布源（' + errors.join('；') + '）');
  }
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  const best = candidates[0];
  ctx.log('client-update', `选用最高版本源 [${best.source}] ${best.version}`);
  return best;
}

function platformKind() {
  const forced = String(process.env.DSH_DESKTOP_PLATFORM || '').trim();
  if (forced === 'macos' || forced === 'win') return forced;
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'win';
  return null;
}

function selectAsset(release) {
  const arch = currentArch();
  const mac = platformKind() === 'macos';
  const wanted = mac
    ? new RegExp(`-macos-${arch}\\.(?:zip|dmg)$`, 'i')
    : isPortable()
      ? new RegExp(`(?:-portable-|-Portable-)${arch}\\.exe$`, 'i')
      : new RegExp(`(?:-setup-|-Setup-)(?:.*-)?${arch}\\.exe$`, 'i');
  const direct = release.assets.find((a) => wanted.test(a.name));
  if (direct) return { parts: [direct], name: direct.name, totalSize: direct.size };

  const bases = mac
    ? [`DeepSeek-Harness-${release.version}-macos-${arch}.zip`]
    : isPortable()
      ? [
          `DeepSeek-Harness-Portable-${arch}.exe`,
          `DeepSeek-Harness-${release.version}-win-portable-${arch}.exe`,
          `DSH-Desktop-${release.version}-win-portable-${arch}.exe`,
        ]
      : [
          `DeepSeek-Harness-Setup-${arch}.exe`,
          `DeepSeek-Harness-${release.version}-win-setup-${arch}.exe`,
          `DSH-Desktop-${release.version}-win-setup-${arch}.exe`,
        ];
  for (const base of bases) {
    const n = (s) => parseInt(s.split('part').pop(), 10) || 0;
    const parts = release.assets
      .filter((a) => a.name.startsWith(base + '.part'))
      .sort((a, b) => n(a.name) - n(b.name));
    const seqOk = parts.every((p, i) => n(p.name) === i + 1);
    if (parts.length && seqOk) {
      return { parts, name: base, totalSize: parts.reduce((s, p) => s + p.size, 0) };
    }
  }
  // Generic fallback: pick first exe matching arch or portable
  const fallback = release.assets.find((a) => a.name.endsWith('.exe') && a.name.includes(arch));
  if (fallback) return { parts: [fallback], name: fallback.name, totalSize: fallback.size };

  throw new Error('未找到匹配的安装包资产（' + release.assets.map((a) => a.name).join(', ') + '）');
}

function downloadFile(url, dest, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.part';
    const file = fs.createWriteStream(tmp);
    let received = 0;
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    const fail = (err) => {
      if (settled) return;
      file.close(() => {
        try { fs.rmSync(tmp, { force: true }); } catch {}
      });
      finish(reject, err);
    };
    const request = (url2, redirects) => {
      if (redirects > 5) return fail(new Error('重定向次数过多'));
      const req = rawRequest(url2, { 'User-Agent': 'DSH-Desktop' }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return request(new URL(res.headers.location, url2).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return fail(new Error('下载失败 HTTP ' + res.statusCode));
        }
        res.on('aborted', () => fail(new Error('下载连接被中断')));
        res.on('error', fail);
        const total = Number(res.headers['content-length'] || 0);
        res.on('end', () => {
          if (total > 0 && received !== total) {
            return fail(new Error(`下载不完整（收到 ${received} / 声明 ${total} 字节）`));
          }
        });
        res.on('data', (c) => {
          received += c.length;
          if (onProgress) { try { onProgress(received, total); } catch {} }
        });
        res.pipe(file);
      });
      req.setTimeout(60000, () => req.destroy(new Error('下载超时')));
      req.on('error', fail);
      const deadline = setTimeout(() => req.destroy(new Error('下载总时长超过上限')), 60 * 60 * 1000);
      req.on('close', () => clearTimeout(deadline));
    };
    request(url, 0);
    file.on('finish', () => {
      if (settled) return;
      try { fs.renameSync(tmp, dest); } catch (err) { return finish(reject, err); }
      finish(resolve, { path: dest, size: received });
    });
    file.on('error', fail);
  });
}

async function concatFiles(sources, dest) {
  const out = fs.createWriteStream(dest);
  let writeError = null;
  out.on('error', (err) => { if (!writeError) writeError = err; });
  try {
    for (const s of sources) {
      await new Promise((res, rej) => {
        if (writeError) return rej(writeError);
        const rs = fs.createReadStream(s);
        rs.on('error', rej);
        rs.on('end', res);
        out.on('error', rej);
        rs.pipe(out, { end: false });
      });
      fs.rmSync(s, { force: true });
    }
    await new Promise((res, rej) => {
      out.end(res);
    });
  } catch (err) {
    out.destroy();
    try { fs.rmSync(dest, { force: true }); } catch {}
    throw err;
  }
}

async function downloadRelease(ctx, release, { onProgress } = {}) {
  const dir = path.join(ctx.userDataDir, 'updates');
  fs.mkdirSync(dir, { recursive: true });
  const sel = selectAsset(release);
  const split = sel.parts.length > 1;
  const finalPath = path.join(dir, sel.name);
  const partPaths = [];
  let merged = 0;
  try {
    for (let i = 0; i < sel.parts.length; i++) {
      const p = sel.parts[i];
      ctx.log('client-update', `下载 ${p.name}（${Math.round(p.size / 1048576)} MB）`);
      const dest = split ? finalPath + '.part' + (i + 1) : finalPath;
      const res = await downloadFile(p.url, dest, {
        onProgress: (r) => {
          if (onProgress) onProgress(split ? merged + r : r, sel.totalSize);
        },
      });
      if (split) { merged += res.size; partPaths.push(dest); }
    }
    if (split) {
      ctx.log('client-update', `合并 ${partPaths.length} 个分片 → ${sel.name}`);
      await concatFiles(partPaths, finalPath);
      partPaths.length = 0;
    }
  } catch (err) {
    for (const p of partPaths) { try { fs.rmSync(p, { force: true }); } catch {} }
    throw err;
  }
  const stat = fs.statSync(finalPath);
  if (stat.size < MIN_VALID_BYTES) {
    fs.rmSync(finalPath, { force: true });
    throw new Error('下载文件异常（仅 ' + Math.round(stat.size / 1048576) + ' MB），已丢弃');
  }
  ctx.log('client-update', `下载完成: ${finalPath}（${Math.round(stat.size / 1048576)} MB）`);
  return { filePath: finalPath, size: stat.size };
}

function cleanupPendingPackage(pending) {
  if (!pending || typeof pending !== 'object' || !pending.path) return;
  try { fs.rmSync(pending.path, { force: true }); } catch {}
  const dir = path.dirname(pending.path);
  const base = path.basename(pending.path);
  if (!base) return;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const f of entries) {
    if (f.startsWith(base + '.part')) {
      try { fs.rmSync(path.join(dir, f), { force: true }); } catch {}
    }
  }
}

function cmdExe() {
  return process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
}

const SYS = [
  'set "PG=%SystemRoot%\\System32\\ping.exe"',
].join('\r\n');

function buildPortableCmd() {
  return [
    '@echo off',
    SYS,
    'set "LOG=%~1"',
    'set "NEW=%~2"',
    'set "OLD=%~3"',
    'echo [%date% %time%] apply-update start (portable) >> "%LOG%"',
    'echo [%date% %time%] new=%NEW% >> "%LOG%"',
    'echo [%date% %time%] old=%OLD% >> "%LOG%"',
    'set /a tries=0',
    ':wait',
    'set /a tries+=1',
    'if %tries% gtr 300 goto replace_failed',
    '%PG% -n 2 127.0.0.1 >nul',
    'if not exist "%OLD%" goto replace',
    'copy /y "%OLD%" "%OLD%.bak" >nul 2>&1',
    'if errorlevel 1 goto wait_probe',
    'del /f /q "%OLD%" >nul 2>&1',
    'if exist "%OLD%" goto wait_probe',
    'goto replace',
    ':wait_probe',
    'if %tries% geq 10 (',
    '  copy /y NUL "%OLD%.dsh-write-test" >nul 2>&1',
    '  if errorlevel 1 goto replace_failed',
    '  del "%OLD%.dsh-write-test" >nul 2>&1',
    ')',
    'goto wait',
    ':replace',
    'echo [%date% %time%] replacing current build >> "%LOG%"',
    'set /a rtry=0',
    ':retry_replace',
    'copy /y "%NEW%" "%OLD%" >nul 2>&1',
    'if not errorlevel 1 goto replaced',
    'set /a rtry+=1',
    'if %rtry% lss 12 (',
    '  %PG% -n 2 127.0.0.1 >nul',
    '  goto retry_replace',
    ')',
    'goto replace_failed',
    ':replaced',
    'echo [%date% %time%] replace succeeded, deleting backup >> "%LOG%"',
    'del /f /q "%OLD%.bak" >nul 2>&1',
    'del /f /q "%NEW%" >nul 2>&1',
    'start "" "%OLD%"',
    'echo [%date% %time%] apply-update done >> "%LOG%"',
    'exit /b 0',
    ':replace_failed',
    'echo [%date% %time%] replace failed, falling back >> "%LOG%"',
    'if exist "%OLD%.bak" (',
    '  copy /y "%OLD%.bak" "%OLD%" >nul 2>&1',
    '  del /f /q "%OLD%.bak" >nul 2>&1',
    '  start "" "%OLD%"',
    ') else if exist "%NEW%" (',
    '  start "" "%NEW%"',
    ')',
    'exit /b 1',
  ].join('\r\n');
}

function buildNsisPs1() {
  return `param(
  [Parameter(Mandatory=$true)][string]$Setup,
  [Parameter(Mandatory=$true)][string]$ProcessName,
  [Parameter(Mandatory=$true)][string]$OldExe,
  [Parameter(Mandatory=$true)][string]$LogFile
)
function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8 -ErrorAction SilentlyContinue
}
Log "apply-update start (nsis)"
for ($i = 0; $i -lt 30; $i++) {
  $procs = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
  if ($procs.Count -eq 0) { break }
  Start-Sleep -Seconds 1
}
$setupSucceeded = $false
try {
  $proc = Start-Process -FilePath $Setup -PassThru -ErrorAction Stop
  $proc.WaitForExit()
  $setupSucceeded = ($proc.ExitCode -eq 0)
} catch {
  Log ("setup execution failed: " + $_.Exception.Message)
}
if ($setupSucceeded) {
  Remove-Item -LiteralPath $Setup -Force -ErrorAction SilentlyContinue
}
Log "apply-update done"
`;
}

function buildNsisCmd() {
  return [
    '@echo off',
    'set "PSEXE=%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"',
    'if not exist "%PSEXE%" set "PSEXE=powershell.exe"',
    'set "PS1=%~1"',
    'set "SETUP=%~2"',
    'set "PROC=%~3"',
    'set "OLD=%~4"',
    'set "LOGF=%~5"',
    '"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Setup "%SETUP%" -ProcessName "%PROC%" -OldExe "%OLD%" -LogFile "%LOGF%"',
  ].join('\r\n');
}

function applyUpdate(ctx, pending) {
  if (process.platform !== 'win32') {
    throw new Error('当前平台暂不支持客户端自动更新（请手动下载新版安装包）');
  }
  const newExe = pending.path;
  const dir = path.join(ctx.userDataDir, 'updates');
  const logFile = path.join(dir, 'apply-update.log');
  fs.mkdirSync(dir, { recursive: true });
  let script, child;
  if (isPortable()) {
    script = path.join(dir, 'apply-update.cmd');
    fs.writeFileSync(script, buildPortableCmd(), 'ascii');
    const oldExe = process.execPath;
    child = spawn(cmdExe(), ['/c', script, logFile, newExe, oldExe], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    const ps1 = path.join(dir, 'apply-update.ps1');
    fs.writeFileSync(ps1, buildNsisPs1(), 'utf8');
    script = path.join(dir, 'apply-update.cmd');
    fs.writeFileSync(script, buildNsisCmd(), 'ascii');
    const procName = path.basename(process.execPath, '.exe');
    const oldExe = process.execPath;
    child = spawn(cmdExe(), ['/c', script, ps1, newExe, procName, oldExe, logFile], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
  }
  child.unref();
  ctx.log('client-update', `已启动更新脚本 (PID=${child.pid})，退出主进程`);
}

module.exports = {
  checkLatest,
  selectAsset,
  downloadRelease,
  applyUpdate,
  cleanupPendingPackage,
  apiEndpoints,
  resolveRepos,
  resolveHttpProxy,
  platformKind,
  currentArch,
  isPortable,
  DEFAULT_REPOS,
  MIN_VALID_BYTES,
  _internals: {
    buildPortableCmd,
    buildNsisPs1,
    buildNsisCmd,
    normalizeRelease,
  },
};
