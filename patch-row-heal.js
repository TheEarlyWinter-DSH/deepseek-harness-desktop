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
 * Check whether a plugin package exists in profileDir/node_modules (or fallbackDir)
 * and has a resolvable entrypoint module.
 */
function isPluginPackageValid(name, profileDir, fallbackDir) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'invalid name' };
  
  const rel = name.split('/');
  const dirs = [
    path.join(profileDir, 'node_modules', ...rel),
    fallbackDir ? path.join(fallbackDir, ...rel) : null,
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

  // Check package.json entry point
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  let pkgJson = null;
  try {
    if (fs.existsSync(pkgJsonPath)) {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    }
  } catch {}

  const candidates = [];
  if (pkgJson) {
    if (typeof pkgJson.main === 'string' && pkgJson.main) {
      candidates.push(pkgJson.main);
    }
    if (pkgJson.exports && typeof pkgJson.exports === 'object') {
      if (typeof pkgJson.exports['.'] === 'string') {
        candidates.push(pkgJson.exports['.']);
      } else if (pkgJson.exports['.']?.import) {
        candidates.push(pkgJson.exports['.'].import);
      } else if (pkgJson.exports['.']?.default) {
        candidates.push(pkgJson.exports['.'].default);
      }
    }
  }
  // Default fallbacks
  candidates.push('lib/index.js', 'index.js', 'lib/index.mjs', 'index.mjs', 'lib/index.cjs', 'index.cjs');

  for (const cand of candidates) {
    const file = path.resolve(pkgDir, cand);
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return { ok: true, entry: file };
      }
    } catch {}
  }

  return { ok: false, reason: 'entrypoint module not found' };
}

/**
 * Scan cordis.patch.yml for active (non-disabled) plugin entries that are missing
 * from node_modules or lack a valid entrypoint, and disable them to prevent boot crashes.
 */
function healBrokenPatchEntries(profileDir, patch, fallbackDir, log = () => {}) {
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
        const check = isPluginPackageValid(name, profileDir, fallbackDir);
        if (!check.ok) {
          disabled.push({ id, name, reason: check.reason });
          log(`已自愈损坏/缺失的插件: ${id} (${name}, 原因: ${check.reason})，自动标记为 disabled: true`);
          
          out.push(line);
          for (let k = i + 1; k < blockEnd; k++) {
            out.push(lines[k]);
          }
          out.push('      disabled: true');
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
  healBrokenPatchEntries,
};

