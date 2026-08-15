window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-bridge-remote",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ---------------------------------------------------------------------------
    // Cross-platform Remote Bridge & Push Client for DeepSeek Harness
    // ---------------------------------------------------------------------------

    const CSS = `
.dsh-bridge-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483600;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dsh-bridge-modal {
  width: 520px;
  max-width: 90vw;
  background: var(--dsw-alias-bg-base, #0b1220);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.15));
  border-radius: 14px;
  box-shadow: 0 16px 40px -4px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dsh-bridge-in 0.18s ease-out;
}
@keyframes dsh-bridge-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.dsh-bridge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
}
.dsh-bridge-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #f1f5f9);
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-bridge-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dsh-bridge-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh-bridge-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #e2e8f0);
}
.dsh-bridge-desc {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  margin-top: -2px;
}
.dsh-bridge-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  background: var(--dsw-alias-bg-elevated, #161f30);
  color: var(--dsw-alias-label-primary, #f1f5f9);
  font-size: 12.5px;
  box-sizing: border-box;
  outline: none;
}
.dsh-bridge-input:focus {
  border-color: var(--dsw-alias-accent-primary, #60a5fa);
}
.dsh-bridge-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
}
.dsh-bridge-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.dsh-bridge-btn-primary {
  background: var(--dsw-alias-accent-primary, #3b82f6);
  color: #fff;
}
.dsh-bridge-btn-primary:hover {
  background: #2563eb;
}
.dsh-bridge-btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: var(--dsw-alias-label-secondary, #cbd5e1);
  border-color: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
}
.dsh-bridge-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.14);
}
`;

    function ensureStyles() {
      if (document.getElementById("dsh-bridge-css")) return;
      const style = document.createElement("style");
      style.id = "dsh-bridge-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    async function loadConfig() {
      try {
        const res = await fetch("/api/dsh-bridge/config");
        const data = await res.json();
        return data.ok ? data.config : {};
      } catch {
        return {};
      }
    }

    async function saveConfig(cfg) {
      await fetch("/api/dsh-bridge/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg)
      });
    }

    async function openBridgeModal() {
      ensureStyles();
      const cfg = await loadConfig();

      const overlay = document.createElement("div");
      overlay.className = "dsh-bridge-modal-overlay";
      overlay.innerHTML = `
        <div class="dsh-bridge-modal">
          <div class="dsh-bridge-header">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              跨端 Bridge 手机遥控与完成推送
            </h3>
            <button type="button" class="dsh-artifacts-close" title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="dsh-bridge-body">
            <div class="dsh-bridge-field">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="dsh-bridge-enabled" ${cfg.enabled ? "checked" : ""}>
                <span class="dsh-bridge-label">启用任务完成手机端推送通知</span>
              </label>
            </div>
            <div class="dsh-bridge-field">
              <span class="dsh-bridge-label">Bark URL (iOS 极速通知)</span>
              <span class="dsh-bridge-desc">例如：https://api.day.app/your_key</span>
              <input type="text" id="dsh-bridge-bark" class="dsh-bridge-input" value="${escapeHtml(cfg.barkUrl || "")}" placeholder="https://api.day.app/...">
            </div>
            <div class="dsh-bridge-field">
              <span class="dsh-bridge-label">飞书 Webhook 机器人</span>
              <span class="dsh-bridge-desc">飞书群自定义机器人 Webhook 地址</span>
              <input type="text" id="dsh-bridge-feishu" class="dsh-bridge-input" value="${escapeHtml(cfg.feishuWebhook || "")}" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/...">
            </div>
            <div class="dsh-bridge-field">
              <span class="dsh-bridge-label">通用自定义 Webhook</span>
              <span class="dsh-bridge-desc">任务完成时以 POST JSON 发送通知</span>
              <input type="text" id="dsh-bridge-custom" class="dsh-bridge-input" value="${escapeHtml(cfg.customWebhook || "")}" placeholder="https://your-server.com/webhook">
            </div>
          </div>
          <div class="dsh-bridge-footer">
            <button type="button" class="dsh-bridge-btn dsh-bridge-btn-secondary" id="dsh-bridge-test">
              🔔 发送测试通知
            </button>
            <button type="button" class="dsh-bridge-btn dsh-bridge-btn-primary" id="dsh-bridge-save">
              💾 保存配置
            </button>
          </div>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
      overlay.querySelector(".dsh-artifacts-close").addEventListener("click", close);

      const btnTest = overlay.querySelector("#dsh-bridge-test");
      btnTest.addEventListener("click", async () => {
        const nextCfg = {
          enabled: true,
          barkUrl: overlay.querySelector("#dsh-bridge-bark").value.trim(),
          feishuWebhook: overlay.querySelector("#dsh-bridge-feishu").value.trim(),
          customWebhook: overlay.querySelector("#dsh-bridge-custom").value.trim(),
        };
        await saveConfig(nextCfg);
        btnTest.textContent = "⏳ 发送中...";
        try {
          await fetch("/api/dsh-bridge/test-push", { method: "POST" });
          btnTest.textContent = "✅ 已发送";
        } catch {
          btnTest.textContent = "❌ 发送失败";
        }
        setTimeout(() => { btnTest.textContent = "🔔 发送测试通知"; }, 2000);
      });

      const btnSave = overlay.querySelector("#dsh-bridge-save");
      btnSave.addEventListener("click", async () => {
        const nextCfg = {
          enabled: overlay.querySelector("#dsh-bridge-enabled").checked,
          barkUrl: overlay.querySelector("#dsh-bridge-bark").value.trim(),
          feishuWebhook: overlay.querySelector("#dsh-bridge-feishu").value.trim(),
          customWebhook: overlay.querySelector("#dsh-bridge-custom").value.trim(),
        };
        await saveConfig(nextCfg);
        btnSave.textContent = "✅ 已保存";
        setTimeout(() => { close(); }, 600);
      });

      document.body.appendChild(overlay);
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Bridge trigger button in DSH Web UI
    function ensureFloatingTrigger() {
      ensureStyles();
      if (document.getElementById("dsh-bridge-trigger")) return;
      const btn = document.createElement("button");
      btn.id = "dsh-bridge-trigger";
      btn.className = "dsh-artifacts-badge-btn";
      btn.style.position = "fixed";
      btn.style.bottom = "12px";
      btn.style.right = "105px";
      btn.style.zIndex = "2147483000";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span>手机推送</span>
      `;

      btn.addEventListener("click", openBridgeModal);
      document.body.appendChild(btn);
    }

    function apply(ctx) {
      if (document.body) {
        ensureFloatingTrigger();
      } else {
        document.addEventListener("DOMContentLoaded", ensureFloatingTrigger);
      }
      if (ctx && typeof ctx.effect === "function") {
        ctx.effect(() => {
          return () => {
            const btn = document.getElementById("dsh-bridge-trigger");
            if (btn) btn.remove();
          };
        });
      }
    }

    exports.apply = apply;
    exports.openBridgeModal = openBridgeModal;
    return module.exports;
  }
});
