import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  selectAsset,
  resolveRepos,
  resolveHttpProxy,
  _internals: { normalizeRelease, buildPortableCmd, buildNsisCmd },
} = require('../client-updater.js');

test('client-updater: resolveRepos defaults and custom input', () => {
  const def = resolveRepos();
  assert.strictEqual(def.github, 'TheEarlyWinter-DSH/deepseek-harness-desktop');

  const custom = resolveRepos({ github: 'custom/repo' });
  assert.strictEqual(custom.github, 'custom/repo');
});

test('client-updater: normalizeRelease normalizes tag and asset list', () => {
  const raw = {
    tag_name: 'v2.3.1',
    assets: [
      { name: 'DeepSeek-Harness-Portable-x64.exe', browser_download_url: 'https://example.com/dl.exe', size: 100000000 },
    ],
  };
  const norm = normalizeRelease('GitHub', raw);
  assert.strictEqual(norm.version, '2.3.1');
  assert.strictEqual(norm.assets.length, 1);
});

test('client-updater: selectAsset matches portable executable', () => {
  process.env.PORTABLE_EXECUTABLE_DIR = 'C:/fake';
  process.env.DSH_DESKTOP_ARCH = 'x64';
  process.env.DSH_DESKTOP_PLATFORM = 'win';

  const release = {
    version: '2.3.1',
    assets: [
      { name: 'DeepSeek-Harness-Portable-x64.exe', browser_download_url: 'https://example.com/p.exe', size: 100000000 },
      { name: 'DeepSeek-Harness-Setup-x64.exe', browser_download_url: 'https://example.com/s.exe', size: 100000000 },
    ],
  };

  const sel = selectAsset(release);
  assert.strictEqual(sel.name, 'DeepSeek-Harness-Portable-x64.exe');
  assert.strictEqual(sel.parts.length, 1);

  delete process.env.PORTABLE_EXECUTABLE_DIR;
  delete process.env.DSH_DESKTOP_ARCH;
  delete process.env.DSH_DESKTOP_PLATFORM;
});

test('client-updater: buildPortableCmd outputs valid cmd syntax', () => {
  const cmd = buildPortableCmd();
  assert.ok(cmd.includes('@echo off'));
  assert.ok(cmd.includes('apply-update start (portable)'));
});
