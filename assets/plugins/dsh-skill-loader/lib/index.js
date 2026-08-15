import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const inject = ["webServer"];
export const name = "@deepseek-ai/dsh-skill-loader";

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

// SKILL.md Loader Node Half:
// Scans ~/.dsh/skills and provides GET /api/dsh-skills/list endpoint
export function apply(ctx) {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const skillsDir = join(dshHome, "skills");

  if (ctx.webServer && typeof ctx.webServer.register === "function") {
    ctx.webServer.register({
      kind: "exact",
      path: "/api/dsh-skills/list",
      handler: async (_req, res) => {
        if (!existsSync(skillsDir)) {
          return sendJson(res, 200, { ok: true, skills: [] });
        }
        try {
          const entries = readdirSync(skillsDir, { withFileTypes: true });
          const skills = [];
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillFile = join(skillsDir, entry.name, "SKILL.md");
            if (!existsSync(skillFile)) continue;
            const text = readFileSync(skillFile, "utf8");
            const nameMatch = /^name:\s*(.+)$/m.exec(text);
            const descMatch = /^description:\s*(.+)$/m.exec(text);
            skills.push({
              id: entry.name,
              name: nameMatch ? nameMatch[1].trim() : entry.name,
              desc: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, "") : "",
              path: skillFile
            });
          }
          sendJson(res, 200, { ok: true, count: skills.length, skills });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err && err.message) });
        }
      }
    });
  }
}
