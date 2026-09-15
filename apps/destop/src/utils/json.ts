import type { JsonDataset, JsonRecord, JsonValue, ProjectData, ProjectMod, ProjectModGroup, ProjectModGroupKey } from '@baize-next/types'

/**
 * JSON 解析与项目结构工具。
 */

/** mod 分组定义，顺序即左侧树展示顺序。 */
export const PROJECT_GROUP_DEFS: { key: ProjectModGroupKey; label: string }[] = [
    { key: 'config', label: '项目设置' },
    { key: 'buff', label: 'buff' },
    { key: 'item', label: '物品' },
    { key: 'skill', label: '功法' },
    { key: 'shenTong', label: '神通' },
    { key: 'npcType', label: 'NPC类型' },
    { key: 'npcWuDao', label: 'NPC悟道' },
    { key: 'tuJianChunWenBen', label: '词缀数据' },
]

/**
 * 读取一个 File 对象的文本内容。
 * @param file 浏览器提供的文件对象。
 * @returns 文件 UTF-8 文本内容。
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
        reader.readAsText(file, 'utf-8')
    })
}

/**
 * 判断一个值是否为纯对象（非 null、非数组、非原始值）。
 * @param value 任意 JSON 值。
 */
export function isRecordObject(value: unknown): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 判断 JSON 值是否为一个“记录映射”：
 * 对象的所有字段值本身都是对象，即 `{ id: {...} }` 的格式。
 * @param value JSON 顶层值。
 */
export function isRecordMap(value: unknown): value is Record<string, Record<string, JsonValue>> {
    if (!isRecordObject(value)) return false
    const entries = Object.values(value)
    return entries.length > 0 && entries.every(isRecordObject)
}

function parseJsonText(text: string): unknown {
    const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    try {
        return JSON.parse(source)
    } catch {
        return JSON.parse(stripJsonTrailingCommas(source))
    }
}

function stripJsonTrailingCommas(text: string): string {
    let result = ''
    let inString = false
    let escaped = false
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        if (inString) {
            result += char
            if (escaped) {
                escaped = false
            } else if (char === '\\') {
                escaped = true
            } else if (char === '"') {
                inString = false
            }
            continue
        }
        if (char === '"') {
            inString = true
            result += char
            continue
        }
        if (char === ',') {
            let next = index + 1
            while (next < text.length && /\s/.test(text[next] ?? '')) {
                next += 1
            }
            if (text[next] === '}' || text[next] === ']') {
                index = next - 1
                continue
            }
        }
        result += char
    }
    return result
}

/**
 * 获取一条记录的稳定标识：优先取 id，其次取对象首键，最后回退为 index。
 * @param data 记录数据。
 * @param fallback 回退键。
 */
function resolveRecordKey(data: Record<string, JsonValue>, fallback: string): string {
    const idValue = data.id
    if (typeof idValue === 'string' || typeof idValue === 'number') {
        return String(idValue)
    }
    return fallback
}

/**
 * 将单个 JSON 内容解析为一个数据集。
 * @param name 数据集名称。
 * @param content JSON 文本。
 * @returns 解析后的数据集。
 * @throws 当 JSON 无法解析或不满足支持的形态时抛出错误。
 */
export function parseJsonContent(name: string, content: string): JsonDataset {
    const parsed: unknown = parseJsonText(content)

    if (Array.isArray(parsed)) {
        const records: JsonRecord[] = parsed.map((item, index) => {
            if (!isRecordObject(item)) {
                throw new Error(`数组第 ${index + 1} 项不是对象，无法作为记录`)
            }
            return { key: resolveRecordKey(item, String(index)), data: item }
        })
        return { id: createDatasetId(name), name, kind: 'file', records }
    }

    if (isRecordMap(parsed)) {
        const records: JsonRecord[] = Object.entries(parsed).map(([rawKey, data]) => ({
            key: resolveRecordKey(data, rawKey),
            data,
        }))
        return { id: createDatasetId(name), name, kind: 'file', records }
    }

    if (isRecordObject(parsed)) {
        return {
            id: createDatasetId(name),
            name,
            kind: 'file',
            records: [{ key: resolveRecordKey(parsed, 'root'), data: parsed }],
        }
    }

    throw new Error('JSON 顶层必须是数组或对象')
}

/**
 * 生成无碰撞的 id。
 * @param base 基础名称。
 */
export function createDatasetId(base: string): string {
    const normalized = base
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/gi, '-')
    return `${normalized}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 返回记录内所有字段的并集，保持出现顺序。
 * @param records 记录列表。
 */
export function collectRecordFields(records: JsonRecord[]): string[] {
    const fields = new Set<string>()
    for (const record of records) {
        for (const field of Object.keys(record.data)) {
            fields.add(field)
        }
    }
    return Array.from(fields)
}

/**
 * 将 JSON 值格式化为适合表格单元格显示的字符串。
 * @param value JSON 值。
 */
export function formatCellValue(value: JsonValue): string {
    if (value === null) return 'null'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

export interface AffixProjectTypeOption {
    value: string
    label: string
    typeNum: number
    typeName: string
}

export interface AffixTypeOption {
    value: string
    label: string
    typeId: number
    typeName: string
}

export function getAffixProjectTypeOptions(datasets: JsonDataset[]): AffixProjectTypeOption[] {
    const dataset = datasets.find(item => item.name === 'AffixProjectType')
    const options: AffixProjectTypeOption[] = []
    for (const record of dataset?.records ?? []) {
        const typeNum = record.data.TypeNum
        const typeName = record.data.TypeName
        if (typeof typeNum === 'number' && typeof typeName === 'string') {
            options.push({ value: String(typeNum), label: typeName, typeNum, typeName })
        }
    }
    return options
}

export function getAffixTypeOptions(datasets: JsonDataset[]): AffixTypeOption[] {
    const dataset = datasets.find(item => item.name === 'AffixType')
    const options: AffixTypeOption[] = []
    for (const record of dataset?.records ?? []) {
        const typeId = record.data.TypeID
        const typeName = record.data.TypeName
        if (typeof typeId === 'number' && typeof typeName === 'string') {
            options.push({ value: String(typeId), label: typeName, typeId, typeName })
        }
    }
    return options
}

export interface AffixSelectOption {
    id: number
    value: string
    label: string
    name1: string
    typenum: number
    type: number
    descr: string
}

export function getAffixSelectOptions(records: JsonRecord[]): AffixSelectOption[] {
    const options: AffixSelectOption[] = []
    const seen = new Set<number>()
    for (const record of records) {
        const id = record.data.id
        if (typeof id !== 'number' || seen.has(id)) continue
        seen.add(id)
        const name1 = typeof record.data.name1 === 'string' ? record.data.name1 : ''
        const name2 = typeof record.data.name2 === 'string' ? record.data.name2 : ''
        const typenum = typeof record.data.typenum === 'number' ? record.data.typenum : 0
        const type = typeof record.data.type === 'number' ? record.data.type : 0
        const descr = typeof record.data.descr === 'string' ? record.data.descr : ''
        options.push({
            id,
            value: String(id),
            label: name2 || String(id),
            name1,
            typenum,
            type,
            descr,
        })
    }
    return options
}

export function collectGroupRecords(project: ProjectData | null, groupKey: ProjectModGroupKey): JsonRecord[] {
    return project?.mods.flatMap(mod => mod.groups.find(group => group.key === groupKey)?.records ?? []) ?? []
}
/** 路径片段归类结果。 */
interface ProjectFileMatch {
    /** mod 文件夹名，例如 modXXX。 */
    modName: string
    /** 命中的数据分组。 */
    groupKey: ProjectModGroupKey
}

/**
 * 根据 webkitRelativePath 判断文件属于哪个 mod 的哪个数据分组。
 * @param parts 按 / 切分后的相对路径片段。
 */
function matchProjectFile(parts: string[]): ProjectFileMatch | null {
    const modIndex = parts.findIndex(part => part.startsWith('mod'))
    if (modIndex < 0) return null

    const modName = parts[modIndex] || '未命名mod'
    const rest = parts.slice(modIndex + 1)

    if (rest[0] === 'Config' && rest[1] === 'modConfig.json') {
        return { modName, groupKey: 'config' }
    }

    if (rest[0] !== 'Data') return null

    const tail = rest[rest.length - 1] || ''
    if (rest[1] === 'BuffJsonData' && tail.endsWith('.json')) return { modName, groupKey: 'buff' }
    if (rest[1] === 'ItemJsonData' && tail.endsWith('.json')) return { modName, groupKey: 'item' }
    if (rest[1] === 'skillJsonData' && tail.endsWith('.json')) return { modName, groupKey: 'shenTong' }
    if (rest[1] === 'StaticSkillJsonData.json') return { modName, groupKey: 'skill' }
    if (rest[1] === 'NPCLeiXingDate.json') return { modName, groupKey: 'npcType' }
    if (rest[1] === 'NPCWuDaoJson.json') return { modName, groupKey: 'npcWuDao' }
    if (rest[1] === 'TuJianChunWenBen.json') return { modName, groupKey: 'tuJianChunWenBen' }
    return null
}

/** 原生目录读取返回的项目 JSON 文件条目。 */
export interface ProjectFileEntry {
    /** 相对项目根目录的路径，统一使用 / 分隔。 */
    relativePath: string
    /** JSON 文件文本内容。 */
    content: string
}

/** 从根路径名提取项目展示名称。 */
export function projectNameFromPath(rootPath: string): string {
    const normalized = rootPath.replace(/\\/g, '/').replace(/\/+$/, '')
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] || '未命名项目'
}

/**
 * 将 Tauri 原生目录选择得到的 JSON 文件条目解析为项目结构。
 * 识别 plugins/Next 下的 modXXX，并按 BuffJsonData/ItemJsonData/skillJsonData 的目录结构合并数据。
 */
export async function parseProjectFromEntries(rootPath: string, entries: ProjectFileEntry[]): Promise<ProjectData> {
    const projectName = projectNameFromPath(rootPath)
    const grouped = new Map<string, Map<ProjectModGroupKey, ProjectFileEntry[]>>()

    for (const entry of entries) {
        const parts = entry.relativePath.split('/').filter(Boolean)
        const match = matchProjectFile(parts)
        if (!match) continue

        const modMap = grouped.get(match.modName) ?? new Map<ProjectModGroupKey, ProjectFileEntry[]>()
        const bucket = modMap.get(match.groupKey) ?? []
        bucket.push(entry)
        modMap.set(match.groupKey, bucket)
        grouped.set(match.modName, modMap)
    }

    const mods: ProjectMod[] = []
    for (const [modName, groupFiles] of grouped) {
        const groups: ProjectModGroup[] = []

        for (const def of PROJECT_GROUP_DEFS) {
            const bucket = groupFiles.get(def.key) ?? []
            const records: JsonRecord[] = []

            if (
                def.key === 'config' ||
                def.key === 'skill' ||
                def.key === 'npcType' ||
                def.key === 'npcWuDao' ||
                def.key === 'tuJianChunWenBen'
            ) {
                for (const entry of bucket) {
                    const fileName = entry.relativePath.split('/').pop() ?? 'root'
                    const dataset = parseJsonContent(fileName.replace(/\.json$/i, ''), entry.content)
                    records.push(...dataset.records)
                }
            } else {
                for (const entry of bucket) {
                    const fileName = entry.relativePath.split('/').pop() ?? 'root'
                    const parsed: unknown = parseJsonText(entry.content)
                    if (!isRecordObject(parsed)) {
                        throw new Error(`文件 ${fileName} 不是对象，无法作为记录`)
                    }
                    records.push({ key: resolveRecordKey(parsed, fileName.replace(/\.json$/i, '')), data: parsed })
                }
            }

            groups.push({ key: def.key, label: def.label, records })
        }

        mods.push({ id: createDatasetId(modName), name: modName, groups })
    }

    return { id: createDatasetId(projectName), name: projectName, mods }
}

/** mod 预加载分组的标签。 */
const MOD_PRELOAD_LABEL = 'mod 预加载'

function preloadEntryName(entry: ProjectFileEntry): string {
    const fileName = entry.relativePath.split('/').pop() ?? entry.relativePath
    return fileName.replace(/\.json$/i, '')
}

/** 将单个 JSON 文件解析为一个 Meta 预加载数据集。 */
export function parseMetaJsonEntry(entry: ProjectFileEntry): JsonDataset {
    const name = preloadEntryName(entry)
    return parseJsonContent(name, entry.content)
}

/** 将目录中的 Meta JSON 归纳为枚举式数据集。 */
export function parseMetaEntriesFromEntries(entries: ProjectFileEntry[]): JsonDataset[] {
    return entries.map(entry => parseMetaJsonEntry(entry))
}

/** 将 mod 预加载目录解析为项目结构。 */
export async function parseModPreloadFromEntries(rootPath: string, entries: ProjectFileEntry[]): Promise<ProjectData> {
    return parseProjectFromEntries(rootPath, entries)
}

/** 将 mod 预加载 JSON 文件解析为项目结构。 */
export function parseModPreloadJsonEntry(entry: ProjectFileEntry): ProjectData {
    const name = preloadEntryName(entry)
    const dataset = parseJsonContent(name, entry.content)
    const mod: ProjectMod = {
        id: createDatasetId(name),
        name,
        groups: [{ key: 'preload', label: MOD_PRELOAD_LABEL, records: dataset.records }],
    }
    return { id: createDatasetId(`preload-${name}`), name, mods: [mod] }
}

/** 写回项目 JSON 文件时使用的相对路径与文本内容。 */
export interface ProjectFileWrite {
    /** 相对项目根目录的路径，统一使用 / 分隔。 */
    relativePath: string
    /** 需要写入的 JSON 文本。 */
    content: string
}

/** 按项目的路径规则序列化为 JSON 文本（两空格缩进 + 末尾换行）。 */
function stringifyJson(value: JsonValue): string {
    return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * 将分组内的记录按原始顺序还原为 `{ key: data }` 映射。
 * @param records 分组内的记录。
 */
function recordsToMap(records: JsonRecord[]): Record<string, JsonValue> {
    const map: Record<string, JsonValue> = {}
    for (const record of records) {
        map[record.key] = record.data
    }
    return map
}

/** 单个文件承载全部分组数据的分组（config/skill/npcType/npcWuDao/tuJianChunWenBen）。 */
const SINGLE_FILE_GROUPS = new Set<ProjectModGroupKey>(['config', 'skill', 'npcType', 'npcWuDao', 'tuJianChunWenBen'])

/** 每个分组的原始文件位置，用于将编辑结果写回原文件。 */
const GROUP_FILE_PATHS: Partial<Record<ProjectModGroupKey, (modName: string, recordKey: string) => string>> = {
    buff: (modName, recordKey) => `plugins/Next/_/mod_${modName}/Data/BuffJsonData/${recordKey}.json`,
    item: (modName, recordKey) => `plugins/Next/_/mod_${modName}/Data/ItemJsonData/${recordKey}.json`,
    shenTong: (modName, recordKey) => `plugins/Next/_/mod_${modName}/Data/skillJsonData/${recordKey}.json`,
}

/** 单文件分组的固定路径。 */
const SINGLE_FILE_PATHS: Partial<Record<ProjectModGroupKey, (modName: string) => string>> = {
    config: modName => `plugins/Next/_/mod_${modName}/Config/modConfig.json`,
    skill: modName => `plugins/Next/_/mod_${modName}/Data/StaticSkillJsonData.json`,
    npcType: modName => `plugins/Next/_/mod_${modName}/Data/NPCLeiXingDate.json`,
    npcWuDao: modName => `plugins/Next/_/mod_${modName}/Data/NPCWuDaoJson.json`,
    tuJianChunWenBen: modName => `plugins/Next/_/mod_${modName}/Data/TuJianChunWenBen.json`,
}

/**
 * 将项目数据序列化为可写回磁盘的 JSON 文件列表。
 * @param project 当前项目数据。
 * @returns 需要写入的文件列表；无 mod 时为空数组。
 */
export function serializeProjectFiles(project: ProjectData): ProjectFileWrite[] {
    const writes: ProjectFileWrite[] = []

    for (const mod of project.mods) {
        for (const group of mod.groups) {
            if (SINGLE_FILE_GROUPS.has(group.key)) {
                const resolve = SINGLE_FILE_PATHS[group.key]
                if (!resolve) continue
                writes.push({ relativePath: resolve(mod.name), content: stringifyJson(recordsToMap(group.records)) })
                continue
            }

            const resolveRecord = GROUP_FILE_PATHS[group.key]
            if (!resolveRecord) continue
            for (const record of group.records) {
                writes.push({ relativePath: resolveRecord(mod.name, record.key), content: stringifyJson(record.data) })
            }
        }
    }

    return writes
}
