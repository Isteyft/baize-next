# Changelog

项目变更日志。每次修改仓库文件时都必须在此添加记录。

## [2026-09-13]

-   feat(types): 解析 Data/NPCLeiXingDate.json 并生成 TypeScript 类型，存入 packages/types 共享类型包。
-   feat(types): 解析 Data/NPCWuDaoJson.json 并生成 TypeScript 类型，存入 packages/types 共享类型包。
-   feat(types): 解析 Data 下 BuffJsonData/ItemJsonData/skillJsonData/StaticSkillJsonData.json，分别生成对应 TypeScript 类型并存入 packages/types 共享类型包。
-   fix(types): SkillJsonData/ItemJsonData 中 Affix、wuDao、skill_SameCastNum 修正为 number[]。
-   refactor(types): 将数据类型目录由 generated 更名为 data，并新增 enums 枚举类型专用目录。
-   docs: 新增 AGENTS.md，记录项目结构、工程规则与修改日志规则。
-   docs: 新增项目级规则文件 `.codex/rules.md`（仅作用于本仓库）。
-   chore: 基础项目名称由 baize 改为 baize-next，并同步更新 README、AGENTS.md 与 .codex/rules.md。
-   chore: 子包作用域名由 `@baize/*` 统一改为 `@baize-next/*`，并同步更新 AGENTS.md 与 .codex/rules.md。## [2026-09-14]

-   feat(destop): 初始版本 create Tauri 桌面端应用 @baize-next/destop，基于 React 18 + TypeScript + Tailwind CSS。
-   feat(destop): 实现三栏布局：左栏选择 JSON 数据集，中栏表格展示记录，右栏编辑当前记录 JSON 并实时更新。
-   feat(destop): 隐藏系统默认标题栏，实现自定义任务栏（拖拽、关闭/最小化/最大化、文件/关于菜单）。
-   feat(destop): 新增 Tauri v2 后端配置（tauri.conf.json、capabilities）与应用图标。
