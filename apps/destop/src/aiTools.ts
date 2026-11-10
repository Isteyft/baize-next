import type { JsonValue, ProjectModGroupKey } from '@baize-next/types'

import type { GeneratedRecord, GeneratedResult } from './aiGeneration'

/**
 * 全局系统提示词（预留位）。
 * 默认为空字符串；后续需要给 AI 增加通用约束（如输出风格、领域规则）时，直接在此处填写内容即可，
 * 会被注入到每次 AI 请求的 system 消息最前面。
 */
export const GLOBAL_SYSTEM_PROMPT = ''

/** 工具调用：模型发起的一次 function call。 */
export interface ToolCall {
    id: string
    name: string
    arguments: string
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

/** 解析工具调用的 arguments（JSON 字符串）为对象；失败返回 null。 */
export function parseToolArguments(argumentsText: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(argumentsText) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
        // ignore
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
                description: '写入一条游戏数据记录（buff/功法/神通/物品等）。调用后记录会被暂存，最终由用户确认后统一应用到 mod。',
                parameters: {
                    type: 'object',
                    properties: {
                        group: { type: 'string', description: '记录分组，取值 buff/item/skill/shenTong/wuDao/npcType' },
                        key: { type: 'string', description: '记录主键（buff→buffid，功法/神通→Skill_ID，物品→id）' },
                        data: { type: 'object', description: '完整字段数据对象，包含主键字段与 seid 数组' },
                    },
                    required: ['group', 'key', 'data'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'write_seid',
                description: '为某条记录写入一个 Seid 参数。记录通过 data.seid 数组引用 Seid，参数写入对应 Seid 数据文件。',
                parameters: {
                    type: 'object',
                    properties: {
                        dataKey: { type: 'string', description: 'Seid 数据目录，取值 buff/skill/staticSkill/itemUse/itemEquip' },
                        seidId: { type: 'string', description: 'Seid 数字 id' },
                        targetKey: { type: 'string', description: '拥有该 seid 的记录 key' },
                        params: { type: 'object', description: 'Seid 参数对象' },
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
