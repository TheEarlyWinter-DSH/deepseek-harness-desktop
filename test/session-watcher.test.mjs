import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SessionWatcher, scanZstdFrames, expandRow } = require('../session-watcher.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeSessionFile(file, id) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = JSON.stringify({
    type: 'session',
    id,
    cwd: 'C:/fake',
    title: 'test session',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }) + '\n';
  fs.writeFileSync(file, zlib.zstdCompressSync(Buffer.from(header, 'utf8')));
}

function appendFrame(file, records) {
  const payload = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(file, zlib.zstdCompressSync(Buffer.from(payload, 'utf8')));
}

test('SessionWatcher v2: appended turn/end notifies via fs.watch event', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swv2-'));
  const file = path.join(tmp, 'p1', 'sess1', 'session.jsonl.zstd');
  makeSessionFile(file, 'testsess1');
  const notes = [];
  const w = new SessionWatcher({
    sessionsDir: tmp,
    onTurnEnd: (info) => notes.push(info),
    log: () => {},
    statSweepMs: 60000,
    walkSweepMs: 60000,
  });
  w.start();
  await sleep(400);
  w.refreshWatchList();
  await sleep(200);
  appendFrame(file, [{ type: 'turn/start' }, { type: 'turn/end' }]);
  const deadline = Date.now() + 5000;
  while (notes.length === 0 && Date.now() < deadline) await sleep(100);
  w.stop();
  assert.strictEqual(notes.length, 1, 'expected one turn-end notification');
  assert.strictEqual(notes[0].sessionId, 'testsess1');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('SessionWatcher v2: scanZstdFrames handles valid and torn frames', () => {
  const payload = JSON.stringify({ type: 'test' }) + '\n';
  const compressed = zlib.zstdCompressSync(Buffer.from(payload, 'utf8'));
  const { frames, tornStart } = scanZstdFrames(compressed);
  assert.strictEqual(frames.length, 1);
  assert.strictEqual(tornStart, undefined);

  // Partial frame
  const partial = compressed.subarray(0, compressed.length - 2);
  const resPartial = scanZstdFrames(partial);
  assert.strictEqual(resPartial.frames.length, 0);
  assert.strictEqual(typeof resPartial.tornStart, 'number');
});

test('SessionWatcher v2: expandRow unpacks chunks correctly', () => {
  const textRow = JSON.stringify({
    type: 'text-chunks',
    data: { texts: [{ type: 'delta', text: 'a' }, { type: 'delta', text: 'b' }] },
  });
  const unpacked = expandRow(textRow);
  assert.strictEqual(unpacked.length, 2);
  assert.strictEqual(unpacked[0].text, 'a');
});
