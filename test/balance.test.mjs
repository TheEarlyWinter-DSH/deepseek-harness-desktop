import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { effectivePrice, isPeakHour, PEAK_PRICES, LEGACY_PRICES } = require('../balance.js');

test('balance: isPeakHour detects Beijing 9-12 and 14-18 correctly', () => {
  // 10:00 Beijing = 02:00 UTC
  const peakTime1 = new Date('2026-08-18T02:00:00Z');
  assert.strictEqual(isPeakHour(peakTime1), true);

  // 15:00 Beijing = 07:00 UTC
  const peakTime2 = new Date('2026-08-18T07:00:00Z');
  assert.strictEqual(isPeakHour(peakTime2), true);

  // 13:00 Beijing = 05:00 UTC (noon break: off-peak)
  const offPeakTime = new Date('2026-08-18T05:00:00Z');
  assert.strictEqual(isPeakHour(offPeakTime), false);

  // 22:00 Beijing = 14:00 UTC (night: off-peak)
  const nightTime = new Date('2026-08-18T14:00:00Z');
  assert.strictEqual(isPeakHour(nightTime), false);
});

test('balance: effectivePrice calculates peak and off-peak halving', () => {
  const peakDate = new Date('2026-08-18T02:00:00Z'); // Peak
  const offPeakDate = new Date('2026-08-18T14:00:00Z'); // Off-peak

  const priceFlashPeak = effectivePrice('deepseek-v4-flash', peakDate);
  assert.strictEqual(priceFlashPeak.cacheMiss, PEAK_PRICES['deepseek-v4-flash'].cacheMiss);
  assert.strictEqual(priceFlashPeak.output, PEAK_PRICES['deepseek-v4-flash'].output);

  const priceFlashOffPeak = effectivePrice('deepseek-v4-flash', offPeakDate);
  assert.strictEqual(priceFlashOffPeak.cacheMiss, PEAK_PRICES['deepseek-v4-flash'].cacheMiss / 2);
  assert.strictEqual(priceFlashOffPeak.output, PEAK_PRICES['deepseek-v4-flash'].output / 2);
});
