---
name: git-guardrails
description: Git 安全护栏与提交审查。拦截潜在的破坏性操作（如 git push --force, git reset --hard, git clean -fd 等），规范提交信息。
---

# Git 操作安全规范

1. **危险命令防护**：严禁未经用户确认执行 `git reset --hard`、`git push --force` 或 `git clean -fd`。
2. **规范提交信息**：遵循 Conventional Commits（`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`）。
3. **小步提交**：一个逻辑单元一次提交，避免巨大且无法 review 的提交记录。
