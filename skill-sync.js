'use strict';

// Bundled skills sync.
//
// Automatically syncs standard SKILL.md skills from assets/skills/<name>/
// into the user's skills directory (${DSH_HOME:-~/.dsh}/skills/<name>/) at boot.
//
// Existing skill directories are never overwritten, allowing user customizations
// to be preserved.

const fs = require('node:fs');
const path = require('node:path');

function syncBundledSkills(assetsRoot, skillsRoot, log = () => {}) {
  const installed = [];
  const kept = [];
  let entries;
  try { entries = fs.readdirSync(assetsRoot, { withFileTypes: true }); } catch { return { installed, kept }; }
  fs.mkdirSync(skillsRoot, { recursive: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const src = path.join(assetsRoot, entry.name);
    if (!fs.existsSync(path.join(src, 'SKILL.md'))) continue;
    const dest = path.join(skillsRoot, entry.name);
    if (fs.existsSync(dest)) {
      kept.push(entry.name);
      continue;
    }
    try {
      fs.cpSync(src, dest, { recursive: true });
      installed.push(entry.name);
      log('installed bundled skill: ' + entry.name);
    } catch (err) {
      log('failed to install bundled skill ' + entry.name + ': ' + err.message);
    }
  }
  return { installed, kept };
}

module.exports = { syncBundledSkills };
