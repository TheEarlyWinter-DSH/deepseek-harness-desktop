import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { readSettingsScalar, writeSettingsScalar } = require(join(root, 'settings-yaml.js'));

function tmp() {
  return mkdtempSync(join(tmpdir(), 'dsh-settings-yaml-'));
}

test('writeSettingsScalar: creates a missing permission section', () => {
  const dir = tmp();
  try {
    const file = join(dir, 'settings.yaml');
    writeSettingsScalar(file, 'permission', 'defaultPreset', 'workspace-write');
    assert.equal(readSettingsScalar(file, 'permission', 'defaultPreset'), 'workspace-write');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSettingsScalar: preserves unrelated settings and comments', () => {
  const dir = tmp();
  try {
    const file = join(dir, 'settings.yaml');
    writeFileSync(file, '# user model\r\nagent-default-model:\r\n  provider: deepseek\r\n  model: "deepseek-v4"\r\npermission:\r\n  defaultPreset: read-only\r\n');
    writeSettingsScalar(file, 'permission', 'defaultPreset', 'danger-full-access');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /# user model/);
    assert.match(text, /provider: deepseek/);
    assert.ok(text.includes('\r\n'));
    assert.equal(readSettingsScalar(file, 'agent-default-model', 'model'), 'deepseek-v4');
    assert.equal(readSettingsScalar(file, 'permission', 'defaultPreset'), 'danger-full-access');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSettingsScalar: preserves UTF-8 BOM', () => {
  const dir = tmp();
  try {
    const file = join(dir, 'settings.yaml');
    writeFileSync(file, '\uFEFFpermission:\n  defaultPreset: read-only\n');
    writeSettingsScalar(file, 'permission', 'defaultPreset', 'workspace-write');
    assert.equal(readFileSync(file, 'utf8').charCodeAt(0), 0xFEFF);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSettingsScalar: rejects invalid YAML without overwriting it', () => {
  const dir = tmp();
  try {
    const file = join(dir, 'settings.yaml');
    const invalid = 'permission: [\n';
    writeFileSync(file, invalid);
    assert.throws(() => writeSettingsScalar(file, 'permission', 'defaultPreset', 'read-only'), /invalid YAML/);
    assert.equal(readFileSync(file, 'utf8'), invalid);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('desktop setup plugin and YAML helper are included in distribution wiring', () => {
  const main = readFileSync(join(root, 'main.js'), 'utf8');
  const builder = readFileSync(join(root, 'electron-builder.yml'), 'utf8');
  const client = readFileSync(join(root, 'assets', 'plugins', 'dsh-desktop-control', 'lib', 'client.js'), 'utf8');
  assert.match(main, /id: 'desktop-control', name: '@deepseek-ai\/dsh-desktop-control'/);
  assert.match(builder, /- settings-yaml\.js/);
  assert.match(client, /exports\.apply = apply/);
  assert.match(client, /dsh-desktop-open-panel/);
});
