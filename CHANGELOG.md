# Changelog

项目变更日志。每次修改仓库文件时都必须在此添加记录。

-   fix(destop): 写功法递归生成配套 buff 时 buff 的 seid 不生成。根因：buildCommandContext 只注入主分组（功法 staticSkill）的 StaticSkillSeidMeta，未注入依赖 buff 分组的 BuffSeidMeta，AI 不知道 buff 有哪些 seid 可写。修复：① AiCommand 新增 extraSeidMetaDatasets（键为 dataKey），功法指令声明 buff/itemUse/itemEquip 三组额外 SeidMeta；② buildCommandContext 注入额外 SeidMeta 时按 dataKey 分组展示，并在每个 Seid 定义与提示里标注对应 dataKey；③ formatSeidDefinition 增加 dataKey 标注参数。补充 2 个用例，aiCommands 14 用例通过，tsc/lint 通过。
-   fix(destop): AI search_record 查询范围扩大到全部预加载 + 全部已加载项目。根因：referenceProjects 用 `[...preloadProjects, ...(project ? [project] : [])]`，已加载项目只取当前激活的单个 `project`，导致加载多个项目时其它项目记录查不到。修复：改为 `[...preloadProjects, ...projects]` 纳入全部已加载项目，并移除不再使用的 `project` 变量、在 handleCloseProject 处重建激活项目回退逻辑。tsc/lint 通过，aiAgent 13 用例通过。
-   feat(destop): AI 生成结果新增「引用」功能，保持跨轮上下文连续。① aiGeneration 新增 serializeGeneratedResult，把生成结果（分组/key/data/seidData）序列化为引用文本；② ChatPanel 新增 referencedId 状态与「引用/已引用」按钮，被引用消息卡片加 accent 高亮边框；③ handleSend 时若存在被引用消息，将其生成结果作为 system 消息注入，使后续追问能在上次生成基础上修改而非重新臆造。补充序列化 3 个用例，aiGeneration 16 用例通过，tsc/lint 通过。
-   feat(destop): AI 指令新增专属自定义提示词位。① AiCommand 接口新增 `customPrompt?: string` 字段（留空待扩展）；② 六个内置指令（写 buff / 写功法 / 写神通 / 写物品 / 写悟道 / 写 NPC 类型）均补 `customPrompt: ''` 占位；③ buildCommandContext 开头注入非空 customPrompt 作为「## 自定义提示」段落，方便按指令独立扩展提示词。aiCommands 10 用例通过，tsc 通过。
-   fix(destop): AI 对话体验三项修复。① 思考态改为「思考中…x 秒」实时计时：新增 thinkingStartedAt 状态在发送/重试时记录起点，streaming 期间每秒 tick 刷新秒数，结束后清零；② 「应用到 mod」按钮持久化：会话消息新增 generated 字段，persistCurrentSession 落盘时保留，normalizeChatSession 校验并恢复，重新进入会话后按钮不再消失；③ ask_user 弹窗允许留空确认：去掉确定按钮的必填禁用，留空提交时回传「用户未填写，请自行决定」给 AI，并增加留空提示文案。补充 generated 持久化 2 个用例，全仓 244 用例通过，tsc/lint 通过。
-   feat(destop): AI 对话改为真正的流式输出，边生成边显示（含思考过程）。根因：Rust `chat_completion` 固定 `stream:false` 一次性返回，前端 `chatCompletionStream` 拿到完整文本后一次性 onDelta，整个等待期只显示「思考中…」，用户无法判断是否卡住。修复：① Rust 新增 `chat_completion_stream` 命令，`stream:true` 走 SSE，逐行解析 `data:` 块，提取 `delta.content` 与思考内容 `delta.reasoning_content`/`delta.reasoning`，通过 `tauri::ipc::Channel` 实时推给前端（reqwest 加 stream feature、futures-util 依赖）；② 前端 `chatCompletionStream` 改用 `Channel` 接收增量并逐块 onDelta。cargo check/tsc/lint 通过，278 用例通过。
-   fix(destop): 预加载大量 JSON 时主线程同步解析导致窗口「未响应」。根因：`parseProjectFromEntries`/`parseMetaEntriesFromEntries` 在 UI 主线程同步 `JSON.parse` 每个文件，数据量大时长时间阻塞渲染。修复：新增 `yieldToMainThread`（requestAnimationFrame 优先、setTimeout 兜底），两个解析函数改为每处理 500 条记录/文件就让出一次主线程，让加载动画持续渲染、系统不判定未响应；`parseMetaEntriesFromEntries` 由同步改为 async，App.tsx 调用点加 await。tsc/lint 通过，278 用例通过。
-   fix(destop): 侧边栏大模型配置不随设置更新而实时刷新。根因：ChatPanel 用 `useState(getSavedAiModels)` 只初始化一次，设置窗口保存后侧边栏模型列表仍停留在旧值。修复：① aiModels 新增 `subscribeAiModels`（仿 theme/language 的 Tauri event 广播 + localStorage storage 事件兜底）并在 `saveAiModels` 后广播变更；② ChatPanel 改用可订阅 state，订阅回调里 `setModels`，并新增「选中模型被删除后回退到第一个可用模型」的兜底 effect，避免发送按钮永久禁用。补充订阅机制 2 个用例，全仓 278 用例通过，tsc/lint 通过。
-   feat(destop): Seid 编辑器多选属性（SeidMultiSelect）新增可编辑输入框，直接展示当前已选值并支持手输（逗号分隔，回车/失焦回写，按原值类型解析为数字或字符串），同时保留原下拉勾选交互。补充直接输入用例，SeidEditor 5 用例通过，tsc/lint 通过。
-   fix(destop): 修复 AI 生成功法字段名臆造、功法名空、seid 数据空的问题。根因：buildCommandContext 只注入字段枚举与 Seid 定义，未注入分组基础字段 schema，AI 只能猜字段名（把 name 写成 skillName）；且 write_seid 的 seidId/dataKey 语义模糊，模型生成 `seidId:"\1"` 反斜杠占位、dataKey 填错（功法 seid 应写 staticSkill 却写 skill）。修复：① aiCommands 新增 buildFieldSchemaSection，把 DEFAULT_RECORD_TEMPLATES 的字段名+类型+中文名（translateField）注入上下文，明确主键字段；② defaultRecordTemplates 导出 getDefaultRecordTemplate；③ formatSeidDefinition 改为 `Seid id=N` 醒目格式并注明 seidId 填 N；④ buildCommandContext 注入精确 dataKey 提示（用 getSeidDataKey 计算，功法→staticSkill）；⑤ create_record/write_seid 工具 schema 描述强化（key 主键字段统一为 id、seidId 必须是 Seid 数字 id、dataKey 映射说明）。测试 aiCommands 10 用例通过，全仓 239 用例通过，tsc/lint 通过。
-   fix(destop): 修复 Kimi 接口「the message at position N with role 'assistant' must not be empty」400 报错。根因：agent 循环第一轮模型返回 tool_calls 时 content 通常为 null，Rust 端 `message["content"].as_str().unwrap_or_default()` 把 null 归一成空串 ""，前端回传该 assistant 消息时 content 为空串（而非 null），Kimi coding 接口不接受空串 assistant 消息。修复：Rust message_to_json 将 content 为空串的消息统一序列化为 null（协议中空文本应用 null 表示）。cargo check 通过。
-   fix(destop): 修复工具调用「Cannot read properties of undefined (reading 'trim')」崩溃。根因：前端 ToolCall 类型为扁平结构 `{id,name,arguments}`，而 Rust 后端返回/接收的是 OpenAI 原生嵌套结构 `{id,type,function:{name,arguments}}`，导致 `call.arguments`/`call.name` 为 undefined，parseToolArguments 里 `.trim()` 崩溃且所有工具名判断失效。修复：① 前端 ToolCall 接口改为嵌套结构，与 Rust 完全对齐；② aiAgent runToolCalls 改读 `call.function.name`/`call.function.arguments`；③ ChatPanel 工具消息判断改 `call.function?.name`；④ aiAgent.test.ts 测试用例改用嵌套结构构造。测试 aiTools 25 + aiAgent 13 + ai 4 共 42 用例通过，cargo check/tsc/lint 通过。
-   fix(destop): 修复 Kimi K2 Thinking 等思考型模型工具调用「工具参数不是合法 JSON」的问题。根因：模型返回的 tool_call arguments 可能是空串/字面量 null、被 Markdown 代码块包裹、或 JSON 前后带思考文本，前端 parseToolArguments 仅做整段 JSON.parse 导致解析失败。修复：① parseToolArguments 多级容错（空串/null 兜底空对象、剥离 ```json 代码块、按首尾花括号截取 JSON 子串）；② Rust 端 message_to_json 在带 tool_calls 的 assistant 消息 content 为空时序列化为 null（部分模型严格要求）；③ Rust 端 arguments 为空白时兜底为 {}。补充 4 个容错单元测试。
-   feat(destop): AI 生成新增 search_record 工具，支持查询已有数据并复用。① aiTools 新增 search_record 工具定义（按分组 + 关键词查询）与 parseSearchRecordArgs；② aiAgent 新增 searchExistingRecords 纯函数（按主键/名称/描述模糊过滤，返回 id+名称摘要）与 ExistingRecordIndex 类型，createDefaultToolExecutor 接收记录索引并接入 searchRecord 执行器；③ ChatPanel 新增 existingRecords prop，App.tsx 用 referenceProjects 汇总 buff/item/skill/shenTong/wuDao/npcType 分组记录传入；④ 指令上下文引导 AI「引用已有内容前先 search_record 查询，查到直接复用其 id，查不到才新建」，避免重复造轮子与 id 冲突。
-   fix(destop): 侧边 AI 对话面板的消息内容支持选中复制。根因：App 根节点 `select-none` 全局禁用文本选择，仅 input/textarea/contenteditable 例外，导致消息气泡文本无法选中。修复：给用户/助手消息气泡容器加 `select-text` 类，恢复消息文本的选择与复制，其余界面仍保持 select-none。
-   feat(destop): AI 生成改为工具（function calling）+ agent 多轮循环，支持自主补依赖与主动问 id。① Rust 后端 chat_completion 新增 tools 参数与 tool_calls 解析（含 tool 角色的 tool_call_id 回传）；② 新增 aiTools 模块：GLOBAL_SYSTEM_PROMPT 全局提示词常量（默认为空、可扩展）、工具定义（create_record / write_seid / ask_user）与参数解析、累积器；③ 新增 aiAgent 模块：runToolCalls 工具执行编排（纯函数）；④ ai.ts 新增 chatCompletionWithTools；⑤ ChatPanel 指令模式走 agent 循环（最多 12 轮），ask_user 工具触发弹窗表单收集答案后继续循环，生成结果累积后仍走「应用到 mod」预览确认；⑥ 指令上下文输出协议由「直接输出 JSON」改为「通过工具生成」。
-   feat(destop): AI 生成结果支持应用到 mod。① 新增 aiGeneration 模块：extractJsonObject 容错提取 AI 回复中的 JSON，parseGeneratedResult 解析 records + seidData 多记录结构，applyGeneratedResultToProject 纯函数批量写回（规范化记录 + 插入/覆盖分组 + 写 Seid 参数并补 data.seid 数组）；② 指令输出协议升级为多记录结构，支持级联生成（功法→依赖 buff→buff 的 seid 递归）；③ ChatPanel 指令模式下解析回复，助手气泡显示「应用到 mod」按钮，点击弹预览确认，确认后经 onApplyGenerated 写回当前选中 mod（无 mod 时记错误日志）；④ App.tsx 新增 handleApplyGenerated。
-   feat(destop): 指令选择新增可视化入口——输入框下方左侧显示「选择指令」按钮（未选时）或指令 chip 标签（选中时，可点击 × 移除），点击按钮同样弹出指令列表；指令不再写入输入框文本，而是作为独立的 activeCommand 状态以 chip 展示，发送时作为 system 上下文注入并在发送后清除。
-   feat(destop): 聊天面板新增 slash 指令系统，输入 `/` 弹出指令选择（写 buff / 写功法 / 写神通 / 写物品 / 写悟道 / 写 NPC 类型），选中后自动将该分组的字段枚举与 SeidMeta 定义作为 system 上下文注入大模型请求，生成完整记录（含 seid 字段）。
-   feat(destop): 新增 aiCommands 模块，定义指令列表、指令过滤与上下文构建（buildCommandContext），按分组读取字段枚举 meta 并注入对应 SeidMeta 定义。
-   test(destop): 补充指令过滤、字段枚举上下文与 SeidMeta 注入的 Vitest 用例。
-   feat(destop): AI 对话由独立窗口改为内嵌主窗口右侧的聊天面板，点击「AI → 对话界面」展开面板并同步加宽主窗口，面板顶部提供会话列表（弹出层）与新会话，模型选择移至发送按钮左侧。
-   refactor(destop): 将 ChatWindow 改造为 ChatPanel 内嵌组件，侧边栏重写为「会话列表下拉 + 新会话按钮」形态，移除独立 chat 窗口入口与 ChatWindow 组件。
-   feat(destop): 主界面各栏（左侧栏 / 数据表 / JSON 编辑 / 聊天面板）之间新增可拖拽分隔条，支持手动调整各栏宽度；LeftPanel/JsonEditor/ChatPanel 宽度改为受控 state，窗口加宽量随聊天面板宽度自适应。
-   feat(destop): 聊天面板输入区重排：输入框占满底部整行并调高，模型选择与发送/停止按钮缩小移至右下角；Select 组件新增 compact（紧凑尺寸）与 direction（弹窗向上/向下）属性，模型下拉改为向上弹出。

-   feat(destop): AI 对话窗口标题栏移入右侧对话列，侧边栏独立占满整个窗口高度，不再横跨侧边栏上方。

-   feat(destop): 设置界面改为 TAB 分页布局，分为「软件（语言/主题）」「Mod（Meta/mod 预加载）」「AI（大模型配置/会话保存位置）」三个标签页。
-   fix(destop): AI 对话窗口订阅主题变更事件，跨窗口切换主题色时实时生效。
-   feat(destop): AI 对话窗口布局调整，侧边栏占满窗口高度，右侧为消息区与输入框。

-   feat(destop): AI 对话界面新增可折叠侧边栏会话管理，支持新建/切换/删除/重命名/搜索会话，每轮对话自动持久化。
-   feat(destop): 新增会话保存位置设置，可在设置页选择目录或恢复默认（软件目录下的 .bz-chat）。
-   feat(destop): 后端新增 get_default_chat_dir / read_chat_sessions / write_chat_session / delete_chat_session 命令，会话以 JSON 文件存于指定目录。
-   feat(destop): 新增会话数据模型与设置持久化模块（chatSession、chatSettings），存储键 baize-next.chat-settings 纳入设置白名单。
-   test(destop): 补充会话序列化/校验/标题推导、读写封装与保存位置设置的 Vitest 用例。

-   feat(destop): 顶部菜单栏在「文件」与「关于」之间新增「AI」按钮，提供「对话界面」菜单项，打开独立 AI 对话窗口。
-   fix(destop): AI 对话请求失败时同步写入错误日志，来源标识带模型名；Rust 转发增加 Base URL 合法性校验，缺少协议时返回可操作的错误提示而非笼统的 builder error。
-   feat(destop): 新增模型 Base URL 规范化，保存时自动补 https:// 前缀并去尾斜杠，避免 reqwest 因缺少协议抛 builder error。
-   feat(destop): 新增大模型调用模块，通过 Rust 后端 `chat_completion` 命令转发 OpenAI 兼容 /chat/completions 请求，绕开浏览器 CORS 限制。
-   feat(destop): 后端新增 reqwest（rustls）依赖与 `chat_completion` 命令，负责 baseURL 规范化、鉴权头与请求转发。
-   feat(destop): 设置页新增「大模型配置」区块，支持新增/编辑/删除多个模型（名称、Base URL、API Key、模型），编辑采用弹窗形式。
-   feat(destop): 新增大模型配置持久化模块，存储键 baize-next.ai-models 纳入设置白名单。
-   test(destop): 补充大模型调用参数透传、空消息过滤、错误抛出与流式回调交付的 Vitest 用例。

-   fix(destop): 新增数据时按主键数字序插入到正确位置，保持 records 数组有序，修复新增 ID 排序位置错误的问题。
-   test(destop): 补充 insertRecordSorted 排序插入的 Vitest 用例，覆盖数字/字符串 id、key 兜底与非数值记录。

-   fix(destop): 保存项目时跳过无数据分组，项目本身不存在的表（如悟道）不再凭空生成空 JSON 文件。
-   test(destop): 补充空分组序列化用例，校验空悟道/物品分组不产出文件。

-   fix(destop): 保存项目时 config 分组不再额外包裹 root 层，顶层直接输出 Name/Author/Version/Description/Settings 等字段。
-   test(destop): 补充 config 分组序列化断言，校验 modConfig.json 顶层无 root 包裹。

-   fix(destop): 右键生成技能书时将物品说明(desc)改为 skill_id 的字符串，物品描述(desc2)保留原始描述。
-   test(destop): 更新技能书生成用例，校验 desc 为 skill_id、desc2保留源描述。
-   fix(destop): JSON 表格右键菜单改用通用 ContextMenu 组件，动态计算边界并向上翻转，避免底部显示不全。
-   test(destop): 补充右键菜单边界翻转、安全间距与超高列表滚动上限的 Vitest 用例。
-   fix(destop): 调整右键菜单向上翻转时与光标底部对齐，用户贴近屏幕底缘时仍保留 8px 安全距离。
-   fix(destop): 右键底部行时不再预先钳制坐标，交由通用 ContextMenu 自动判断方向与边界安全距离，避免菜单出现在倒数第二行。
-   feat(core): 封装“生成请教书籍”的校验与克隆逻辑，新增严格类型 ModItemData，并开放审核/冲突结果供 UI 使用。
-   feat(destop): 神通书/功法书物品右键新增“生成请教书籍”，完成 ID 上限、物品种类、目标 ID 冲突三项前置校验后弹窗确认并直接写入列表。
-   test(destop): 补充请教书籍 ID 越界拦截、类型错误拦截、ID 冲突拦截及数据覆盖规则的 Vitest 用例。

-   feat(destop): 数据表格右键菜单新增“批量修改 ID”，对 Shift/Ctrl 多选记录批量替换主键 ID，并预校验所有目标 ID。
-   feat(destop): 批量修改 ID 输入首个 ID 后按连续编号生成序列，遇到已有 ID 占用时取消全部修改并弹窗提示。
-   test(destop): 补充批量 ID 无冲突生成与冲突拦截不改动的 Vitest 用例。
-   fix(destop): 项目 JSON 加载失败时精准定位到具体出错文件，错误信息包含相对路径文件名、所属项目与行列号详情，并按项目聚合汇总避免逐文件多次弹窗。
-   test(destop): 补充 Vitest 用例，模拟含多个文件的项目目录，验证第 2 个损坏文件能被报错信息准确指向文件名，并覆盖多文件错误的汇总场景。
-   feat(destop): 主界面报错提示恢复为单行简洁文案，完整错误详情改由 ErrorDetailModal 加载失败弹窗展示。
-   feat(destop): 新增 ErrorDetailModal 组件，内容区限高并以纵向滚动呈现完整报错上下文，超长文本不再撑爆弹窗。
-   test(destop): 补充 ErrorDetailModal 打开/关闭与滚动区域限高的 Vitest 用例。
-   style(destop): 错误日志弹窗标题栏右侧控制区改为填满标题栏整高，修复最小化/最大化/关闭按钮在 hover 时高亮高度异常的问题。

## [2026-09-17]

-   docs(destop): 记录 settings.json 和 error.log 在应用数据目录中的实际位置。
-   fix(destop): 将设置和错误日志迁移到 Tauri appDataDir，并自动迁移旧 localStorage 设置。
-   docs(destop): 补充正式 Tauri 打包命令，避免误用直接 Cargo 构建的开发版产物。
-   fix(destop): 正式打包使用 Tauri CLI，并禁用窗口 DevTools，避免产物加载 localhost 或打开检查器。
-   fix(destop): Windows 构建始终使用 GUI 子系统，避免打包后额外弹出控制台。
-   feat(destop): 配置 Tauri 应用图标，补充 Windows ICO、macOS ICNS 与多尺寸 PNG 资源。
-   feat(destop): 所有新增记录和技能书按数据 schema 补全字段，编辑器完整展示必填字段，保存时统一字段类型。
-   fix(i18n): 修复字段表头入口，改为优先读取 zh-CN locale，并在缺失时回退英文或原始字段名。
-   feat(destop): 功法与神通右键菜单新增“生成技能书”，按 Skill_ID 生成对应物品和 ItemsSeidJsonData 参数，物品 ID 冲突时不覆盖。
-   feat(destop): 悟道神通、NPC 绑定技能和绑定功法增加逗号分隔的快速编辑输入框，并在字段提示中显示已选内容。
-   feat(destop): 元婴功法改为单选弹窗，显示当前选择内容。
-   feat(destop): 所有词缀字段增加逗号快速编辑输入框和已选内容悬浮提示。
-   feat(destop): NPC 类型表格右键菜单新增“批量生成”，按选中模板生成境界 1-15 的记录，遇 ID 冲突时停止并弹窗提示。
-   feat(destop): NPC 悟道表格右键菜单同步支持批量生成境界 1-15，按 lv 字段递增并复用 ID 冲突停止提示。

## [2026-09-16]

-   feat(types): 解析 Data/WuDaoAllTypeJson.json 与 Data/WuDaoJson.json 并生成共享 TypeScript 类型。
-   feat(destop): Mod 树新增“悟道类型”和“悟道”分组，支持加载、编辑、保存与表格展示。
-   feat(destop): 悟道表格用悟道类型数据展示 Type 中文名称，并在 JSON 编辑器中通过多选表格选择。
-   feat(destop): 悟道表格不显示图标，悟道特性复用功法的 StaticSkill Seid。
-   feat(destop): NPC 悟道的悟道神通改为从悟道数据中通过多选表格绑定。

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
