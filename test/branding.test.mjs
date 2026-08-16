import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacySuffix = ['E', 'A', 'C'].join('');
const forbiddenPhrases = [
  `Deepseek Harness ${legacySuffix}`,
  `DeepSeek Harness ${legacySuffix}`,
  `Harness-${legacySuffix}`,
  ['Embracing', 'All', 'Creation'].join(' '),
  ['揽尽', '万象'].join(''),
];
const textExtensions = new Set([
  '', '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.nsh', '.ps1', '.txt', '.yml', '.yaml',
]);

function trackedFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

test('tracked source and filenames use only the DeepSeek Harness brand', () => {
  const violations = [];
  for (const relative of trackedFiles()) {
    const normalizedName = relative.toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (normalizedName.includes(phrase.toLowerCase())) violations.push(`${relative}: filename contains ${phrase}`);
    }
    if (!textExtensions.has(extname(relative).toLowerCase())) continue;
    const text = readFileSync(join(root, relative), 'utf8');
    const sourceText = text.replace(/data:[^;,\s]+;base64,[A-Za-z0-9+/=\s]+/gi, '');
    for (const phrase of forbiddenPhrases) {
      if (sourceText.toLowerCase().includes(phrase.toLowerCase())) violations.push(`${relative}: contains ${phrase}`);
    }
    const standaloneLegacySuffix = new RegExp(`(^|[^A-Za-z0-9_])${legacySuffix}([^A-Za-z0-9_]|$)`, 'i');
    if (standaloneLegacySuffix.test(sourceText)) violations.push(`${relative}: contains standalone legacy suffix`);
  }
  assert.deepEqual(violations, []);
});
