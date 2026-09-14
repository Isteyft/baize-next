# Project Rules — baize-next monorepo

> 这是本项目（baize-next）的项目级规则，仅作用于本仓库，不写入用户全局配置。
> Codex / 其他 AI 助手在本仓库工作时应同时遵循根目录 `AGENTS.md` 与本文件。

## 架构规则

-   **本项目是 monorepo 架构**，由多个应用（`apps/*`）与共享包（`packages/*`）组成，使用 pnpm workspace + Turbo 管理。
-   子智能体处理本项目时必须先确认改动所属包（应用或共享包）边界，避免跨包误改。
-   修改共享包 `packages/*` 时须评估对 `apps/*` 下游应用的影响。

## 项目结构

-   pnpm workspace + Turbo 的 monorepo，包管理器固定为 `pnpm@10.19.0`
-   `apps/backend/server`：后端服务 `@baize-next/server`
-   `apps/frontend/destop`：桌面端 `@baize-next/destop`（目录名拼写为 destop）
-   `apps/frontend/mobile`：移动端 `@baize-next/mobile`
-   `apps/frontend/website`：Web 端 `@baize-next/website`
-   `packages/core`、`packages/types`、`packages/ui`、`packages/utils`：共享包，统一命名 `@baize-next/<name>`

## 工程规则

-   使用 pnpm 安装/管理依赖；依赖变更需提交 `pnpm-lock.yaml`
-   TypeScript：公共配置见 `tsconfig.json`，前端用 `tsconfig.client.json`，服务端用 `tsconfig.server.json`
-   代码质量：遵循 ESLint（`eslint.config.js`）、Prettier（`.prettierrc`）、CSpell（`cspell.json`）
-   Git 提交：遵循 Conventional Commits，type 枚举见 `commitlint.config.cjs`；`pre-commit` 会执行 lint + spellcheck
-   前后端代码中 `no-console` 为 error，禁止直接 `console.log`

## 修改日志规则

-   **每次对本仓库文件的修改都必须同步记录到 `CHANGELOG.md`**
-   格式：

    `## [YYYY-MM-DD]` 日期段下追加
    `- type(scope): 变更描述`

-   type 与 commitlint 类型保持一致：`feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert` 等
-   新建文件、更新规则、修复问题等均需记录
