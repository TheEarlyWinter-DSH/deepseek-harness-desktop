window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-interactive-cards",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ---------------------------------------------------------------------------
    // Interactive Cards & Generative UI Renderer for DeepSeek Harness
    // ---------------------------------------------------------------------------

    const CARD_TAG = "dsh-card";
    const CARD_ATTR_PROCESSED = "data-dsh-card-mounted";
    let cardSeq = 0;

    // CSS Styles for Card Containers
    const CARD_CSS = `
.dsh-card-container {
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  background: var(--dsw-alias-bg-elevated, rgba(16, 22, 34, 0.75));
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.dsh-card-container:hover {
  border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.22));
  box-shadow: 0 6px 28px -2px rgba(0, 0, 0, 0.45);
}
.dsh-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base, #0b1220) 80%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
  user-select: none;
}
.dsh-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dsh-card-icon {
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-accent-primary, #60a5fa);
  flex: none;
}
.dsh-card-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #f1f5f9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-card-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-accent-primary, #60a5fa) 15%, transparent);
  color: var(--dsw-alias-accent-primary, #60a5fa);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-accent-primary, #60a5fa) 30%, transparent);
  flex: none;
  text-transform: uppercase;
}
.dsh-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.dsh-card-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #94a3b8);
  font-size: 11px;
  cursor: pointer;
  outline: none;
  gap: 4px;
  transition: all 0.15s ease;
}
.dsh-card-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-primary, #f8fafc);
}
.dsh-card-btn svg {
  width: 13px;
  height: 13px;
}
.dsh-card-body {
  position: relative;
  width: 100%;
  min-height: 80px;
  background: transparent;
}
.dsh-card-iframe {
  width: 100%;
  border: none;
  display: block;
  background: transparent;
  transition: height 0.15s ease-out;
}
.dsh-card-source {
  display: none;
  padding: 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base, #0b1220) 95%, transparent);
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
  max-height: 240px;
  overflow: auto;
}
.dsh-card-source.dsh-card-source-visible {
  display: block;
}
.dsh-card-source pre {
  margin: 0;
  font-family: var(--ds-font-family-code, Consolas, monospace);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary, #cbd5e1);
  white-space: pre-wrap;
  word-break: break-all;
}
`;

    // Inject stylesheet once
    function ensureStyles() {
      if (document.getElementById("dsh-interactive-cards-css")) return;
      const style = document.createElement("style");
      style.id = "dsh-interactive-cards-css";
      style.textContent = CARD_CSS;
      document.head.appendChild(style);
    }

    // Build the isolated HTML payload to feed into iframe srcdoc
    function buildCardHtml(cardId, content, title) {
      const isSvg = /^\s*<svg[\s>]/i.test(content.trim());
      const bodyContent = isSvg
        ? `<div class="svg-wrapper" style="display:flex;justify-content:center;align-items:center;padding:16px;">${content}</div>`
        : content;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title || "Interactive Card")}</title>
  <style>
    :root {
      color-scheme: dark light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      color: var(--text, #f1f5f9);
      font-size: 13.5px;
      line-height: 1.5;
      overflow-x: hidden;
    }
    body { padding: 12px; }
    svg { max-width: 100%; height: auto; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    button, input, select, textarea { font-family: inherit; font-size: inherit; }
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    (function() {
      var cardId = ${JSON.stringify(cardId)};
      function reportHeight() {
        var h = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          document.body.offsetHeight,
          60
        );
        window.parent.postMessage({ type: 'dsh-card-resize', cardId: cardId, height: h + 16 }, '*');
      }
      window.addEventListener('load', reportHeight);
      window.addEventListener('resize', reportHeight);
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(reportHeight).observe(document.body);
      }
      setTimeout(reportHeight, 50);
      setTimeout(reportHeight, 200);
      setTimeout(reportHeight, 800);
    })();
  <\/script>
</body>
</html>`;
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Mount an interactive card DOM component
    function createCardElement(cardId, rawContent, title, badgeText) {
      const container = document.createElement("div");
      container.className = "dsh-card-container";
      container.setAttribute("data-card-id", cardId);

      const isSvg = /^\s*<svg[\s>]/i.test(rawContent.trim());
      const badge = badgeText || (isSvg ? "SVG" : "CARD");
      const displayTitle = title || (isSvg ? "矢量图表" : "交互卡片");

      container.innerHTML = `
        <div class="dsh-card-header">
          <div class="dsh-card-title-wrap">
            <svg class="dsh-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="dsh-card-title">${escapeHtml(displayTitle)}</span>
            <span class="dsh-card-badge">${escapeHtml(badge)}</span>
          </div>
          <div class="dsh-card-actions">
            <button type="button" class="dsh-card-btn dsh-card-btn-refresh" title="重新渲染">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button type="button" class="dsh-card-btn dsh-card-btn-code" title="查看/隐藏代码">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
            <button type="button" class="dsh-card-btn dsh-card-btn-copy" title="复制代码">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button type="button" class="dsh-card-btn dsh-card-btn-popout" title="在新窗口打开">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
        <div class="dsh-card-body">
          <iframe class="dsh-card-iframe" sandbox="allow-scripts allow-forms allow-modals allow-popups" srcdoc="${escapeHtml(buildCardHtml(cardId, rawContent, displayTitle))}"></iframe>
        </div>
        <div class="dsh-card-source">
          <pre><code>${escapeHtml(rawContent)}</code></pre>
        </div>
      `;

      const iframe = container.querySelector(".dsh-card-iframe");
      const sourceBox = container.querySelector(".dsh-card-source");
      const btnRefresh = container.querySelector(".dsh-card-btn-refresh");
      const btnCode = container.querySelector(".dsh-card-btn-code");
      const btnCopy = container.querySelector(".dsh-card-btn-copy");
      const btnPopout = container.querySelector(".dsh-card-btn-popout");

      // Rerender
      btnRefresh.addEventListener("click", () => {
        iframe.srcdoc = buildCardHtml(cardId, rawContent, displayTitle);
      });

      // Toggle code
      btnCode.addEventListener("click", () => {
        sourceBox.classList.toggle("dsh-card-source-visible");
      });

      // Copy source
      btnCopy.addEventListener("click", async () => {
        try {
          if (window.dshDesktop?.copyText) {
            await window.dshDesktop.copyText(rawContent);
          } else {
            await navigator.clipboard.writeText(rawContent);
          }
          btnCopy.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
          setTimeout(() => {
            btnCopy.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
          }, 1500);
        } catch {}
      });

      // Pop out
      btnPopout.addEventListener("click", () => {
        const fullHtml = buildCardHtml(cardId, rawContent, displayTitle);
        const blob = new Blob([fullHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        if (window.dshDesktop?.openExternal) {
          window.dshDesktop.openExternal(url);
        } else {
          window.open(url, "_blank");
        }
      });

      return container;
    }

    // Message listener for auto-height resizing from within sandbox iframe
    window.addEventListener("message", (event) => {
      if (!event.data || event.data.type !== "dsh-card-resize") return;
      const { cardId, height } = event.data;
      if (!cardId || !height) return;
      const container = document.querySelector(`.dsh-card-container[data-card-id="${cardId}"]`);
      if (!container) return;
      const iframe = container.querySelector(".dsh-card-iframe");
      if (iframe) {
        iframe.style.height = `${Math.min(Math.max(height, 80), 900)}px`;
      }
    });

    // Scanner: finds card blocks in chat messages
    function scanAndMountCards() {
      ensureStyles();

      // 1. Scan for custom <dsh-card> / <card> tags
      const customElements = document.querySelectorAll(`dsh-card:not([${CARD_ATTR_PROCESSED}]), card:not([${CARD_ATTR_PROCESSED}])`);
      for (const el of customElements) {
        el.setAttribute(CARD_ATTR_PROCESSED, "true");
        const title = el.getAttribute("title") || "交互卡片";
        const content = el.innerHTML || el.textContent;
        const cardId = "card_" + (++cardSeq);
        const cardEl = createCardElement(cardId, content, title, "CARD");
        el.replaceWith(cardEl);
      }

      // 2. Scan for code blocks explicitly labeled with card or html/svg diagrams
      const codeBlocks = document.querySelectorAll(`pre > code:not([${CARD_ATTR_PROCESSED}])`);
      for (const code of codeBlocks) {
        const text = (code.textContent || "").trim();
        const pre = code.parentElement;
        if (!pre || pre.hasAttribute(CARD_ATTR_PROCESSED)) continue;

        let isMatch = false;
        let title = "交互卡片";
        let badge = "CARD";
        let cardContent = text;

        // Check if code block contains <dsh-card title="...">...</dsh-card>
        const cardTagMatch = /<dsh-card(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]+?)<\/dsh-card>/i.exec(text) ||
                             /<card(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]+?)<\/card>/i.exec(text);
        if (cardTagMatch) {
          isMatch = true;
          title = cardTagMatch[1] || "交互卡片";
          cardContent = cardTagMatch[2];
          badge = "CARD";
        } else if (/^\s*<svg[\s\S]*<\/svg>\s*$/i.test(text)) {
          // Pure SVG block
          isMatch = true;
          title = "SVG 图表";
          badge = "SVG";
        } else {
          // Check class names (e.g. language-card, language-html-card, language-svg-card)
          const cls = (code.className || "") + " " + (pre.className || "");
          if (/\blanguage-(?:card|dsh-card|html-card)\b/i.test(cls)) {
            isMatch = true;
            title = "交互组件";
            badge = "HTML";
          }
        }

        if (isMatch) {
          code.setAttribute(CARD_ATTR_PROCESSED, "true");
          pre.setAttribute(CARD_ATTR_PROCESSED, "true");
          const cardId = "card_" + (++cardSeq);
          const cardEl = createCardElement(cardId, cardContent, title, badge);
          pre.replaceWith(cardEl);
        }
      }
    }

    // Set up MutationObserver to dynamically mount cards as new messages stream in
    let scanTimer = null;
    function scheduleScan() {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(scanAndMountCards, 60);
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          scheduleScan();
          break;
        }
      }
    });

    function apply(ctx) {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        scheduleScan();
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          observer.observe(document.body, { childList: true, subtree: true });
          scheduleScan();
        });
      }
      if (ctx && typeof ctx.effect === "function") {
        ctx.effect(() => {
          return () => {
            observer.disconnect();
            if (scanTimer) clearTimeout(scanTimer);
          };
        });
      }
    }

    exports.apply = apply;
    exports.scanAndMountCards = scanAndMountCards;
    return module.exports;
  }
});
