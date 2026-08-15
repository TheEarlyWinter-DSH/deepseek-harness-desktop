import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { configLinesFor, removeBundledRowDuplicates, removePluginRows } = require(join(root, 'patch-row-heal.js'));

const SAMPLE_PATCH = [
  '# dsh web profile patch（由 DSH Desktop 维护）',
  '- insert:',
  '    - id: easy-setup',
  "      name: '@deepseek-ai/dsh-easy-setup'",
  '- insert:',
  '    - id: tdai-memory',
  "      name: 'dsh-tdai-memory'",
  '',
].join('\n');

test('configLinesFor 生成合法 patch YAML', () => {
  assert.equal(configLinesFor({ path: 'custom.md' }), '      config:\n        path: "custom.md"\n');
});

test('removePluginRows: 移除指定插件行', () => {
  const patch = [
    '- insert:',
    '    - id: easy-setup',
    "      name: '@deepseek-ai/dsh-easy-setup'",
    '- insert:',
    '    - id: mobile-fix',
    "      name: 'dsh-web-mobile-fix'",
    '- insert:',
    '    - id: tool-vision',
    "      name: 'dsh-tool-vision'",
    '',
  ].join('\n');
  const { patch: out, removed } = removePluginRows(patch, ['easy-setup', 'tool-vision']);
  assert.deepEqual(removed, ['easy-setup', 'tool-vision']);
  assert.doesNotMatch(out, /easy-setup/);
  assert.doesNotMatch(out, /tool-vision/);
  assert.match(out, /- id: mobile-fix/);
});

test('removePluginRows: 空或不存在的插件行安全返回', () => {
  assert.deepEqual(removePluginRows('', ['easy-setup']).removed, []);
  assert.deepEqual(removePluginRows('- insert:\n    - id: other\n', ['easy-setup']).removed, []);
});

// main.js 侧双保险：新增行带 config，且支持清理已废弃插件行。
test('main.js: 支持清理已废弃插件行并同步配套插件', () => {
  const src = readFileSync(join(root, 'main.js'), 'utf8');
  assert.match(src, /removePluginRows\(patch, removedPluginIds\)/);
  assert.match(src, /block \+= configLinesFor\(p\.config\)/);
});

// 市场安装（dsh plugin add 登记 bundles）与 overlay 写行双挂载 →
// "duplicate loader entry id" 拖垮插件树。overlay 重复行必须被移除。
test('removeBundledRowDuplicates: 删 bundle 已登记的 overlay 行', () => {
  const patch = [
    '- insert:',
    '    - id: file-changes',
    "      name: '@deepseek-ai/dsh-file-changes'",
    '- insert:',
    '    - id: mobile-fix',
    "      name: 'dsh-web-mobile-fix'",
    '- insert:',
    '    - id: terminal',
    "      name: '@deepseek-ai/dsh-terminal'",
    '',
  ].join('\n');
  const rowIds = { 'file-changes': '@deepseek-ai/dsh-file-changes', 'mobile-fix': 'dsh-web-mobile-fix', terminal: '@deepseek-ai/dsh-terminal' };
  const { patch: out, removed } = removeBundledRowDuplicates(patch, rowIds, ['dsh-web-mobile-fix']);
  assert.deepEqual(removed, ['mobile-fix']);
  assert.doesNotMatch(out, /mobile-fix/);
  assert.match(out, /- id: file-changes/);
  assert.match(out, /- id: terminal/);
});

test('removeBundledRowDuplicates: 无 bundle 登记时不动任何行', () => {
  const rowIds = { 'mobile-fix': 'dsh-web-mobile-fix' };
  const { patch: out, removed } = removeBundledRowDuplicates(SAMPLE_PATCH, rowIds, []);
  assert.deepEqual(removed, []);
  assert.equal(out, SAMPLE_PATCH);
});

test('removeBundledRowDuplicates: 非 uninstall 目标插件（tts 等）不受影响', () => {
  const patch = '- insert:\n    - id: tts\n      name: \'@dsh-external/dsh-plugin-tts\'\n';
  const rowIds = { 'mobile-fix': 'dsh-web-mobile-fix' };
  const { removed } = removeBundledRowDuplicates(patch, rowIds, ['@dsh-external/dsh-plugin-tts']);
  assert.deepEqual(removed, []);
});
