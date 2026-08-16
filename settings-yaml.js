'use strict';

const fs = require('node:fs');
const YAML = require('yaml');

function readSettingsScalar(file, section, key, fallback = '') {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const document = YAML.parseDocument(text);
    if (document.errors.length > 0) return fallback;
    const value = document.getIn([section, key]);
    return typeof value === 'string' ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeSettingsScalar(file, section, key, value) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}
  const bom = text.charCodeAt(0) === 0xFEFF;
  if (bom) text = text.slice(1);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const document = YAML.parseDocument(text || '{}', { keepSourceTokens: true });
  if (document.errors.length > 0) {
    throw new Error('settings.yaml contains invalid YAML');
  }
  document.setIn([section, key], value);
  let output = document.toString({ lineWidth: 0 });
  if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, (bom ? '\uFEFF' : '') + output);
}

module.exports = { readSettingsScalar, writeSettingsScalar };
