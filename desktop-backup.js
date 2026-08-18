'use strict';

// DSH Desktop 备份与恢复（纯函数模块：收集 / 校验 / 原子恢复 + 回滚）
const BACKUP_FORMAT = 'dsh-desktop-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 256;

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'sessions',
  'storages',
  'skills',
  'skills-disabled',
  'skill-toggle',
  'super-injector',
  'profiles',
]);

const SKIP_FILE_NAMES = new Set(['pnpm-lock.yaml', 'package-lock.json']);

const ALLOWED_EXT = new Set([
  '.yml', '.yaml', '.json', '.toml', '.txt', '.md', '.ini', '.cfg',
  '.env', '.conf', '.properties', '.log', '.tsv', '.csv',
]);

const SECRET_FILE_RE = /(^|\/)(\.credentials\.yaml|credentials\.yaml|settings\.yaml|\.env(\.\w+)?|\.npmrc|config\.toml)$/i;
const WIN_RESERVED_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function assertSafeRelPath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath === '') throw new Error('备份路径不是合法字符串');
  if (require('node:path').isAbsolute(rawPath)) throw new Error('备份路径不允许绝对路径');
  const parts = rawPath.split(/[\\/]/);
  for (const part of parts) {
    if (part === '..' || part === '' || part === '.') throw new Error(`备份路径含非法段: ${rawPath}`);
    if (part.includes(':') || part.includes('*') || part.includes('?') || part.includes('"') || part.includes('<') || part.includes('>') || part.includes('|')) {
      throw new Error(`备份路径含非法字符: ${rawPath}`);
    }
    if (WIN_RESERVED_NAME_RE.test(part)) throw new Error(`备份路径含 Windows 保留设备名: ${rawPath}`);
  }
  return parts.join('/');
}

function collectFiles(root, fs = require('node:fs'), path = require('node:path')) {
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const relPath = rel === '' ? e.name : rel + '/' + e.name;
      if (e.isDirectory()) {
        if (SKIP_DIR_NAMES.has(e.name)) continue;
        walk(abs, relPath);
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext) && !isSecretName(e.name)) continue;
      if (SKIP_FILE_NAMES.has(e.name) || /\.(bak|tmp|broken|old|orig|swp)($|\.)/.test(e.name)) continue;
      out.push(relPath.replace(/\\/g, '/'));
    }
  };
  walk(root, '');
  return [...new Set(out)].sort();
}

function isSecretName(name) {
  return SECRET_FILE_RE.test(name);
}

function isLikelyUtf8(buf) {
  try {
    const decoded = buf.toString('utf8');
    if (decoded.includes('\uFFFD')) return false;
    return Buffer.from(decoded, 'utf8').equals(buf);
  } catch { return false; }
}

function readBackupFile(root, relPath, fs = require('node:fs'), path = require('node:path')) {
  const abs = path.join(root, relPath);
  const buf = fs.readFileSync(abs);
  if (buf.length > MAX_BACKUP_BYTES) throw new Error(`文件过大（跳过）: ${relPath}`);
  const head = buf.subarray(0, 8192);
  if (head.includes(0)) throw new Error(`文件不是文本（跳过）: ${relPath}`);
  let text = null;
  try { text = buf.toString('utf8'); } catch {}
  if (text !== null) {
    const hasBom = buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff));
    if (hasBom || !isLikelyUtf8(buf)) {
      return { path: relPath, encoding: 'base64', base64: buf.toString('base64') };
    }
  } else {
    return { path: relPath, encoding: 'base64', base64: buf.toString('base64') };
  }
  if (path.basename(relPath).toLowerCase() === 'package.json') {
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (json !== null && typeof json === 'object') return { path: relPath, json };
  }
  return { path: relPath, lines: text.split(/\r?\n/) };
}

function createBackup(opts, fs = require('node:fs'), pathMod = require('node:path')) {
  if (!opts || !opts.profileDir || !opts.homeDir) throw new Error('备份需要 profileDir 与 homeDir');
  const { profileDir, homeDir } = opts;
  const files = [];
  const secretFiles = [];
  const roots = [
    { dir: profileDir, prefix: 'profile/' },
    { dir: homeDir, prefix: 'home/' },
  ];
  for (const { dir, prefix } of roots) {
    if (!fs.existsSync(dir)) continue;
    for (const rel of collectFiles(dir, fs, pathMod)) {
      const entryPath = prefix + rel;
      try {
        const content = readBackupFile(dir, rel, fs, pathMod);
        files.push({ ...content, path: entryPath });
        if (isSecretName(rel)) secretFiles.push(entryPath);
      } catch {}
    }
  }
  if (files.length === 0) throw new Error('没有可备份的配置内容');
  if (files.length > MAX_FILES) throw new Error(`配置文件超过 ${MAX_FILES} 个，放弃备份`);
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    label: String(opts.label || 'DSH Desktop 配置备份'),
    secretFiles,
    files,
  };
  const bytes = Buffer.byteLength(JSON.stringify(backup));
  if (bytes > MAX_BACKUP_BYTES) throw new Error(`备份体积 ${bytes} 字节超过上限 ${MAX_BACKUP_BYTES}`);
  return backup;
}

function validatedBackup(value) {
  if (value === null || typeof value !== 'object') throw new Error('备份内容不是对象');
  const b = value;
  if (b.format !== BACKUP_FORMAT) throw new Error(`备份格式不匹配（期望 ${BACKUP_FORMAT}，实际 ${String(b.format)}）`);
  if (b.version !== BACKUP_VERSION) throw new Error(`备份版本不支持（期望 v${BACKUP_VERSION}，实际 v${String(b.version)}）`);
  if (!Array.isArray(b.files) || b.files.length === 0) throw new Error('备份缺少文件列表');
  if (b.files.length > MAX_FILES) throw new Error('备份文件数超过上限');
  const secretList = Array.isArray(b.secretFiles) ? b.secretFiles : [];
  if (secretList.some((s) => typeof s !== 'string')) throw new Error('备份密钥文件清单格式非法');
  const out = { ...b, secretFiles: [], files: [] };
  const detectedSecrets = new Set();
  const seen = new Set();
  for (const file of b.files) {
    if (file === null || typeof file !== 'object') throw new Error('文件条目不是对象');
    const p = assertSafeRelPath(file.path);
    const key = p.toLowerCase();
    if (seen.has(key)) throw new Error(`备份路径重复: ${key}`);
    seen.add(key);
    if (!p.startsWith('profile/') && !p.startsWith('home/')) throw new Error(`备份路径不在允许根目录内: ${p}`);
    if (p === 'profile/' || p === 'home/') throw new Error('空路径');
    if (p.split('/').includes('node_modules')) throw new Error(`备份路径含 node_modules 段，拒绝: ${p}`);
    const parts = p.split('/');
    for (const part of parts) assertSafeRelPath(part);
    if (isSecretName(p)) detectedSecrets.add(p);
    if ('json' in file) {
      if (file.json === null || typeof file.json !== 'object' || Array.isArray(file.json)) throw new Error(`package.json 格式非法: ${p}`);
      out.files.push({ path: p, json: file.json });
    } else if (file.encoding === 'base64') {
      if (typeof file.base64 !== 'string' || file.base64.length === 0 || !/^[A-Za-z0-9+/=\r\n]+$/.test(file.base64)) {
        throw new Error(`base64 内容格式非法: ${p}`);
      }
      out.files.push({ path: p, encoding: 'base64', base64: file.base64.replace(/\s+/g, '') });
    } else if (Array.isArray(file.lines) && file.lines.every((l) => typeof l === 'string')) {
      out.files.push({ path: p, lines: file.lines });
    } else {
      throw new Error(`文件内容格式非法: ${p}`);
    }
  }
  out.secretFiles = [...detectedSecrets].sort();
  const bytes = Buffer.byteLength(JSON.stringify(out));
  if (bytes > MAX_BACKUP_BYTES) throw new Error('备份体积超过上限');
  return out;
}

function restoreBackup(backup, roots, fs = require('node:fs'), pathMod = require('node:path')) {
  backup = validatedBackup(backup);
  const targetOf = (p) => {
    if (p.startsWith('profile/')) return pathMod.join(roots.profileDir, p.slice('profile/'.length));
    if (p.startsWith('home/')) return pathMod.join(roots.homeDir, p.slice('home/'.length));
    throw new Error(`未知根目录: ${p}`);
  };
  const previous = new Map();
  const writePlan = [];
  const realRoot = (dir) => {
    try { return fs.realpathSync(dir); } catch { throw new Error(`目标根目录不可解析: ${dir}`); }
  };
  const realProfile = realRoot(roots.profileDir);
  const realHome = realRoot(roots.homeDir);
  const deepestReal = (dir) => {
    let cur = dir;
    for (let depth = 0; depth < 64; depth += 1) {
      try { return fs.realpathSync(cur); } catch {}
      const parent = pathMod.dirname(cur);
      if (parent === cur) return null;
      cur = parent;
    }
    return null;
  };
  const within = (realDir, root) => realDir === root || realDir.startsWith(root + pathMod.sep);
  for (const file of backup.files) {
    const target = targetOf(file.path);
    const dir = pathMod.dirname(target);
    if (!fs.existsSync(dir)) throw new Error(`目标目录缺失，拒绝恢复: ${dir}`);
    if (!target.startsWith(roots.profileDir + pathMod.sep) && !target.startsWith(roots.homeDir + pathMod.sep)) {
      throw new Error(`恢复路径逃逸目标根目录: ${file.path}`);
    }
    const realAncestor = deepestReal(dir);
    if (!realAncestor || (!within(realAncestor, realProfile) && !within(realAncestor, realHome))) {
      throw new Error(`恢复路径经符号链接逃逸目标根目录: ${file.path}`);
    }
    writePlan.push({ target, file });
  }
  for (const { target } of writePlan) {
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (!stat.isFile()) throw new Error(`目标已存在且不是文件，拒绝覆盖: ${target}`);
      previous.set(target, fs.readFileSync(target));
    } else {
      previous.set(target, null);
    }
  }
  const rollback = () => {
    const failed = [];
    for (const [target, content] of previous) {
      try {
        if (content === null) { try { fs.rmSync(target, { force: true }); } catch (err) { failed.push(target + ': ' + ((err && err.message) || err)); } }
        else fs.writeFileSync(target, content);
      } catch (err) {
        failed.push(target + ': ' + ((err && err.message) || err));
      }
    }
    return failed;
  };
  const tmpPaths = new Set();
  try {
    for (const { target, file } of writePlan) {
      const tmp = target + '.dsh-restore-' + process.pid + '-' + Math.random().toString(36).slice(2, 8);
      tmpPaths.add(tmp);
      let body;
      if ('json' in file) body = JSON.stringify(file.json, null, 2) + '\n';
      else if (file.encoding === 'base64') body = Buffer.from(file.base64, 'base64');
      else body = file.lines.join('\n');
      fs.writeFileSync(tmp, body);
      fs.renameSync(tmp, target);
    }
  } catch (err) {
    const failed = rollback();
    for (const t of tmpPaths) { try { if (fs.existsSync(t)) fs.unlinkSync(t); } catch {} }
    const suffix = failed.length > 0 ? `；回滚失败 ${failed.length} 项: ${failed.join('; ')}` : '';
    throw new Error('恢复失败，已尝试回滚' + suffix + ': ' + String((err && err.message) || err));
  }
  return { files: writePlan.length, rollback };
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  MAX_FILES,
  SKIP_DIR_NAMES,
  ALLOWED_EXT,
  SECRET_FILE_RE,
  assertSafeRelPath,
  collectFiles,
  readBackupFile,
  createBackup,
  validatedBackup,
  restoreBackup,
};
