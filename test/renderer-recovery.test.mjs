import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeBackoff, nextAction, DEFAULT_OPTS } = require('../renderer-recovery.js');

test('renderer-recovery: computeBackoff exponential growth within bounds', () => {
  const d1 = computeBackoff(1);
  assert.strictEqual(d1, DEFAULT_OPTS.FIRST_DELAY_MS);

  const d2 = computeBackoff(2);
  assert.ok(d2 >= DEFAULT_OPTS.BACKOFF_BASE_MS);

  const d10 = computeBackoff(10);
  assert.ok(d10 <= DEFAULT_OPTS.BACKOFF_MAX_MS * 1.5);
});

test('renderer-recovery: nextAction decides reload, rebuild, and give-up', () => {
  assert.strictEqual(nextAction(1, 'main', false), 'reload');
  assert.strictEqual(nextAction(2, 'main', false), 'reload');
  assert.strictEqual(nextAction(3, 'main', false), 'rebuild');
  assert.strictEqual(nextAction(3, 'main', true), 'reload'); // already rebuilt in burst
  assert.strictEqual(nextAction(5, 'main', true), 'give-up');
  assert.strictEqual(nextAction(1, 'float', false), 'reload');
  assert.strictEqual(nextAction(5, 'float', false), 'give-up');
});
