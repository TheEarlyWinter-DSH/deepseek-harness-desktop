'use strict';

const fs = require('node:fs');
const path = require('node:path');

// cordis.patch.yml profile patch management and row cleanup helpers.

/** Serialize a config object as patch-row YAML lines (2-space step from `name:`). */
function configLinesFor(config) {
  let out = '      config:\n';
  for (const [k, v] of Object.entries(config || {})) {
    out += `        ${k}: ${JSON.stringify(v)}\n`;
  }
  return out;
}

/**
 * Remove insert-blocks for specific plugin row IDs.
 * Returns { patch, removed }.
 */
function removePluginRows(patch, targetIds) {
  const removed = [];
  if (typeof patch !== 'string' || patch === '' || !targetIds.length) return { patch, removed };
  const lines = patch.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^-\s*insert:/.test(line)) {
      const m = /\bid:\s*([\w-]+)/.exec(lines[i + 1] || '');
      if (m && targetIds.includes(m[1])) {
        removed.push(m[1]);
        // Skip the block body: indented non-comment lines up to the next
        // top-level key / block / comment / blank line.
        let j = i + 1;
        while (j < lines.length && !/^-\s*insert:/.test(lines[j]) && /^#/.test(lines[j]) === false && /^\s+\S/.test(lines[j])) j++;
        i = j - 1;
        continue;
      }
    }
    out.push(line);
  }
  // Collapse the blank line an inner removed block may leave behind.
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n');
  if (!text.endsWith('\n')) text += '\n';
  return { patch: text, removed };
}

/**
 * Remove insert-blocks for rows the profile already mounts through its
 * package.json bundle list (`dsh.profile.bundles`, written by `dsh plugin
 * add` — i.e. anything the user installed from the plugin market).
 *
 * A bundle listed there is loaded WITH its own packaged cordis.patch.yml,
 * which mounts the row itself. When syncCompanionPlugins has also written an
 * overlay row for the same plugin, the loader aborts the whole tree with
 * `duplicate loader entry id: <id>` (dsh web exits 1 → "启动失败" crash
 * loop). Dropping the overlay copy is safe: the bundle still mounts it.
 *
 * `rowIds` maps row id → package name; only rows whose package name appears
 * in the bundle list are removed. Returns { patch, removed }.
 */
function removeBundledRowDuplicates(patch, rowIds, bundleNames) {
  if (typeof patch !== 'string' || patch === '' || !bundleNames.length) return { patch, removed: [] };
  const targets = Object.entries(rowIds)
    .filter(([, pkg]) => bundleNames.includes(pkg))
    .map(([id]) => id);
  return removePluginRows(patch, targets);
}

/**
 * Helper to resolve entrypoint file from a package directory and its package.json.
 */
function resolveEntryFromPkgDir(pkgDir) {
  if (!pkgDir) return null;

  function findFile(relPath) {
    if (!relPath || typeof relPath !== 'string') return null;
    const candidates = [
      path.resolve(pkgDir, relPath),
      path.resolve(pkgDir, relPath + '.js'),
      path.resolve(pkgDir, relPath + '.mjs'),
      path.resolve(pkgDir, relPath + '.cjs'),
      path.resolve(pkgDir, relPath, 'index.js'),
      path.resolve(pkgDir, relPath, 'index.mjs'),
      path.resolve(pkgDir, relPath, 'index.cjs'),
    ];
    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
      } catch {}
    }
    return null;
  }

  function extractFromExport(exp) {
    if (!exp) return null;
    if (typeof exp === 'string') return findFile(exp);
    if (typeof exp === 'object') {
      const priorityKeys = ['import', 'default', 'node', 'require', 'browser'];
      for (const k of priorityKeys) {
        if (exp[k]) {
          const res = extractFromExport(exp[k]);
          if (res) return res;
        }
      }
      for (const val of Object.values(exp)) {
        const res = extractFromExport(val);
        if (res) return res;
      }
    }
    return null;
  }

  const pkgJsonPath = path.join(pkgDir, 'package.json');
  let pkgJson = null;
  try {
    if (fs.existsSync(pkgJsonPath)) {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    }
  } catch {}

  if (pkgJson) {
    if (pkgJson.exports) {
      if (typeof pkgJson.exports === 'string') {
        const res = findFile(pkgJson.exports);
        if (res) return res;
      } else if (typeof pkgJson.exports === 'object') {
        if (pkgJson.exports['.']) {
          const res = extractFromExport(pkgJson.exports['.']);
          if (res) return res;
        } else {
          const res = extractFromExport(pkgJson.exports);
          if (res) return res;
        }
      }
    }
    if (typeof pkgJson.main === 'string' && pkgJson.main) {
      const res = findFile(pkgJson.main);
      if (res) return res;
    }
    if (typeof pkgJson.module === 'string' && pkgJson.module) {
      const res = findFile(pkgJson.module);
      if (res) return res;
    }
  }

  for (const def of ['lib/index.js', 'index.js', 'lib/index.mjs', 'index.mjs', 'lib/index.cjs', 'index.cjs', 'dist/index.js', 'dist/index.mjs']) {
    const res = findFile(def);
    if (res) return res;
  }

  return null;
}

/**
 * Check whether a plugin package exists and has a resolvable entrypoint module.
 * Checks profile node_modules, fallback directories, and host bundled modules.
 */
function isPluginPackageValid(name, profileDir, fallbackDir, extraSearchDirs = []) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'invalid name' };
  
  const rel = name.split('/');
  const dirs = [
    profileDir ? path.join(profileDir, 'node_modules', ...rel) : null,
    fallbackDir ? path.join(fallbackDir, ...rel) : null,
    ...extraSearchDirs.map((d) => (d ? path.join(d, 'node_modules', ...rel) : null)),
    path.join(__dirname, 'node_modules', ...rel),
  ].filter(Boolean);

  let pkgDir = null;
  for (const d of dirs) {
    try {
      if (fs.existsSync(d) && (fs.statSync(d).isDirectory() || fs.lstatSync(d).isSymbolicLink())) {
        pkgDir = d;
        break;
      }
    } catch {}
  }

  if (!pkgDir) {
    return { ok: false, reason: 'package directory not found' };
  }

  const entry = resolveEntryFromPkgDir(pkgDir);
  if (!entry) {
    return { ok: false, reason: 'entrypoint module not found' };
  }

  return { ok: true, entry };
}

/**
 * Scan cordis.patch.yml for active (non-disabled) plugin entries that are missing
 * from node_modules or lack a valid entrypoint, and disable them to prevent boot crashes.
 * Accurately updates or inserts `disabled: true` at the proper YAML mapping level.
 */
function healBrokenPatchEntries(profileDir, patch, fallbackDir, log = () => {}, extraSearchDirs = []) {
  const disabled = [];
  if (typeof patch !== 'string' || patch === '' || !profileDir) return { patch, disabled };

  const lines = patch.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^-\s*insert:/.test(line)) {
      let j = i + 1;
      let id = '';
      let name = '';
      let isDisabled = false;

      while (j < lines.length && !/^-\s*insert:/.test(lines[j]) && /^#/.test(lines[j]) === false && /^\s+\S/.test(lines[j])) {
        const idMatch = /\bid:\s*([\w-]+)/.exec(lines[j]);
        if (idMatch) id = idMatch[1];
        const nameMatch = /\bname:\s*['"]?([^'"\s]+)['"]?/.exec(lines[j]);
        if (nameMatch) name = nameMatch[1];
        if (/\bdisabled:\s*true\b/.test(lines[j])) isDisabled = true;
        j++;
      }
      const blockEnd = j;

      if (id && name && !isDisabled) {
        const check = isPluginPackageValid(name, profileDir, fallbackDir, extraSearchDirs);
        if (!check.ok) {
          disabled.push({ id, name, reason: check.reason });
          log(`已自愈损坏/缺失的插件: ${id} (${name}, 原因: ${check.reason})，自动标记为 disabled: true`);
          
          out.push(line);
          const hasDisabledLine = lines.slice(i + 1, blockEnd).some((l) => /^\s*disabled:\s*.*$/.test(l));
          for (let k = i + 1; k < blockEnd; k++) {
            if (/^\s*disabled:\s*.*$/.test(lines[k])) {
              out.push('      disabled: true');
            } else {
              out.push(lines[k]);
              if (!hasDisabledLine && /^\s*name:\s*.*$/.test(lines[k])) {
                out.push('      disabled: true');
              }
            }
          }
          i = blockEnd - 1;
          continue;
        }
      }
    }
    out.push(line);
  }

  let text = out.join('\n').replace(/\n{3,}/g, '\n\n');
  if (!text.endsWith('\n')) text += '\n';
  return { patch: text, disabled };
}

module.exports = {
  configLinesFor,
  removeBundledRowDuplicates,
  removePluginRows,
  isPluginPackageValid,
  resolveEntryFromPkgDir,
  healBrokenPatchEntries,
};


