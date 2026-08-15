'use strict';

// Copies the npm CLI bundled with the system Node into vendor/npm.
// The packaged app uses it (via the vendored node.exe) to check for and
// install official @deepseek-ai/dsh updates — npm resolves the dependency
// tree exactly as the registry publish intends, handles platform-specific
// optional deps, and respects the user's .npmrc (registry mirrors, proxies).
//
// Usage (must run under system Node):
//   npm run fetch-npm

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const candidates = [
  path.join(path.dirname(process.execPath), 'node_modules', 'npm'),
  path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm'),
];

try {
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  if (globalRoot) candidates.push(path.join(globalRoot, 'npm'));
} catch {}

const src = candidates.find((c) => fs.existsSync(path.join(c, 'bin', 'npm-cli.js')));
const dest = path.resolve(__dirname, '..', 'vendor', 'npm');

if (!src) {
  console.error('找不到随 Node 分发的 npm，已尝试候选路径：\n' + candidates.join('\n'));
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
const version = require(path.join(dest, 'package.json')).version;
console.log(`已复制 npm@${version}`);
console.log(`    ${src}`);
console.log(` -> ${dest}`);
