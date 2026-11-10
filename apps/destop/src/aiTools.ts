import type { JsonValue, ProjectModGroupKey } from '@baize-next/types'

import type { GeneratedRecord, GeneratedResult } from './aiGeneration'

/**
 * 全局系统提示词（预留位）。
 * 默认为空字符串；后续需要给 AI 增加通用约束（如输出风格、领域规则）时，直接在此处填写内容即可，
 * 会被注入到每次 AI 请求的 system 消息最前面。
 */
export const GLOBAL_SYSTEM_PROMPT = ''

/** 工具调用：模型发起的一次 function call。结构对齐 Rust 后端（OpenAI 原生嵌套形态）。 */
export interface ToolCall {
    id: string
    type: string
    function: {
        name: string
        arguments: string
    }
}

/** 工具执行结果，回传给模型（role: tool 消息）。 */
export interface ToolResult {
    callId: string
    /** 工具返回给模型的文本结果。 */
    content: string
}

/** ask_user 工具的参数：向用户收集关键信息。 */
export interface AskUserArgs {
    /** 问题标题（简短）。 */
    question: string
    /** 期望的回答类型，决定弹窗输入框形态。 */
    kind?: 'text' | 'number' | 'options'
    /** 当 kind 为 options 时的候选选项。 */
    options?: string[]
}

/** create_record 工具参数：写入一条记录。 */
export interface CreateRecordArgs {
    group: ProjectModGroupKey
    key: string
    data: Record<string, JsonValue>
}

/** search_record 工具参数：在已有记录中查询可复用的内容。 */
export interface SearchRecordArgs {
    /** 查询的分组，取值 buff/item/skill/shenTong/wuDao/npcType。 */
    group: ProjectModGroupKey
    /** 查询关键词（按名称/主键模糊匹配）；为空则返回该分组全部记录摘要。 */
    query: string
}

/** write_seid 工具参数：写入一条 Seid 参数。 */
export interface WriteSeidArgs {
    /** Seid 数据目录：buff/skill/staticSkill/itemUse/itemEquip。 */
    dataKey: string
    /** Seid 数字 id。 */
    seidId: string
    /** 目标记录 key（拥有该 seid 的记录）。 */
    targetKey: string
    /** Seid 参数对象。 */
    params: Record<string, JsonValue>
}

/** agent 循环中累积的生成结果（与最终应用到 mod 的结构一致）。 */
export interface AgentAccumulator {
    records: GeneratedRecord[]
    seidData: Record<string, Record<string, Record<string, Record<string, JsonValue>>>>
}

/** 创建一个空的累积器。 */
export function createAgentAccumulator(): AgentAccumulator {
    return { records: [], seidData: {} }
}

/** 工具调用累积器：把 create_record 结果累积进 records。 */
export function accumulateRecord(acc: AgentAccumulator, record: GeneratedRecord): AgentAccumulator {
    // 覆盖同 key 同分组的已有记录。
    const records = acc.records.filter(item => !(item.group === record.group && item.key === record.key))
    return { ...acc, records: [...records, record] }
}

/** 工具调用累积器：把 write_seid 结果累积进 seidData。 */
export function accumulateSeid(acc: AgentAccumulator, args: WriteSeidArgs): AgentAccumulator {
    const seidData = { ...acc.seidData }
    const files = { ...(seidData[args.dataKey] ?? {}) }
    const records = { ...(files[args.seidId] ?? {}) }
    records[args.targetKey] = args.params
    files[args.seidId] = records
    seidData[args.dataKey] = files
    return { ...acc, seidData }
}

/** 将累积器转换为可直接应用到 mod 的 GeneratedResult。 */
export function accumulatorToResult(acc: AgentAccumulator): GeneratedResult {
    return { records: acc.records, seidData: acc.seidData }
}

/** 判断累积器是否有可落库的内容。 */
export function hasAccumulatedContent(acc: AgentAccumulator): boolean {
    return acc.records.length > 0
}

/** 校验 group 是否为受支持的分组。 */
export function isSupportedGroup(value: unknown): value is ProjectModGroupKey {
    return (
        typeof value === 'string' &&
        [
            'buff',
            'item',
            'skill',
            'shenTong',
            'wuDao',
            'npcType',
            'npcWuDao',
            'wuDaoAllType',
            'tuJianChunWenBen',
            'config',
            'preload',
        ].includes(value)
    )
}

/**
 * 解析工具调用的 arguments（JSON 字符串）为对象；失败返回 null。
 *
 * 部分模型（如 Kimi K2 Thinking 等思考型模型）返回的 arguments 可能不规范：
 * - 空字符串 / 空白 / 字面量 "null"
 * - 被 Markdown 代码块（```json ... ```）包裹
 * - 混入思考过程文本，JSON 前后带多余说明
 * 这里做多级容错：先尝试整段解析，再剥离 Markdown 代码块，最后按首尾花括号截取 JSON 子串。
 * 全部失败时兜底为 null，由调用方反馈“工具参数不是合法 JSON”。
 */
export function parseToolArguments(argumentsText: string): Record<string, unknown> | null {
    const trimmed = argumentsText.trim()
    // 空串 / 字面量 null → 视为空参数对象，避免模型因“无需参数”而传空导致的误报。
    if (trimmed === '' || trimmed === 'null') return {}
    const attempts: string[] = [trimmed]

    // 剥离 Markdown 代码块包裹：```json ... ``` 或 ``` ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenceMatch) attempts.push(fenceMatch[1].trim())

    // 按首尾花括号截取 JSON 子串（容忍前后多余文本）。
    const braceStart = trimmed.indexOf('{')
    const braceEnd = trimmed.lastIndexOf('}')
    if (braceStart >= 0 && braceEnd > braceStart) {
        attempts.push(trimmed.slice(braceStart, braceEnd + 1))
    }

    for (const candidate of attempts) {
        try {
            const parsed = JSON.parse(candidate) as unknown
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
        } catch {
            // 尝试下一种形态
        }
    }
    return null
}

/** 判断对象是否形如 JsonRecord。 */
function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 解析 create_record 工具参数，返回规范化的记录；非法时返回 null。
 * key 缺失时尝试从 data 中按主键字段推导。
 */
export function parseCreateRecordArgs(raw: Record<string, unknown>): GeneratedRecord | null {
    const group = isSupportedGroup(raw.group) ? raw.group : undefined
    if (!group) return null
    const data = isJsonRecord(raw.data) ? raw.data : undefined
    if (!data) return null
    const key = typeof raw.key === 'string' && raw.key.trim() !== '' ? raw.key : ''
    return { group, key, data }
}

/** 解析 write_seid 工具参数，返回规范化结果；非法时返回 null。 */
export function parseWriteSeidArgs(raw: Record<string, unknown>): WriteSeidArgs | null {
    const dataKey = raw.dataKey
    const seidId = raw.seidId
    const targetKey = raw.targetKey
    const params = isJsonRecord(raw.params) ? raw.params : undefined
    if (typeof dataKey !== 'string' || typeof seidId !== 'string' || typeof targetKey !== 'string' || !params) {
        return null
    }
    return { dataKey, seidId, targetKey, params }
}

/** 解析 search_record 工具参数。 */
export function parseSearchRecordArgs(raw: Record<string, unknown>): SearchRecordArgs | null {
    if (!isSupportedGroup(raw.group)) return null
    const query = typeof raw.query === 'string' ? raw.query.trim() : ''
    return { group: raw.group, query }
}

/** 解析 ask_user 工具参数。 */
export function parseAskUserArgs(raw: Record<string, unknown>): AskUserArgs | null {
    if (typeof raw.question !== 'string' || raw.question.trim() === '') return null
    const kind = raw.kind === 'number' || raw.kind === 'options' ? raw.kind : 'text'
    const options = Array.isArray(raw.options) ? raw.options.filter((item): item is string => typeof item === 'string') : undefined
    return { question: raw.question, kind, options }
}

/**
 * 工具定义（OpenAI function calling schema），随请求发给模型。
 * 模型据此自主决定何时调用 create_record / write_seid / ask_user。
 */
export function buildToolDefinitions() {
    return [
        {
            type: 'function',
            function: {
                name: 'create_record',
                description:
                    '写入一条游戏数据记录（buff/功法/神通/物品等）。data 字段名必须严格使用系统提示词中给出的字段 schema，不要臆造或改名。调用后记录会被暂存，最终由用户确认后统一应用到 mod。',
                parameters: {
                    type: 'object',
                    properties: {
                        group: { type: 'string', description: '记录分组，取值 buff/item/skill/shenTong/wuDao/npcType' },
                        key: {
                            type: 'string',
                            description: '记录主键值（buff→buffid，功法/神通/物品/悟道→id），与 data 中的主键字段值一致',
                        },
                        data: {
                            type: 'object',
                            description: '完整字段数据对象，字段名严格按 schema，包含主键字段、name 名称字段与 seid 数组',
                        },
                    },
                    required: ['group', 'key', 'data'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'search_record',
                description:
                    '在已有的游戏数据（预加载数据与当前 mod 中的记录）里查询可复用的内容。当需要引用一个 buff/功法/神通/物品时，先用它确认是否已存在，避免重复新建或 id 冲突。',
                parameters: {
                    type: 'object',
                    properties: {
                        group: { type: 'string', description: '查询的分组，取值 buff/item/skill/shenTong/wuDao/npcType' },
                        query: {
                            type: 'string',
                            description: '查询关键词（按名称或主键 id 模糊匹配）；留空则返回该分组全部记录的 id+名称摘要',
                        },
                    },
                    required: ['group'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'write_seid',
                description:
                    '为某条记录写入一个 Seid 参数。seidId 必须是「可用 Seid 定义」中列出的 Seid 数字 id（如 1、3、40），不要用反斜杠、序号或占位符。参数写入对应 Seid 数据文件，同时该 Seid id 应出现在目标记录 data.seid 数组中。',
                parameters: {
                    type: 'object',
                    properties: {
                        dataKey: {
                            type: 'string',
                            description:
                                'Seid 数据目录：buff 分组→buff，神通→skill，功法/悟道→staticSkill，物品→itemUse/itemEquip（按物品 type 决定）',
                        },
                        seidId: { type: 'string', description: 'Seid 数字 id，来自「可用 Seid 定义」里 Seid id= 后面的数字' },
                        targetKey: { type: 'string', description: '拥有该 seid 的记录主键值（与 create_record 的 key 一致）' },
                        params: { type: 'object', description: 'Seid 参数对象，以 Seid 定义中的参数对象键（idField）为键' },
                    },
                    required: ['dataKey', 'seidId', 'targetKey', 'params'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'ask_user',
                description: '向用户询问生成所需的关键信息（如 id 用多少）。当缺少必要参数、无法自行决定时应主动询问，而不是随意编造。',
                parameters: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: '向用户提出的问题' },
                        kind: { type: 'string', enum: ['text', 'number', 'options'], description: '回答类型' },
                        options: { type: 'array', items: { type: 'string' }, description: 'kind 为 options 时的候选选项' },
                    },
                    required: ['question'],
                },
            },
        },
    ]
}
