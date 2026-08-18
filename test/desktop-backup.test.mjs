import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBackup, validatedBackup, restoreBackup } = require('../desktop-backup.js');

test('desktop-backup: create, validate, and restore backup', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bk-'));
  const profileDir = path.join(tmp, 'profiles', 'web');
  const homeDir = path.join(tmp, 'home');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });

  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), '- id: sample\n');
  fs.writeFileSync(path.join(homeDir, 'settings.yaml'), 'model: deepseek-v4-pro\n');

  // Create backup
  const backup = createBackup({ profileDir, homeDir, label: 'test backup' }, fs, path);
  assert.strictEqual(backup.files.length, 2);
  assert.ok(backup.secretFiles.some((f) => f.includes('settings.yaml')));

  // Validate
  const valid = validatedBackup(backup);
  assert.strictEqual(valid.files.length, 2);

  // Modify local file
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), 'corrupted');

  // Restore
  const res = restoreBackup(valid, { profileDir, homeDir }, fs, path);
  assert.strictEqual(res.files, 2);

  const restoredPatch = fs.readFileSync(path.join(profileDir, 'cordis.patch.yml'), 'utf8');
  assert.strictEqual(restoredPatch, '- id: sample\n');

  fs.rmSync(tmp, { recursive: true, force: true });
});
