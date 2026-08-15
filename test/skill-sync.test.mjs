import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncBundledSkills } from '../skill-sync.js';

test('syncBundledSkills: 安装全部内置 skill，二次运行全部 kept（幂等）', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skills-test-'));
  try {
    const assets = join(root, 'assets', 'skills');
    const userSkills = join(root, 'user-skills');

    mkdirSync(join(assets, 'skill-a'), { recursive: true });
    writeFileSync(join(assets, 'skill-a', 'SKILL.md'), '# Skill A', 'utf8');

    mkdirSync(join(assets, 'skill-b'), { recursive: true });
    writeFileSync(join(assets, 'skill-b', 'SKILL.md'), '# Skill B', 'utf8');

    // 首次同步：全部安装
    const r1 = syncBundledSkills(assets, userSkills);
    assert.deepEqual(r1.installed.sort(), ['skill-a', 'skill-b']);
    assert.deepEqual(r1.kept, []);
    assert.equal(existsSync(join(userSkills, 'skill-a', 'SKILL.md')), true);
    assert.equal(existsSync(join(userSkills, 'skill-b', 'SKILL.md')), true);

    // 二次同步：全部保留（不重复覆盖）
    const r2 = syncBundledSkills(assets, userSkills);
    assert.deepEqual(r2.installed, []);
    assert.deepEqual(r2.kept.sort(), ['skill-a', 'skill-b']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('syncBundledSkills: 忽略无 SKILL.md 的无效目录', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skills-invalid-'));
  try {
    const assets = join(root, 'assets', 'skills');
    const userSkills = join(root, 'user-skills');

    mkdirSync(join(assets, 'invalid-dir'), { recursive: true });
    writeFileSync(join(assets, 'invalid-dir', 'README.txt'), 'Not a skill', 'utf8');

    const r = syncBundledSkills(assets, userSkills);
    assert.deepEqual(r.installed, []);
    assert.deepEqual(r.kept, []);
    assert.equal(existsSync(join(userSkills, 'invalid-dir')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
