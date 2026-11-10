import type { JsonValue, ProjectData, ProjectMod, ProjectModGroupKey, ProjectSeidData, SeidDataKey } from '@baize-next/types'

import { getRecordIdField, withDefaultRecordData } from './utils/defaultRecordTemplates'
import { insertRecordSorted } from './utils/projectSession'
import { getSeidDataKey, isSeidProjectGroup, type SeidProjectGroupKey } from './utils/seid'

/** AI 生成的一条记录：分组 + 记录 key + 完整字段数据。 */
export interface GeneratedRecord {
    group: ProjectModGroupKey
    key: string
    data: Record<string, JsonValue>
}

/** AI 一次指令生成的完整结果：主记录 + 依赖记录 + Seid 参数。 */
export interface GeneratedResult {
    records: GeneratedRecord[]
    seidData: ProjectSeidData
}

/** 一条可应用的生成记录（应用前按主键规范化出 key 与 seid 归属）。 */
export interface ApplicableRecord {
    group: ProjectModGroupKey
    key: string
    data: Record<string, JsonValue>
}

/**
 * 将生成结果序列化为一段可供模型阅读的引用文本。
 * 用于「引用回复」：用户基于上一条生成结果继续追问时，把结构化结果注入上下文，
 * 让模型知道此前生成了哪些记录（分组、主键、字段与 Seid），从而在此基础上修改而非重新臆造。
 */
export function serializeGeneratedResult(result: GeneratedResult): string {
    const lines: string[] = ['以下是此前通过指令生成的记录（引用上下文，供你在此基础上修改，勿重新臆造）：']
    for (const record of result.records) {
        lines.push(`- [${record.group}] key=${record.key}`)
        const dataText = JSON.stringify(record.data)
        lines.push(`  data: ${dataText}`)
    }
    const seidKeys = Object.keys(result.seidData)
    if (seidKeys.length > 0) {
        lines.push(`Seid 参数：${JSON.stringify(result.seidData)}`)
    }
    return lines.join('\n')
}

/**
 * 从 AI 回复文本中容错提取 JSON 对象。
 * 支持三种形态：纯 JSON、被 ```json ... ``` 或 ``` ... ``` 包裹的代码块、以及嵌在正文中的首个 { 到末个 } 区间。
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
    if (!text) return null
    const trimmed = text.trim()

    // 直接尝试整体解析。
    const direct = tryParseObject(trimmed)
    if (direct) return direct

    // 剥离 ```json / ``` 代码围栏。
    const fenced = trimmed
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim()
    const fencedParsed = tryParseObject(fenced)
    if (fencedParsed) return fencedParsed

    // 兜底：截取首个 { 到最后一个 } 的区间。
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const slice = trimmed.slice(firstBrace, lastBrace + 1)
        const slicedParsed = tryParseObject(slice)
        if (slicedParsed) return slicedParsed
    }

    return null
}

function tryParseObject(text: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(text) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>
        }
    } catch {
        // 非 JSON 文本，继续尝试其它形态。
    }
    return null
}

function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSupportedGroup(value: unknown): value is ProjectModGroupKey {
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

/** 从记录数据中取主键字段值，作为记录 key；缺失时回退 null（由调用方兜底）。 */
function resolveRecordKey(group: ProjectModGroupKey, data: Record<string, JsonValue>): string | null {
    const idField = getRecordIdField(group)
    if (idField) {
        const value = data[idField]
        if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) return String(value)
    }
    // 无主键字段时尝试通用 id 字段。
    for (const field of ['id', 'ID', 'buffid', 'Skill_ID']) {
        const value = data[field]
        if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) return String(value)
    }
    return null
}

/**
 * 解析 AI 回复文本为 GeneratedResult。
 * 支持两种输出形态：
 * 1. { "records": [{ "group": "skill", "key": "123", "data": {...} }], "seidData": {...} }
 * 2. 单条记录对象 { ... }（无 records 包装时，视为单条主记录，group 由 context 决定，这里无法得知故返回 records 为空）
 *
 * 仅认可白名单分组，数据字段非对象时丢弃，缺失 key 时按主键字段推导。
 */
export function parseGeneratedResult(text: string, fallbackGroup?: ProjectModGroupKey): GeneratedResult | null {
    const root = extractJsonObject(text)
    if (!root) return null

    // 形态 1：records + seidData 结构。
    if (Array.isArray(root.records)) {
        const records: GeneratedRecord[] = []
        for (const item of root.records) {
            if (!isJsonRecord(item)) continue
            const group = isSupportedGroup(item.group) ? item.group : undefined
            if (!group) continue
            const data = isJsonRecord(item.data) ? item.data : undefined
            if (!data) continue
            const key = typeof item.key === 'string' && item.key.trim() !== '' ? item.key : (resolveRecordKey(group, data) ?? '')
            if (!key) continue
            records.push({ group, key, data })
        }
        const seidData = parseSeidData(root.seidData)
        return { records, seidData }
    }

    // 形态 2：单条记录对象（需要 fallbackGroup 指定分组）。
    if (fallbackGroup) {
        const key = resolveRecordKey(fallbackGroup, root as Record<string, JsonValue>) ?? ''
        if (!key) return null
        return { records: [{ group: fallbackGroup, key, data: root as Record<string, JsonValue> }], seidData: {} }
    }

    return null
}

/** 解析 SeidData 结构，仅保留合法数据。 */
function parseSeidData(value: unknown): ProjectSeidData {
    const result: ProjectSeidData = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result
    const root = value as Record<string, unknown>
    for (const dataKey of ['buff', 'skill', 'staticSkill', 'itemUse', 'itemEquip'] as const) {
        const files = root[dataKey]
        if (!files || typeof files !== 'object' || Array.isArray(files)) continue
        const parsedFiles: Record<string, Record<string, Record<string, JsonValue>>> = {}
        for (const [seidId, records] of Object.entries(files as Record<string, unknown>)) {
            if (!records || typeof records !== 'object' || Array.isArray(records)) continue
            const parsedRecords: Record<string, Record<string, JsonValue>> = {}
            for (const [targetKey, params] of Object.entries(records as Record<string, unknown>)) {
                if (isJsonRecord(params)) parsedRecords[targetKey] = params
            }
            if (Object.keys(parsedRecords).length > 0) parsedFiles[seidId] = parsedRecords
        }
        if (Object.keys(parsedFiles).length > 0) result[dataKey] = parsedFiles
    }
    return result
}

/**
 * 将生成的记录与其 Seid 参数做归属校正：把每个记录 data.seid 中列出的 Seid 参数，按 dataKey 归入 seidData。
 * 返回可直接批量写回的（记录 + Seid 参数）结果。
 */
export function normalizeGeneratedResult(result: GeneratedResult): GeneratedResult {
    const seidData: ProjectSeidData = { ...result.seidData }
    const records = result.records.map(record => {
        const seidIds = Array.isArray(record.data.seid)
            ? record.data.seid.filter(item => typeof item === 'number' || typeof item === 'string')
            : []
        // 为每个 seidId 确保在对应 dataKey 下有一条参数记录（可能缺失，写入空参数占位，交由下游补默认值）。
        if (isSeidProjectGroup(record.group) && seidIds.length > 0) {
            const dataKey = getSeidDataKey(record.group as SeidProjectGroupKey, record.data)
            const files = { ...(seidData[dataKey] ?? {}) }
            for (const seidId of seidIds) {
                const id = String(seidId)
                const recordsForSeid = { ...(files[id] ?? {}) }
                recordsForSeid[record.key] = recordsForSeid[record.key] ?? {}
                files[id] = recordsForSeid
            }
            seidData[dataKey] = files
        }
        return record
    })
    return { records, seidData }
}

/** 将 Seid 参数写入 mod 的 seidData，同时确保目标记录 data.seid 数组包含该 seidId。 */
function applySeidToMod(
    mod: ProjectMod,
    dataKey: SeidDataKey,
    seidId: string,
    targetKey: string,
    params: Record<string, JsonValue>
): ProjectMod {
    const seidData: ProjectSeidData = { ...(mod.seidData ?? {}) }
    const files = { ...(seidData[dataKey] ?? {}) }
    const records = { ...(files[seidId] ?? {}) }
    records[targetKey] = params
    files[seidId] = records
    seidData[dataKey] = files

    // 同步把 seidId 补进对应分组的记录 data.seid 数组。
    const groups = mod.groups.map(group => {
        const record = group.records.find(item => item.key === targetKey)
        if (!record) return group
        const seidList = Array.isArray(record.data.seid)
            ? record.data.seid.filter(item => typeof item === 'number' || typeof item === 'string')
            : []
        const numericSeidId = Number(seidId)
        const nextSeidId: JsonValue = Number.isFinite(numericSeidId) ? numericSeidId : seidId
        if (!seidList.some(item => String(item) === seidId)) seidList.push(nextSeidId)
        return {
            ...group,
            records: group.records.map(item => (item.key === targetKey ? { ...item, data: { ...item.data, seid: seidList } } : item)),
        }
    })

    return { ...mod, seidData, groups }
}

/**
 * 将 AI 生成结果批量应用到指定 mod：规范化并插入/覆盖记录，写入 Seid 参数。
 * 纯函数，不产生副作用；返回新的 ProjectData（modId 不存在时返回原 project）。
 */
export function applyGeneratedResultToProject(project: ProjectData, modId: string, result: GeneratedResult): ProjectData {
    const normalized = normalizeGeneratedResult(result)
    let nextProject = project

    for (const record of normalized.records) {
        const data = withDefaultRecordData(record.group, record.data)
        nextProject = {
            ...nextProject,
            mods: nextProject.mods.map(mod => {
                if (mod.id !== modId) return mod
                const groups = mod.groups.map(group => {
                    if (group.key !== record.group) return group
                    const existing = group.records.find(item => item.key === record.key)
                    const nextRecords = existing
                        ? group.records.map(item => (item.key === record.key ? { ...item, data } : item))
                        : insertRecordSorted(record.group, group.records, { key: record.key, data })
                    return { ...group, records: nextRecords }
                })
                return { ...mod, groups }
            }),
        }
    }

    for (const dataKey of Object.keys(normalized.seidData) as SeidDataKey[]) {
        const files = normalized.seidData[dataKey]
        if (!files) continue
        for (const [seidId, records] of Object.entries(files)) {
            for (const [targetKey, params] of Object.entries(records)) {
                nextProject = {
                    ...nextProject,
                    mods: nextProject.mods.map(mod => (mod.id === modId ? applySeidToMod(mod, dataKey, seidId, targetKey, params) : mod)),
                }
            }
        }
    }

    return nextProject
}
