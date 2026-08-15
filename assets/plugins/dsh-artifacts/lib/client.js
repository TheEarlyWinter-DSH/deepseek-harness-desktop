window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-artifacts",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ---------------------------------------------------------------------------
    // Artifacts & Delivery Drawer for DeepSeek Harness Web UI
    // ---------------------------------------------------------------------------

    const CSS = `
.dsh-artifacts-badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, var(--dsw-alias-bg-elevated, #1a2234) 80%, transparent);
  color: var(--dsw-alias-label-secondary, #94a3b8);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  backdrop-filter: blur(8px);
}
.dsh-artifacts-badge-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.12));
  color: var(--dsw-alias-label-primary, #f8fafc);
  border-color: var(--dsw-alias-accent-primary, #60a5fa);
}
.dsh-artifacts-badge-btn svg {
  width: 13px;
  height: 13px;
  color: var(--dsw-alias-accent-primary, #60a5fa);
}
.dsh-artifacts-modal-overlay {
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
.dsh-artifacts-modal {
  width: 580px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--dsw-alias-bg-base, #0b1220);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.15));
  border-radius: 14px;
  box-shadow: 0 16px 40px -4px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dsh-artifacts-in 0.18s ease-out;
}
@keyframes dsh-artifacts-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.dsh-artifacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
}
.dsh-artifacts-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #f1f5f9);
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-artifacts-close {
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #64748b);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dsh-artifacts-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--dsw-alias-label-primary, #f8fafc);
}
.dsh-artifacts-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-artifact-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-elevated, #161f30) 70%, transparent);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  transition: all 0.12s ease;
}
.dsh-artifact-item:hover {
  border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.18));
  background: var(--dsw-alias-bg-elevated, #1a2438);
}
.dsh-artifact-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.dsh-artifact-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #e2e8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-artifact-meta {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  display: flex;
  gap: 8px;
}
.dsh-artifact-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dsh-artifact-action-btn {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
  background: rgba(255, 255, 255, 0.04);
  color: var(--dsw-alias-label-secondary, #cbd5e1);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dsh-artifact-action-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.12));
  color: var(--dsw-alias-label-primary, #f8fafc);
}
.dsh-artifacts-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--dsw-alias-label-tertiary, #64748b);
  font-size: 12.5px;
}
`;

    function ensureStyles() {
      if (document.getElementById("dsh-artifacts-css")) return;
      const style = document.createElement("style");
      style.id = "dsh-artifacts-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function formatSize(bytes) {
      if (!bytes || bytes < 0) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      let i = 0;
      let val = bytes;
      while (val >= 1024 && i < units.length - 1) {
        val /= 1024;
        i++;
      }
      return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    }

    async function fetchArtifacts() {
      try {
        const res = await fetch("/api/dsh-artifacts/list");
        if (!res.ok) return [];
        const data = await res.json();
        return data.ok && Array.isArray(data.artifacts) ? data.artifacts : [];
      } catch {
        return [];
      }
    }

    function showArtifactsModal(artifacts) {
      ensureStyles();
      const overlay = document.createElement("div");
      overlay.className = "dsh-artifacts-modal-overlay";

      const itemsHtml = artifacts.length === 0
        ? `<div class="dsh-artifacts-empty">当前工作区暂未检测到生成产物（dist / exe / zip / pdf 等）</div>`
        : artifacts.map((item, idx) => `
          <div class="dsh-artifact-item">
            <div class="dsh-artifact-info">
              <div class="dsh-artifact-name" title="${escapeHtml(item.path)}">${escapeHtml(item.name)}</div>
              <div class="dsh-artifact-meta">
                <span>${escapeHtml(item.relPath)}</span>
                <span>·</span>
                <span>${formatSize(item.size)}</span>
              </div>
            </div>
            <div class="dsh-artifact-actions">
              <button type="button" class="dsh-artifact-action-btn dsh-art-reveal" data-idx="${idx}">
                📂 定位
              </button>
              <button type="button" class="dsh-artifact-action-btn dsh-art-open" data-idx="${idx}">
                🚀 打开
              </button>
              <button type="button" class="dsh-artifact-action-btn dsh-art-copy" data-idx="${idx}">
                📋 复制路径
              </button>
            </div>
          </div>
        `).join("");

      overlay.innerHTML = `
        <div class="dsh-artifacts-modal">
          <div class="dsh-artifacts-header">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              会话生成产物与交付文件 (${artifacts.length})
            </h3>
            <button type="button" class="dsh-artifacts-close" title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="dsh-artifacts-list">
            ${itemsHtml}
          </div>
        </div>
      `;

      function close() {
        overlay.remove();
      }

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      overlay.querySelector(".dsh-artifacts-close").addEventListener("click", close);

      // Wire item actions
      overlay.querySelectorAll(".dsh-art-reveal").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-idx"));
          const item = artifacts[idx];
          if (item?.path) {
            fetch(`/api/dsh-artifacts/reveal?path=${encodeURIComponent(item.path)}`);
          }
        });
      });

      overlay.querySelectorAll(".dsh-art-open").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-idx"));
          const item = artifacts[idx];
          if (item?.path && window.dshDesktop?.openPath) {
            window.dshDesktop.openPath(item.path);
          }
        });
      });

      overlay.querySelectorAll(".dsh-art-copy").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const idx = Number(btn.getAttribute("data-idx"));
          const item = artifacts[idx];
          if (item?.path) {
            if (window.dshDesktop?.copyText) {
              await window.dshDesktop.copyText(item.path);
            } else {
              await navigator.clipboard.writeText(item.path);
            }
            btn.textContent = "已复制";
            setTimeout(() => { btn.textContent = "📋 复制路径"; }, 1500);
          }
        });
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

    // Floating trigger button in DSH Web UI
    function ensureFloatingTrigger() {
      ensureStyles();
      if (document.getElementById("dsh-artifacts-trigger")) return;
      const btn = document.createElement("button");
      btn.id = "dsh-artifacts-trigger";
      btn.className = "dsh-artifacts-badge-btn";
      btn.style.position = "fixed";
      btn.style.bottom = "12px";
      btn.style.right = "16px";
      btn.style.zIndex = "2147483000";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span>产物交付</span>
      `;

      btn.addEventListener("click", async () => {
        const artifacts = await fetchArtifacts();
        showArtifactsModal(artifacts);
      });

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
            const btn = document.getElementById("dsh-artifacts-trigger");
            if (btn) btn.remove();
          };
        });
      }
    }

    exports.apply = apply;
    exports.showArtifactsModal = showArtifactsModal;
    return module.exports;
  }
});
