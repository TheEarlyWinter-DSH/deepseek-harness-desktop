'use strict';

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

module.exports = { configLinesFor, removeBundledRowDuplicates, removePluginRows };
