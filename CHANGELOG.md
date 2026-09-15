# Changelog

项目变更日志。每次修改仓库文件时都必须在此添加记录。

## [2026-09-15]
- fix(destop): JSON 解析兼容 BOM 与尾逗号，修复 Meta 目录预加载失败。
-   fix(destop): 中间表格按分组类型显示主键列，无主键字段的数据不再生成伪 ID。
- style(destop): Tip 提示改为页面顶部居中显示。
- feat(destop): 新增可复用的 Tip 组件，设置窗口保存后显示“已保存”提示。
- feat(destop): Meta 预加载改为多条目列表，支持加号添加 JSON 或目录并选择路径。
- style(destop): 设置窗口保存按钮固定到右下角。
- fix(destop): error-log 窗口加入 Tauri capabilities，修复拖拽、最小化、最大化与关闭按钮。
- fix(destop): 启动预加载失败也会写入 error.log。
- feat(destop): 错误提示移至主界面底部，不阻断主界面操作。
- feat(destop): 关于菜单新增错误日志窗口，与设置窗口统一为独立新窗口。
- feat(destop): 新增 error.log 本地读写命令，每次启动重写，当次运行错误勾存至本地文件。
- fix(destop): 预加载失败时不再阻断进入主界面，改为顶部非阻断提示。
- feat(destop): 新增启动预加载界面，默认加载 ./Editor 下的 mod JSON，支持 JSON 文件或目录模式。
- feat(destop): 设置中新增 JSON 预加载来源，可选择加载 JSON 或加载目录并持久化路径。
- feat(types): 新增 PreloadSourceMode 枚举与 ProjectSettings 预加载字段，ProjectModGroupKey 增加 preload 分组。
- feat(destop): Tauri 后端新增 read_json_file 命令，支持单个 JSON 文件预加载。

- chore: Data/ 目录加入 .gitignore 并从 git 索引移除，磁盘数据保留本地。
- feat(types): 新增 Data/Meta 元数据 JSON 对应的 TypeScript 类型，导出为 packages/types/src/data/meta。

-   feat(destop): 设置窗口新增“语言”下拉框，按主题模式持久化并跨窗口同步。
-   feat(types): 新增 AppLanguage 枚举，并将 ProjectSettings.language 提供给设置存储。
-   docs(i18n): 补充 en/zh-CN 语言设置相关文案。
-   feat(destop): 文件 > 打开项目改为系统目录选择器，通过 Rust 命令递归读取项目 JSON 文件，不再使用文件上传控件。
-   feat(destop): 右侧新增 JSON 编辑器，按字段显示 i18n 文案与类型对应输入框，支持字符串/数字/布尔/数组/对象编辑并实时回写表格。
-   build(destop): 新增 @tauri-apps/plugin-dialog 与 tauri-plugin-dialog 依赖，注册 dialog 插件与 read_project_files 命令。
-   fix(destop): 修复原生目录读取返回字段名与前端不一致导致的 JSON 解析崩溃，Rust 端序列化改为 camelCase。
-   style(destop): JSON 编辑器仅显示字段的 i18n 语言名，移除字段下方的 key 展示。
-   fix(i18n): 重新生成分组字段映射，补齐 qingjiaotype、Skill_LV 等遗漏字段的中文文案。
-   feat(destop): 设置窗口新增界面语言选择并支持跨窗口同步。
-   feat(types): 新增 AppLanguage 枚举与工程设置 language 字段。

-   fix(destop): 修复主题在主窗口不生效的问题，主题切换通过 Tauri 事件跨窗口实时同步（含浏览器预览 storage 兜底）。
-   feat(destop): 设置界面「主题外观」改为下拉框，封装通用 Select 组件，并在右上角新增保存按钮。
-   fix(destop): 修复主窗口与设置窗口主题不同步——Tauri capabilities 补齐 settings 窗口权限（core:event 等），并让 storage 兜底也应用主题。
-   style(destop): 修复窗口控制按钮（最小化/最大化/关闭）图标未居中的问题，改用 flex 居中布局。
-   feat(destop): 为设置子窗口增加自定义拖拽栏与最小化/最大化/关闭按钮（应用 decorations:false，复用 WindowControls）。
-   style(destop): 调整设置窗口「保存」按钮位置，固定于顶部右上角，与窗口控制按钮并排。
-   refactor(destop): 删除主界面标题栏「视图」主题切换菜单，主题统一由设置窗口管理，并清理对应 prop/状态。

## [2026-09-14]

-   style(destop): 桌面端引入「青黑色」主题 Token 系统，以语义色类替换全部灰色阶与蓝色强调（accent/ink/panel/raised/base 等）。
-   feat(destop): 主题系统扩展为三款（青黑色/暗色黑/亮色白），新增 data-theme Token、持久化与标题栏/设置页切换。
-   feat(destop): 设置界面改为独立窗口，由“关于 > 设置”打开，窗口内容暂为 TODO。

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

-   perf(destop): 滚动条改用 requestAnimationFrame 直接刷新滑块位移，移除 transform 过渡，滁涂更丝滑。

-   style(destop): 细化滚动条样式（轨道收细为 10px，滑块改为蓝色，无滚动时轨道弱化）。

-   fix(destop): 修复自定义滚动条首次渲染后不可见的问题（轨道常驻、根据内容溢出动态展示滑块）。

-   style(destop): 滚动条改为独立轨道布局（纵/横向轨道占据固定宽高），不再遮挡表格内容。
-   style(destop): 提升滚动条轨道与滑块对比度（青色滑块 + 灰色轨道），无滚动时自动隐藏轨道。

-   style(destop): 调整数据表格列宽/行高，新增 min-w-max 以支持横向滚动。
-   style(destop): 滚动条预留 padding，为蛇形轨道让位，不再遮挡表格内容。
-   fix(destop): 数据表格过滤 id 字段，避免与 ID 列重复展示。

-   feat(destop): 初始版本 create Tauri 桌面端应用 @baize-next/destop，基于 React 18 + TypeScript + Tailwind CSS。
-   feat(destop): 实现三栏布局：左栏选择 JSON 数据集，中栏表格展示记录，右栏编辑当前记录 JSON 并实时更新。
-   feat(destop): 隐藏系统默认标题栏，实现自定义任务栏（拖拽、关闭/最小化/最大化、文件/关于菜单）。
-   feat(destop): 新增 Tauri v2 后端配置（tauri.conf.json、capabilities）与应用图标。
-   feat(i18n): 初始化 @baize-next/i18n 共享子包
-   refactor(i18n): locale JSON 调整为嵌套结构：{ 表名: { 字段名: 文案 } }，取消平铺 key。
-   docs(i18n): 补充 BuffJsonData 字段的中文文案（包含字段说明映射。
-   docs(i18n): 补充 ItemJsonData 字段的中文文案（包含字段说明映射）。
-   docs(i18n): 补充 SkillJsonData 与 StaticSkillJsonData 字段的中文文案（包含字段说明映射）。
-   docs(i18n): 补充 NPCLeiXingDate 与 NPCWuDaoJson 字段的中文文案（包含字段说明映射）。
-   feat(types): 新增 ModConfig 类型与 i18n 文案，覆盖 mod 名称/作者/版本/介绍/设置及设置选项。
-   feat(types): 新增项目设置专用类型 ProjectSettings 与主题色枚举 ThemeColor（亮色/暗色/青黑色），并补充 i18n 文案。，新增 en/zh-CN 文案映射，英文暂用字段名作为展示文案，中文复制英文待补充。
-   docs: 在 AGENTS.md 与 .codex/rules.md 中补充 monorepo 架构规则，供子智能体识别仓库边界。
-   docs: 修正 monorepo 架构规则中代码标记格式（`apps/*`、`packages/*`）。
-   feat(destop): 打开项目目录（plugins/Next/_/mod_），解析项目结构并展示 mod 树。
-   feat(destop): 同一 mod 下 BuffJsonData、ItemJsonData、skillJsonData 按“1json1数据”合并为一组数据展示。
-   feat(destop): 左侧改造为项目结构树，展示 项目设置/buff/物品/功法/神通/NPC类型/NPC悟道。
-   feat(destop): 中间表格表头改用 @baize-next/i18n 字段映射，右侧面板暂为 TODO。
-   refactor(destop): 数据解析与类型定义迁移至独立子包 @baize-next/types。
-   feat(i18n): 新增 @baize-next/i18n 独立子包，提供字段表头 i18n 映射。
-   build: 根目录 package.json 新增 `tauri` 脚本，通过 `pnpm --filter @baize-next/destop tauri` 支持在仓库根目录执行 `pnpm tauri dev`。
-   style(destop): 重写中间表格滚动条为通用 ScrollArea 组件，隐藏系统默认滚动条。
-   style(destop): 表头保持单行，移除重复 key 列，使用记录 key 作为 ID 展示。
-   style(destop): 左侧栏不再展示分组路径目录说明。
-   style(destop): 全局禁用默认右键菜单。
-   style(destop): 提升自定义滚动条可见性（加大滑块尺寸、提高对比度）。
-   style(destop): 根容器禁用文本选择，仅表单元素（input/textarea/contenteditable）允许选中。






