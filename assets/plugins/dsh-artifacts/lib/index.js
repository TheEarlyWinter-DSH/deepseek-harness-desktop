import { readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFile } from "node:child_process";

export const inject = ["webServer"];
export const name = "@deepseek-ai/dsh-artifacts";

const ARTIFACT_EXTS = new Set([
  ".exe", ".zip", ".tar", ".gz", ".7z",
  ".pdf", ".docx", ".xlsx", ".pptx",
  ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp",
  ".html", ".json", ".csv"
]);

const ARTIFACT_DIRS = ["dist", "build", "out", "output", "artifacts", "bin", "release"];

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

export function apply(ctx) {
  if (ctx.webServer && typeof ctx.webServer.register === "function") {
    // 扫描工作区产物
    ctx.webServer.register({
      kind: "exact",
      path: "/api/dsh-artifacts/list",
      handler: async (req, res) => {
        let url;
        try {
          url = new URL(req.url, "http://127.0.0.1");
        } catch {
          return sendJson(res, 400, { ok: false, error: "bad request URL" });
        }
        const workspacePath = url.searchParams.get("path") || process.cwd();

        if (!existsSync(workspacePath)) {
          return sendJson(res, 404, { ok: false, error: "工作区路径不存在" });
        }

        try {
          const artifacts = [];
          const visited = new Set();

          // 1. 扫描特定产物目录
          for (const dir of ARTIFACT_DIRS) {
            const targetDir = join(workspacePath, dir);
            if (!existsSync(targetDir)) continue;
            try {
              const files = readdirSync(targetDir, { withFileTypes: true });
              for (const f of files) {
                if (!f.isFile()) continue;
                const fullPath = join(targetDir, f.name);
                if (visited.has(fullPath)) continue;
                visited.add(fullPath);
                const stat = statSync(fullPath);
                artifacts.push({
                  name: f.name,
                  path: fullPath,
                  relPath: join(dir, f.name),
                  size: stat.size,
                  mtime: stat.mtimeMs,
                  ext: extname(f.name).toLowerCase()
                });
              }
            } catch {}
          }

          // 2. 扫描根目录下匹配后缀的生成文件（50MB 内）
          try {
            const rootFiles = readdirSync(workspacePath, { withFileTypes: true });
            for (const f of rootFiles) {
              if (!f.isFile()) continue;
              const ext = extname(f.name).toLowerCase();
              if (!ARTIFACT_EXTS.has(ext)) continue;
              const fullPath = join(workspacePath, f.name);
              if (visited.has(fullPath)) continue;
              visited.add(fullPath);
              const stat = statSync(fullPath);
              artifacts.push({
                name: f.name,
                path: fullPath,
                relPath: f.name,
                size: stat.size,
                mtime: stat.mtimeMs,
                ext
              });
            }
          } catch {}

          // 按修改时间倒序排列
          artifacts.sort((a, b) => b.mtime - a.mtime);

          sendJson(res, 200, { ok: true, artifacts: artifacts.slice(0, 50) });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err && err.message) });
        }
      }
    });

    // 定位或打开文件
    ctx.webServer.register({
      kind: "exact",
      path: "/api/dsh-artifacts/reveal",
      handler: (req, res) => {
        let url;
        try {
          url = new URL(req.url, "http://127.0.0.1");
        } catch {
          return sendJson(res, 400, { ok: false, error: "bad request URL" });
        }
        const targetPath = url.searchParams.get("path");
        if (!targetPath || !existsSync(targetPath)) {
          return sendJson(res, 404, { ok: false, error: "文件不存在" });
        }
        if (process.platform === "win32") {
          execFile("explorer.exe", ["/select,", targetPath], () => {});
        }
        sendJson(res, 200, { ok: true });
      }
    });
  }
}
