# AGENTS.md

> 本文件是 Codex / 其他 AI 编程助手在本仓库工作时需要遵循的项目结构说明与规则。

## 项目概述

-   **架构：monorepo**：本仓库采用 pnpm workspace + Turbo 的 monorepo 架构，由多个应用（`apps/*`）与共享包（`packages/*`）组成；子智能体应明确这不是单一应用，改动前先界定所属子包边界。
-   项目名：`baize-next`，仓库：`git@github.com:Isteyft/monorepo-dev-starter.git`
-   使用 pnpm workspace 的 monorepo 结构，包管理器固定为 `pnpm@10.19.0`
-   使用 Turbo 管理 `typecheck` 任务
-   根目录为私有包（`private: true`），实际子包统一使用 `@baize-next/<name>` 命名

## 目录结构

```text
apps/
  backend/
    server/          # @baize-next/server 后端服务
  frontend/
    destop/          # @baize-next/destop 桌面端（注意目录名拼写为 destop）
    mobile/          # @baize-next/mobile 移动端
    website/         # @baize-next/website Web 端
packages/
  core/              # @baize-next/core 核心功能共享包
  types/             # @baize-next/types TypeScript 类型定义共享包
  ui/                # @baize-next/ui UI 组件共享包（目前含 src/styles.css）
  utils/             # @baize-next/uitls 工具函数共享包（注意包名拼写为 uitls）
```

-   `pnpm-workspace.yaml` 声明工作区：`packages/*`、`apps/frontend/*`、`apps/backend/*`
-   新增子包时应放置到对应目录，并在 `package.json` 中使用 `@baize-next/<name>` 命名

## 工程规则

-   包管理器：使用 pnpm；依赖变更需一并提交 `pnpm-lock.yaml`
-   TypeScript：
    -   `tsconfig.json`：公共基础配置（严格模式等）
    -   `tsconfig.client.json`：客户端/前端配置（DOM、JSX、bundler resolution、noEmit）
    -   `tsconfig.server.json`：服务端配置（CommonJS、experimentalDecorators 等）
-   代码质量：
    -   ESLint 使用 `eslint.config.js`，启用 `simple-import-sort` 与 Prettier 规则
    -   Prettier 配置见 `.prettierrc`（单引号、无分号、printWidth 140）
    -   CSpell 拼写检查，自定义词表在 `.cspell/custom-words.txt`
    -   测试：新增或修改关键逻辑（工具函数、数据解析、类型生成等）时必须配套编写并运行 Vitest 测试用例（`*.test.ts` / `*.test.tsx`），保证可回归验证
-   Git 提交：
    -   使用 Conventional Commits，通过 commitlint + cz-git 约束
    -   type 枚举：`feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert / wip / workflow / types / release`
    -   `pre-commit` 执行 `lint:staged` + `spellcheck`
    -   `commit-msg` 执行 `commitlint`
-   代码约定：
    -   前后端配置中 `no-console` 为 error，禁止直接使用 `console.log`；需要记录时走项目日志方案
    -   修改公共共享包（`packages/*`）时要注意对下游应用的兼容影响

## 修改日志规则

-   每次对仓库文件的修改都必须同步记录到 `CHANGELOG.md`
-   日志格式：

    ```md
    ## [YYYY-MM-DD]

    -   type(scope): 变更描述
    ```

-   `type` 与 commitlint 的提交类型保持一致（`feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert` 等）
-   新建文件、更新规则、修复问题等均需记录

## 常用命令

-   `pnpm install`：安装依赖
-   `pnpm lint` / `pnpm lint:staged`：代码检查
-   `pnpm spellcheck`：拼写检查
-   `pnpm typecheck`：全仓类型检查（turbo）
-   `pnpm commit`：使用 cz-git 交互式提交
