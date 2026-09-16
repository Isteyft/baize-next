# Changelog

项目变更日志。每次修改仓库文件时都必须在此添加记录。

## [2026-09-16]

-   feat(destop): 预加载多个 Meta 来源时按文件名合并同名数据集，同名记录由后加载的数据覆盖。
-   feat(destop): 项目目录右键菜单新增“保存该项目”，顶部文件菜单改为“保存全部项目”，支持一次保存所有已打开项目。
-   fix(destop): 左侧项目树改用原生捕获事件并按最近节点区分项目与 Mod 菜单，预加载及已打开项目目录均可打开项目菜单，Mod 均可右键删除；菜单挂载到页面根节点避免裁剪，项目 Mod 删除后保存时同步清理对应 JSON 文件。
-   feat(destop): 左侧预加载与项目数据改为完整项目树，支持同时打开多个项目并分别展示各项目内的 Mod；项目节点菜单新增关闭项目，关闭后卸载项目数据、资源索引和待保存状态。
-   test(destop): 补充项目切换、项目菜单关闭以及项目数据卸载辅助逻辑用例。
-   fix(destop): 移除表格工具栏删除按钮，恢复境界文本展示，并将数字输入改为无步进器文本输入、描述字段改为多行文本域。
-   feat(destop): 数据表格移除标题文字，新增按 ID 创建数据条目的弹窗和增加按钮。
-   feat(destop): 数据表格支持右键删除、Ctrl 切换多选、Shift 连续多选及批量删除确认。
-   feat(destop): NPC 类型与 NPC 悟道表格按 LevelType 元数据显示境界文本。
-   fix(destop): 项目保存时同步删除已移除的目录型记录 JSON 文件，并收紧项目文件路径校验。
-   test(destop): 补充表格新增、多选、右键删除、境界文本展示与删除路径解析用例。
-   docs: 修复 CHANGELOG 历史乱码并补齐当前数据编辑变更记录。
-   feat(destop): 编辑器中的 mod 图标预览保留为 64x64 固定显示区。
-   feat(destop): NPC 的 skills 按神通 Skill_ID 去重后在表格弹窗中选择，staticSkills 保持多选，yuanying 为单选功法。
-   fix(destop): 修正 NPC 灵根被误当作灵气枚举，并补充种族 1 人/2 妖/3 魔/4 鬼枚举。
-   fix(destop): 神通 Skill_Type 恢复为普通数值，AttackType 改为属性表格弹窗多选。
-   fix(destop): NPC canjiaPaiMai 与物品 CanSale/NPCCanUse 改为复选框，NPC AttackType/DefenseType 恢复为自由数值输入。
-   fix(destop): 按 Assets/buff icon、item icon、skill icon、staticskill icon 子目录及 icon=0 规则修正图标路径。
-   fix(destop): 修复数据表格隐藏图标列时表头与数据单元格错位的问题。
-   feat(destop): Seid 增加改为可搜索的表格弹窗，并支持已添加 Seid 上移、下移调整数组顺序。

-   feat(destop): 新增 Seid 编辑弹窗，支持按 Buff/Skill/StaticSkill/Item 类型增删 Seid 并填写参数。
-   feat(destop): 解析并保存 BuffSeidJsonData、SkillSeidJsonData、StaticSkillSeidJsonData、ItemsSeidJsonData、EquipSeidJsonData。
-   feat(destop): Seid 属性的 SpecialDrawer 接入 Buff/Skill/StaticSkill/Item/ElementType 等选项源，数组型选项支持多选。
-   fix(destop): 修正 mod\_ 前缀在项目保存路径中重复拼接的问题。
-   test(destop): 补充 Seid Meta、Drawer、数据加载保存、弹窗增删与多选用例。
-   fix(destop): 修正 item 的 TuJianType/typePinJie、skill 与 shenTong 的 typePinJie/Skill_LV/qingjiaotype 枚举数据源映射。
-   feat(destop): NPCCanUse 与 canjiaPaiMai 改为本地是否枚举下拉，并明确 0/1 的业务含义。
-   fix(destop): 功法与神通图标统一按 Skill_ID 命名加载，表格与编辑器均展示实际图片而非路径。
-   test(destop): 补充上述字段映射、是否枚举及 Skill_ID 图标规则用例。
-   feat(destop): skill 分组的 script 字段改为 SkillAttackScriptType 字符串枚举下拉。
-   feat(destop): 新增 getMetaStringOptions，支持 Id/ID 为字符串的 Meta 枚举解析。
-   feat(destop): 新增 GROUP_ICON_FIELDS 与 resolveModIconPath，按 modxxx/Assets 规则解析图标路径：填写值为 0 时取编号.png，否则取图标值.png。
-   feat(destop): buff/item/skill/staticskill 的图标字段统一移动到编号字段下方，并在编辑器内展示图标预览。
-   feat(destop): Tauri 新增 read_mod_asset 命令，读取 mod 资源图片并编码为 data URL 供前端展示。
-   feat(types): ProjectMod 新增 directory 字段，记录 mod 文件夹相对项目根目录的路径。
-   feat(destop): skill 分组的老词缀字段默认隐藏，编辑器与表格均不再展示。
-   fix(destop): 补齐 DataTable 的 metaDatasets 传递与 DataRow 属性，修复表格无法编译的问题。
-   test(destop): 补充字符串枚举解析、图标路径解析、script 下拉、老词缀隐藏、图标位置与预览用例。
-   feat(destop): buff 的 bufftype/BuffType/trigger/removeTrigger、skill 与 shenTong 的 AttackType 等字段改为 Meta 枚举下拉选择。
-   feat(destop): 新增 getMetaEnumOptions 通用 Meta 枚举解析，兼容 Id/ID/TypeID/TypeNum 与 Desc/TypeName 两套字段命名。
-   feat(destop): 数组型枚举字段按项下拉，重复选择同一选项即从数组中移除该值。
-   feat(i18n): isHide/ShowOnlyOne 文案统一为“0否，1是”。
-   test(destop): 补充 Meta 枚举解析与编辑器枚举下拉、数组枚举增删测试。
-   feat(destop): 数据表格改为按分组自适应列，仅保留 id、名称与介绍等关键字段，减少列数臃肿。
-   feat(destop): 数据表格右上角新增搜索框，支持按 id、名称与介绍关键词过滤，并在无匹配时给出空态提示。
-   feat(destop): 搜索输入使用延迟值与预缓存搜索索引，避免大数据量下输入卡顿。
-   test(destop): 补充表格列筛选与关键词搜索、空态提示、搜索清空回复的 Vitest 用例。

-   perf(destop): 数据表格改为固定行高虚拟滚动，仅渲染可视行与缓冲行，缓解上千行数据切换分组时的卡顿。
-   perf(destop): 表格字段收集与排序改为 useMemo 缓存并预计算排序键，选中行改用 memo 行组件，减少重复渲染。
-   feat(destop): ScrollArea 支持外部传入 viewportRef，便于调用方读取滚动位置。
-   test(destop): 补充可视范围计算、长表格虚拟渲染与滚动窗口移动测试。
-   chore: 补充 overscan 自定义拼写词条。
-   feat(destop): 数据表格按 id/主键的数字升序排序，避免字符串排序导致 1/10/100/1000 相邻错序。
-   test(destop): 补充数据表格数字排序测试。

-   feat(types): buff 的 isHide/ShowOnlyOne 与 skill/shenTong 的 DF 类型改为 0|1 枚举。
-   feat(destop): 上述 0|1 字段改为勾选式复选框，勾选为是/1，未勾选为否/0。
-   test(destop): 补充 0|1 复选框控件测试。

-   feat(destop): buff/skill/shenTong/item 的 Affix/Affix2 字段改为词缀数据弹窗多选，确认后回填词缀 id 列表。
-   test(destop): 补充词缀弹窗选择与 id 回填测试。

-   feat(types): TuJianChunWenBenItem 的 name1/typenum/type 引用 AffixProjectTypeItem/AffixTypeItem 字段类型。
-   feat(destop): Meta 预加载的 AffixProjectType/AffixType 作为词缀数据枚举，用于编辑器下拉选择。
-   test(destop): 补充词缀 meta 枚举选项与 JsonEditor 联动测试。

-   feat(destop): JSON 编辑器中的数组字段改为紧凑表格，支持逐项编辑、添加与删除数组项。
-   test(destop): 补充 JsonEditor 数组项增删改测试。

-   fix(destop): Meta 预加载不再作为预加载数据显示，改为展示 mod 预加载。
-   fix(destop): mod 预加载 JSON 分组标签改为“mod 预加载”。
-   test(destop): 补充 mod 预加载展示与解析测试。
-   test(destop): add Vitest tests for json/preload/theme/language utilities and DataTable/JsonEditor components.

## [2026-09-15]

-   feat(destop): item 分组的 type/quality/typePinJie/ShopType 字段接入 Data/Meta 的 ItemType/ItemQualityType/ItemPhaseType/ItemShopType 枚举下拉。
-   feat(destop): 新增 getMetaEnumLabel，数据表格中上述枚举字段按“描述(数值)”展示，未匹配到描述时回退为原值。
-   refactor(destop): getMetaEnumOptions 改为复用 getMetaEnumRawOptions，统一数值型 Meta 枚举的解析入口。
-   feat(i18n): item 的 quality/type/typePinJie 文案改为物品品阶、物品类型与物品品阶阶段。
-   test(destop): 补充 Meta 枚举描述查询与 item 枚举下拉的 Vitest 用例。

-   style(destop): 移除 JSON 编辑器顶部的记录 key/id 与字段数量信息。
-   feat(types): 新增 Data/TuJianChunWenBen.json 对应的词缀类型并导出 TuJianChunWenBen。
-   feat(destop): 项目读取新增 Data/TuJianChunWenBen.json 词缀分组，支持展示、编辑与回写。
-   feat(i18n): 补充词缀字段中文文案，并暂时隐藏表格中的 name1 填写字段。
-   test(destop): 补充 Vitest、词缀弹窗、0/1 复选框、数字排序与虚拟滚动回归用例。

-   feat(destop): 新增保存项目功能，文件菜单可写回 mod JSON 并显示未保存标记与结果提示。
-   feat(destop): Tauri 新增 write_project_file 命令，按相对路径写回文件并自动创建父目录。
-   feat(destop): 项目编辑后标记未保存状态，保存菜单项显示星号标记，保存成功显示已保存提示。
-   feat(destop): Meta 预加载与 mod 预加载拆分为两类独立配置，设置窗口各维护一份列表。
-   feat(destop): 左侧栏拆分为“预加载数据”和“项目数据”，支持整区、单个 mod 折叠。
-   feat(destop): 新建 mod 自动填充默认空分组，右键 mod 支持重命名与删除。
-   fix(destop): JSON 解析兼容 BOM 与尾逗号，修复 Meta 目录预加载失败。
-   fix(destop): 中间表格按分组类型显示主键列，无主键字段的数据不再生成伪 ID。
-   style(destop): Tip 提示改为页面顶部居中显示。
-   feat(destop): 新增可复用的 Tip 组件，设置窗口保存后显示“已保存”提示。
-   feat(destop): Meta 预加载改为多条目列表，支持加号添加 JSON 或目录并选择路径。
-   style(destop): 设置窗口保存按钮固定到右下角。
-   fix(destop): error-log 窗口加入 Tauri capabilities，修复拖拽、最小化、最大化与关闭按钮。
-   fix(destop): 启动预加载失败也会写入 error.log。
-   feat(destop): 错误提示移至主界面底部，不阻断主界面操作。
-   feat(destop): 关于菜单新增错误日志窗口，与设置窗口统一为独立新窗口。
-   feat(destop): 新增 error.log 本地读写命令，每次启动重写，当次运行错误勾存至本地文件。
-   fix(destop): 预加载失败时不再阻断进入主界面，改为顶部非阻断提示。
-   feat(destop): 新增启动预加载界面，默认加载 ./Editor 下的 mod JSON，支持 JSON 文件或目录模式。
-   feat(destop): 设置中新增 JSON 预加载来源，可选择加载 JSON 或加载目录并持久化路径。
-   feat(types): 新增 PreloadSourceMode 枚举与 ProjectSettings 预加载字段，ProjectModGroupKey 增加 preload 分组。
-   feat(destop): Tauri 后端新增 read_json_file 命令，支持单个 JSON 文件预加载。

-   chore: Data/ 目录加入 .gitignore 并从 git 索引移除，磁盘数据保留本地。
-   feat(types): 新增 Data/Meta 元数据 JSON 对应的 TypeScript 类型，导出为 packages/types/src/data/meta。

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

-   style(destop): 移除 JSON 编辑器顶部的记录 key/id 与字段数量信息。
-   feat(types): 新增 Data/TuJianChunWenBen.json 对应的词缀类型并导出 TuJianChunWenBen。
-   feat(destop): 项目读取新增 Data/TuJianChunWenBen.json 词缀分组，支持展示、编辑与回写。
-   feat(i18n): 补充词缀字段中文文案，并暂时隐藏表格中的 name1 填写字段。
-   test(destop): 补充 Vitest、词缀弹窗、0/1 复选框、数字排序与虚拟滚动回归用例。

-   feat(destop): 新增保存项目功能，文件菜单可写回 mod JSON 并显示未保存标记与结果提示。
-   feat(destop): Tauri 新增 write_project_file 命令，按相对路径写回文件并自动创建父目录。
-   feat(destop): 项目编辑后标记未保存状态，保存菜单项显示星号标记，保存成功显示已保存提示。
-   feat(destop): Meta 预加载与 mod 预加载拆分为两类独立配置，设置窗口各维护一份列表。
-   feat(destop): 左侧栏拆分为“预加载数据”和“项目数据”，支持整区、单个 mod 折叠。
-   feat(destop): 新建 mod 自动填充默认空分组，右键 mod 支持重命名与删除。
-   fix(destop): JSON 解析兼容 BOM 与尾逗号，修复 Meta 目录预加载失败。
-   fix(destop): 中间表格按分组类型显示主键列，无主键字段的数据不再生成伪 ID。
-   style(destop): Tip 提示改为页面顶部居中显示。
-   feat(destop): 新增可复用的 Tip 组件，设置窗口保存后显示“已保存”提示。
-   feat(destop): Meta 预加载改为多条目列表，支持加号添加 JSON 或目录并选择路径。
-   style(destop): 设置窗口保存按钮固定到右下角。
-   fix(destop): error-log 窗口加入 Tauri capabilities，修复拖拽、最小化、最大化与关闭按钮。
-   fix(destop): 启动预加载失败也会写入 error.log。
-   feat(destop): 错误提示移至主界面底部，不阻断主界面操作。
-   feat(destop): 关于菜单新增错误日志窗口，与设置窗口统一为独立新窗口。
-   feat(destop): 新增 error.log 本地读写命令，每次启动重写，当次运行错误勾存至本地文件。
-   fix(destop): 预加载失败时不再阻断进入主界面，改为顶部非阻断提示。
-   feat(destop): 新增启动预加载界面，默认加载 ./Editor 下的 mod JSON，支持 JSON 文件或目录模式。
-   feat(destop): 设置中新增 JSON 预加载来源，可选择加载 JSON 或加载目录并持久化路径。
-   feat(types): 新增 PreloadSourceMode 枚举与 ProjectSettings 预加载字段，ProjectModGroupKey 增加 preload 分组。
-   feat(destop): Tauri 后端新增 read_json_file 命令，支持单个 JSON 文件预加载。

-   chore: Data/ 目录加入 .gitignore 并从 git 索引移除，磁盘数据保留本地。
-   feat(types): 新增 Data/Meta 元数据 JSON 对应的 TypeScript 类型，导出为 packages/types/src/data/meta。

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

-   perf(destop): 滚动条改用 requestAnimationFrame 直接刷新滑块位移，移除 transform 过渡，滚动更丝滑。

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
-   feat(types): 新增项目设置专用类型 ProjectSettings 与主题色枚举 ThemeColor（亮色/暗色/青黑色），并补充 i18n 文案，新增 en/zh-CN 文案映射，英文暂用字段名作为展示文案，中文复制英文待补充。
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

## [2026-09-13]

-   feat(types): 解析 Data/NPCLeiXingDate.json 并生成 TypeScript 类型，存入 packages/types 共享类型包。
-   feat(types): 解析 Data/NPCWuDaoJson.json 并生成 TypeScript 类型，存入 packages/types 共享类型包。
-   feat(types): 解析 Data 下 BuffJsonData/ItemJsonData/skillJsonData/StaticSkillJsonData.json，分别生成对应 TypeScript 类型并存入 packages/types 共享类型包。
-   fix(types): SkillJsonData/ItemJsonData 中 Affix、wuDao、skill_SameCastNum 修正为 number[]。
-   refactor(types): 将数据类型目录由 generated 更名为 data，并新增 enums 枚举类型专用目录。
-   docs: 新增 AGENTS.md，记录项目结构、工程规则与修改日志规则。
-   docs: 新增项目级规则文件 `.codex/rules.md`（仅作用于本仓库）。
-   chore: 基础项目名称由 baize 改为 baize-next，并同步更新 README、AGENTS.md 与 .codex/rules.md。
-   chore: 子包作用域名由 `@baize/*` 统一改为 `@baize-next/*`，并同步更新 AGENTS.md 与 .codex/rules.md。
