import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const inject = ["webServer"];
export const name = "@deepseek-ai/dsh-bridge-remote";

// ---------------------------------------------------------------------------
// Config persistence: stored in ~/.dsh/bridge.json
// ---------------------------------------------------------------------------
function getBridgeConfigPath() {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  return join(dshHome, "bridge.json");
}

function loadConfig() {
  const p = getBridgeConfigPath();
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {}
  }
  return { barkKey: "", feishuWebhook: "", customWebhook: "", pushOnDone: true };
}

function saveConfig(cfg) {
  const p = getBridgeConfigPath();
  try {
    writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
  } catch {}
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

// ---------------------------------------------------------------------------
// Push channels
// ---------------------------------------------------------------------------
async function sendPush(title, body) {
  const cfg = loadConfig();

  // 1. Bark (iOS)
  if (cfg.barkKey && cfg.barkKey.trim().length > 0) {
    try {
      const url = `https://api.day.app/${encodeURIComponent(cfg.barkKey.trim())}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
      await fetch(url, { method: "GET" });
    } catch {}
  }

  // 2. 飞书 Webhook
  if (cfg.feishuWebhook && cfg.feishuWebhook.trim().length > 0) {
    try {
      await fetch(cfg.feishuWebhook.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: { text: `【${title}】\n${body}` }
        })
      });
    } catch {}
  }

  // 3. 通用自定义 Webhook
  if (cfg.customWebhook && cfg.customWebhook.trim().length > 0) {
    try {
      await fetch(cfg.customWebhook.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, timestamp: Date.now() })
      });
    } catch {}
  }
}

export function apply(ctx) {
  if (ctx.webServer && typeof ctx.webServer.register === "function") {
    // 读取配置
    ctx.webServer.register({
      kind: "exact",
      path: "/api/dsh-bridge/config",
      handler: async (req, res) => {
        if (req.method === "POST") {
          try {
            const next = await readBody(req);
            saveConfig(next);
            return sendJson(res, 200, { ok: true });
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: String(err && err.message) });
          }
        }
        return sendJson(res, 200, { ok: true, config: loadConfig() });
      }
    });

    // 发送测试推送
    ctx.webServer.register({
      kind: "exact",
      path: "/api/dsh-bridge/test-push",
      handler: async (_req, res) => {
        try {
          await sendPush("DeepSeek Harness 测试通知", "你的跨端 Bridge 推送服务连接正常！");
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err && err.message) });
        }
      }
    });
  }
}
