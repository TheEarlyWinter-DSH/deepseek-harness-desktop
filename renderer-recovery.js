'use strict';

// ============================================================================
// DSH Desktop — 渲染进程崩溃/挂起自恢复状态机
// ============================================================================

const { pathToFileURL } = require('node:url');

const DEFAULT_OPTS = {
  MAX_ATTEMPTS: 4,
  ATTEMPT_WINDOW_MS: 90 * 1000,
  STABILITY_MS: 30 * 1000,
  FIRST_DELAY_MS: 800,
  BACKOFF_BASE_MS: 2000,
  BACKOFF_MAX_MS: 15000,
  LOAD_TIMEOUT_MS: 30 * 1000,
  UNRESPONSIVE_GRACE_MS: 20 * 1000,
  HEARTBEAT_MISS_MS: 45 * 1000,
  SERVER_WAIT_MAX_MS: 60 * 1000,
  ERROR_PAGE_RELOAD_MIN_INTERVAL_MS: 10 * 1000,
  HANG_PENDING_TOLERANCE_MS: 10 * 1000,
};

// 纯函数：按故障次数计算退避延迟（指数退避 + 抖动）。
function computeBackoff(failureCount, opts) {
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  if (failureCount <= 1) return o.FIRST_DELAY_MS;
  const cap = Math.min(o.BACKOFF_MAX_MS, o.BACKOFF_BASE_MS * 2 ** (failureCount - 1));
  const jitter = Math.round(cap * (0.15 + 0.2 * Math.random()));
  return Math.round(cap + jitter);
}

// 纯函数：由当前故障计数决定下一步动作。
function nextAction(failures, kind, rebuiltInBurst, opts) {
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  if (failures > o.MAX_ATTEMPTS) return 'give-up';
  if (kind === 'main' && failures === 3 && !rebuiltInBurst) return 'rebuild';
  return 'reload';
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

class RendererRecovery {
  constructor(opts) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this._states = new Map();
    this._wins = new Set();
    this._attached = new Set();
    this._heartbeats = new Map();
  }

  _log(msg) {
    try { this.opts.log(msg); } catch {}
  }

  _state(win) {
    let s = this._states.get(win.id);
    if (!s) {
      s = {
        kind: 'main',
        failures: 0,
        windowStart: 0,
        gaveUp: false,
        expectingWeb: false,
        userHidden: true,
        attemptTimer: null,
        stabilityTimer: null,
        hangGrace: null,
        hangDetectedAt: 0,
        gen: 0,
        rebuiltInBurst: false,
        failuresAtLoad: 0,
        loadFlight: null,
        lastFailure: null,
        lastErrorPageAt: 0,
        pendingHangCrash: 0,
      };
      this._states.set(win.id, s);
    }
    return s;
  }

  _clearTimers(s) {
    if (s.attemptTimer) { clearTimeout(s.attemptTimer); s.attemptTimer = null; }
    if (s.stabilityTimer) { clearTimeout(s.stabilityTimer); s.stabilityTimer = null; }
    if (s.hangGrace) { clearTimeout(s.hangGrace); s.hangGrace = null; }
  }

  _resetBurst(s) {
    this._clearTimers(s);
    s.failures = 0;
    s.failuresAtLoad = 0;
    s.windowStart = 0;
    s.gaveUp = false;
    s.rebuiltInBurst = false;
    s.lastFailure = null;
    s.pendingHangCrash = 0;
    s.hangDetectedAt = 0;
  }

  _countFailure(win, s) {
    const now = Date.now();
    if (s.windowStart && now - s.windowStart > this.opts.ATTEMPT_WINDOW_MS) {
      s.windowStart = now;
      s.failures = 0;
      s.rebuiltInBurst = false;
    }
    if (!s.windowStart) s.windowStart = now;
    s.failures += 1;
  }

  _sameTargetUrl(url, target) {
    if (!target || !url) return false;
    if (target.kind === 'url') return sameOrigin(url, target.url);
    if (target.kind === 'file') {
      try { return url === pathToFileURL(target.path).href; } catch { return false; }
    }
    return false;
  }

  attach(win, kind) {
    if (!win || win.isDestroyed()) return;
    const s = this._state(win);
    s.kind = kind;
    if (this._attached.has(win)) return;
    this._attached.add(win);
    const wc = win.webContents;

    wc.on('render-process-gone', (_e, details) => this._onGone(win, details));
    wc.on('unresponsive', () => this._onUnresponsive(win));
    wc.on('responsive', () => this._onResponsive(win));
    wc.on('did-finish-load', () => this._onFinishLoad(win));
    wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (isMainFrame) this._onFailLoad(win, { code, desc, url });
    });
    wc.on('destroyed', () => {
      const st = this._states.get(win.id);
      if (st) this._clearTimers(st);
      this._states.delete(win.id);
      this._heartbeats.delete(wc.id);
      this._wins.delete(win);
      this._attached.delete(win);
    });
    win.on('show', () => {
      const st = this._state(win);
      st.userHidden = false;
      this._heartbeats.set(wc.id, Date.now());
    });
    win.on('hide', () => {
      this._state(win).userHidden = true;
    });

    this._wins.add(win);
  }

  noteHeartbeat(wcId) {
    this._heartbeats.set(wcId, Date.now());
  }

  checkHeartbeats() {
    const now = Date.now();
    for (const win of this._wins) {
      if (!win || win.isDestroyed()) continue;
      const s = this._state(win);
      if (!s.expectingWeb || s.gaveUp || s.hangGrace) continue;
      if (s.userHidden) continue;
      const last = this._heartbeats.get(win.webContents.id) || 0;
      if (last && now - last > this.opts.HEARTBEAT_MISS_MS) {
        this._log(`心跳丢失 ${now - last}ms（kind=${s.kind}），视为挂起进入恢复`);
        this._onUnresponsive(win);
      }
    }
  }

  retryNow(win) {
    if (!win || win.isDestroyed()) return false;
    const s = this._state(win);
    this._resetBurst(s);
    s.gen += 1;
    this._log(`用户请求立即恢复加载（kind=${s.kind}）`);
    this._schedule(win, s);
    return true;
  }

  stateOf(win) {
    if (!win || win.isDestroyed()) return null;
    const s = this._state(win);
    return {
      kind: s.kind,
      failures: s.failures,
      gaveUp: s.gaveUp,
      expectingWeb: s.expectingWeb,
      lastFailure: s.lastFailure,
    };
  }

  dispose() {
    for (const s of this._states.values()) this._clearTimers(s);
    this._states.clear();
    this._wins.clear();
    this._heartbeats.clear();
  }

  _onGone(win, details) {
    if (this.opts.isQuitting() || win.isDestroyed()) return;
    const s = this._state(win);
    const reason = details && details.reason;
    if (reason === 'clean-exit') {
      this._clearTimers(s);
      return;
    }
    const now = Date.now();
    if (s.pendingHangCrash && now - s.pendingHangCrash < this.opts.HANG_PENDING_TOLERANCE_MS) {
      s.pendingHangCrash = 0;
    } else {
      this._countFailure(win, s);
    }
    s.lastFailure = {
      reason: String(reason || 'unknown'),
      exitCode: details && details.exitCode !== undefined ? Number(details.exitCode) : null,
      at: new Date().toISOString(),
    };
    s.gen += 1;
    this._log(
      `渲染进程异常退出: reason=${s.lastFailure.reason} exitCode=${s.lastFailure.exitCode} ` +
      `kind=${s.kind} failures=${s.failures}${s.gaveUp ? ' (已放弃自动恢复)' : ''}`
    );
    if (s.gaveUp) {
      if (s.kind === 'main') this._showErrorPage(win, s);
      else this._closeFloat(win);
      return;
    }
    this._schedule(win, s);
  }

  _onUnresponsive(win) {
    if (this.opts.isQuitting() || win.isDestroyed()) return;
    const s = this._state(win);
    if (s.gaveUp || !s.expectingWeb || s.hangGrace) return;
    this._log(`检测到界面无响应（kind=${s.kind}），宽限 ${this.opts.UNRESPONSIVE_GRACE_MS}ms 后强制恢复`);
    s.hangDetectedAt = Date.now();
    s.hangGrace = setTimeout(() => {
      s.hangGrace = null;
      if (win.isDestroyed() || this.opts.isQuitting() || s.gaveUp) return;
      const last = this._heartbeats.get(win.webContents.id) || 0;
      if (last && last > s.hangDetectedAt) {
        this._log('宽限期内心跳恢复，取消挂起处理');
        return;
      }
      this._log('界面持续无响应，强制终结渲染进程以触发恢复');
      s.pendingHangCrash = Date.now();
      s.lastFailure = { reason: 'unresponsive', exitCode: null, at: new Date().toISOString() };
      this._countFailure(win, s);
      let forced = false;
      try {
        if (typeof win.webContents.forcefullyCrashRenderer === 'function') {
          win.webContents.forcefullyCrashRenderer();
          forced = true;
        }
      } catch (err) {
        this._log('强制终结渲染进程失败: ' + err.message);
      }
      if (!forced) this._schedule(win, s);
    }, this.opts.UNRESPONSIVE_GRACE_MS);
    if (s.hangGrace && typeof s.hangGrace.unref === 'function') s.hangGrace.unref();
  }

  _onResponsive(win) {
    const s = this._state(win);
    if (s.hangGrace) {
      clearTimeout(s.hangGrace);
      s.hangGrace = null;
      this._log('界面已恢复响应，取消挂起处理');
    }
  }

  _onFinishLoad(win) {
    if (win.isDestroyed()) return;
    const s = this._state(win);
    const target = this.opts.getTarget(win);
    const url = win.webContents.getURL();
    if (target && target.kind === 'url' && this._sameTargetUrl(url, target)) {
      if (s.gaveUp) {
        this._log('已放弃自动恢复，忽略迟到的 Web 加载，回到恢复页');
        this._showErrorPage(win, s, true);
        return;
      }
      s.expectingWeb = true;
      s.failuresAtLoad = s.failures;
      this._log(`界面加载成功: ${url}`);
      if (s.stabilityTimer) clearTimeout(s.stabilityTimer);
      s.stabilityTimer = setTimeout(() => {
        s.stabilityTimer = null;
        if (win.isDestroyed()) return;
        if (s.failures === (s.failuresAtLoad || 0)) {
          this._log(`界面已稳定（failures=${s.failures}），清零故障计数`);
          try { this.opts.onStable && this.opts.onStable(); } catch {}
          this._resetBurst(s);
        } else {
          this._log(`界面已稳定，但故障窗口内又发生故障（failures=${s.failures}），保留计数防止循环`);
        }
        s.expectingWeb = true;
      }, this.opts.STABILITY_MS);
      if (s.stabilityTimer && typeof s.stabilityTimer.unref === 'function') s.stabilityTimer.unref();
    } else if (target && target.kind === 'file' && this._sameTargetUrl(url, target)) {
      s.expectingWeb = false;
    }
  }

  _onFailLoad(win, { code, desc, url }) {
    if (this.opts.isQuitting() || win.isDestroyed()) return;
    if (code === -3) return;
    const s = this._state(win);
    if (s.gaveUp) return;
    if (s.loadFlight && s.loadFlight.active) return;
    const target = this.opts.getTarget(win);
    if (!this._sameTargetUrl(url, target)) return;
    this._log(`目标页加载失败: code=${code} desc=${desc || ''} url=${url}`);
    if (!this.opts.isServerAlive()) {
      this._log('服务进程已退出，交由既有重启对话框处理');
      if (s.kind === 'float') this._closeFloat(win);
      return;
    }
    this._countFailure(win, s);
    this._schedule(win, s);
  }

  _schedule(win, s) {
    if (s.attemptTimer) {
      clearTimeout(s.attemptTimer);
      s.attemptTimer = null;
      s.gen += 1;
    }
    const action = nextAction(s.failures, s.kind, s.rebuiltInBurst, this.opts);
    if (action === 'give-up') { this._giveUp(win, s); return; }
    if (action === 'rebuild') { this._rebuildNow(win, s); return; }
    const delay = computeBackoff(s.failures, this.opts);
    this._log(`安排恢复: kind=${s.kind} failures=${s.failures} 延迟=${delay}ms 动作=reload`);
    s.attemptTimer = setTimeout(() => {
      s.attemptTimer = null;
      this._attempt(win, s, ++s.gen);
    }, delay);
    if (s.attemptTimer && typeof s.attemptTimer.unref === 'function') s.attemptTimer.unref();
  }

  async _attempt(win, s, gen) {
    if (this.opts.isQuitting() || win.isDestroyed() || gen !== s.gen) return;
    let target = this.opts.getTarget(win);
    if (!target) {
      if (s.kind === 'float') { this._closeFloat(win); return; }
      target = { kind: 'file', path: this.opts.loadingPage };
    }
    try {
      await this._loadTracked(win, s, target, gen);
      return;
    } catch (err) {
      if (this.opts.isQuitting() || win.isDestroyed() || gen !== s.gen) return;
      if (/ERR_ABORTED/.test(String((err && err.message) || err))) return;
      this._log(`恢复加载失败: ${((err && err.message) || err)}`);
      if (target.kind === 'url' && this.opts.isServerAlive()) {
        let waited = false;
        try {
          await this.opts.waitServerUp(this.opts.SERVER_WAIT_MAX_MS);
          waited = true;
        } catch { waited = false; }
        if (this.opts.isQuitting() || win.isDestroyed() || gen !== s.gen) return;
        const fresh = this.opts.getTarget(win);
        if (waited && fresh && fresh.kind === 'url') {
          try {
            await this._loadTracked(win, s, fresh, gen);
            return;
          } catch (err2) {
            if (gen !== s.gen || /ERR_ABORTED/.test(String((err2 && err2.message) || err2))) return;
            this._log(`服务恢复后重试加载仍失败: ${((err2 && err2.message) || err2)}`);
          }
        }
      }
      if (target.kind === 'url' && !this.opts.isServerAlive()) {
        this._log('服务进程已退出，交由既有重启对话框处理');
        if (s.kind === 'float') this._closeFloat(win);
        return;
      }
      this._countFailure(win, s);
      this._schedule(win, s);
    }
  }

  async _loadTracked(win, s, target, gen) {
    const flight = { active: true };
    s.loadFlight = flight;
    try {
      await this._loadWithTimeout(win, target, gen);
    } finally {
      flight.active = false;
      if (s.loadFlight === flight) s.loadFlight = null;
    }
  }

  _loadWithTimeout(win, target, gen) {
    return new Promise((resolve, reject) => {
      if (win.isDestroyed()) return reject(new Error('window destroyed'));
      let settled = false;
      let timer = null;
      const done = (fn, v) => {
        if (settled) return;
        settled = true;
        if (timer) { clearTimeout(timer); timer = null; }
        fn(v);
      };
      const p = target.kind === 'url'
        ? win.webContents.loadURL(target.url)
        : win.webContents.loadFile(target.path);
      p.then(
        (v) => done(resolve, v),
        (err) => done(reject, err)
      );
      timer = setTimeout(() => {
        done(reject, new Error('load timeout'));
      }, this.opts.LOAD_TIMEOUT_MS);
      if (timer && typeof timer.unref === 'function') timer.unref();
    });
  }

  _rebuildNow(win, s) {
    this._log(`连续失败达到重建阈值（failures=${s.failures}），重建主窗口`);
    const carried = {
      failures: s.failures,
      windowStart: s.windowStart,
      rebuiltInBurst: true,
      lastFailure: s.lastFailure,
    };
    let newWin = null;
    try {
      newWin = this.opts.rebuildMainWindow({ startHidden: s.userHidden });
    } catch (err) {
      this._log(`重建主窗口异常: ${((err && err.message) || err)}`);
      this._countFailure(win, s);
      this._schedule(win, s);
      return;
    }
    if (!newWin || newWin.isDestroyed()) {
      this._countFailure(win, s);
      this._schedule(win, s);
      return;
    }
    const ns = this._state(newWin);
    Object.assign(ns, carried);
    this._log('主窗口已重建，继续恢复流程');
    this._schedule(newWin, ns);
  }

  _giveUp(win, s) {
    if (s.gaveUp) return;
    s.gaveUp = true;
    this._clearTimers(s);
    s.gen += 1;
    this._log(`自动恢复失败达到上限，kind=${s.kind} failures=${s.failures}，停止自动恢复`);
    if (s.kind === 'main') {
      this._showErrorPage(win, s, true);
      try { this.opts.onGaveUp && this.opts.onGaveUp(s.lastFailure); } catch {}
      try {
        this.opts.notify && this.opts.notify(
          'DeepSeek Harness 界面多次异常退出',
          '已暂停自动恢复并显示恢复页面。你的数据与后台任务不受影响，仍在继续运行。'
        );
      } catch {}
    } else {
      this._closeFloat(win);
    }
  }

  _showErrorPage(win, s, force = false) {
    if (win.isDestroyed()) return;
    const now = Date.now();
    if (!force && now - s.lastErrorPageAt < this.opts.ERROR_PAGE_RELOAD_MIN_INTERVAL_MS) return;
    s.lastErrorPageAt = now;
    this._log('加载本地恢复页面');
    if (this.opts.recoveryPage) {
      win.webContents.loadFile(this.opts.recoveryPage).catch((e) => this._log('恢复页加载失败: ' + String((e && e.message) || e)));
    }
  }

  _closeFloat(win) {
    this._log('关闭无法恢复的浮窗');
    try { if (!win.isDestroyed()) win.destroy(); } catch {}
  }
}

module.exports = { RendererRecovery, computeBackoff, nextAction, DEFAULT_OPTS };
