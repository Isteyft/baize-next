import type {
    JsonDataset,
    JsonRecord,
    JsonValue,
    ProjectData,
    ProjectMod,
    ProjectModGroup,
    ProjectModGroupKey,
    ProjectSeidData,
    SeidDataKey,
} from '@baize-next/types'

import { normalizeRecordData } from './defaultRecordTemplates'

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
    { key: 'wuDaoAllType', label: '悟道类型' },
    { key: 'wuDao', label: '悟道' },
    { key: 'tuJianChunWenBen', label: '词缀数据' },
]

/** 表格搜索框默认占位文案。 */
export const TABLE_SEARCH_PLACEHOLDER = '搜索 id / 名称 / 介绍'

/** 用于搜索匹配的字段名（不区分大小写）。 */
const SEARCHABLE_FIELD_NAMES = new Set(['id', 'name', 'name2', 'descr', 'desc', 'desc2'])

function toSearchText(value: JsonValue): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

/**
 * 收集一条记录中用于搜索的文本：包括主键、常见 ID/名称/介绍字段与记录 key。
 * @param record 待搜索的记录。
 * @param primaryField 当前分组的主键字段，无主键时为 null。
 * @param extraFields 分组额外需要参与搜索的字段名。
 * @returns 低依赖的单行文本，各字段以 \u0000 分隔。
 */
export function collectSearchableText(record: JsonRecord, primaryField: string | null, extraFields: string[] = []): string {
    const parts: string[] = [String(record.key)]
    for (const field of Object.keys(record.data)) {
        const normalized = field.toLowerCase()
        if (normalized !== primaryField && !SEARCHABLE_FIELD_NAMES.has(normalized)) continue
        const text = toSearchText(record.data[field])
        if (text) parts.push(text)
    }
    for (const field of extraFields) {
        const text = toSearchText(record.data[field])
        if (text) parts.push(text)
    }
    return parts.join('\u0000')
}

/**
 * 判断搜索词是否有效（去除首尾空白后非空）。
 * @param query 用户输入的关键词。
 */
export function hasSearchKeyword(query: string): boolean {
    return query.trim().length > 0
}

/**
 * 判断一段搜索文本是否命中关键词（忽略大小写）。
 * @param haystack 预先收集好的搜索文本。
 * @param query 用户输入的关键词。
 */
export function matchesSearchQuery(haystack: string, query: string): boolean {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return true
    return haystack.toLowerCase().includes(keyword)
}

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

/** 一条 meta 枚举选项：值为数值 id，标签为策划填写的中文描述。 */
export interface MetaEnumOption {
    /** 选项值，用于与下拉框当前值比较。 */
    value: string
    /** 选项显示文本。 */
    label: string
    /** meta 中的数值 id。 */
    id: number
}

/** Data/Meta 中各枚举 JSON 使用的数值字段名，按优先级排列。 */
const META_ID_FIELDS = ['Id', 'ID', 'TypeID', 'TypeNum']

/** String enum id fields used by operator/action meta files. */
const META_STRING_ID_FIELDS = ['Id', 'ID', 'TypeStrID']

/** Data/Meta 中各枚举 JSON 使用的描述字段名，按优先级排列。 */
const META_LABEL_FIELDS = ['Desc', 'TypeName']

/**
 * 判断一条记录是否完全符合 meta 枚举结构：
 * 每个枚举文件只使用同一种字段命名，因此数值字段与描述字段不能来自不同命名体系。
 * @param data meta 记录数据。
 */
function isMetaEnumRecord(data: Record<string, JsonValue>): boolean {
    for (const idField of META_ID_FIELDS) {
        for (const labelField of META_LABEL_FIELDS) {
            if (idField === labelField) continue
            if (typeof data[idField] === 'number' && typeof data[labelField] === 'string') return true
        }
    }
    return false
}

/**
 * 按数据集名称读取原始 meta 枚举选项。
 * 数值字段按 Id/ID/TypeID/TypeNum 顺序识别，描述字段按 Desc/TypeName 顺序识别，
 * 以便同一套逻辑同时适配 Data/Meta 下的多种 JSON 结构。
 * 字段命名必须成对匹配（例如 Id 只能配 Desc，TypeID 只能配 TypeName），
 * 避免把 buffid 这类无关数值字段误判为枚举值。
 * @param datasets 已预加载的 meta 数据集。
 * @param datasetName 数据集名称，对应 Data/Meta 下的文件名（不含扩展名）。
 */
function getMetaEnumRawOptions(datasets: JsonDataset[], datasetName: string): MetaEnumOption[] {
    const dataset = datasets.find(item => item.name === datasetName)
    if (!dataset) return []

    const options: MetaEnumOption[] = []
    const seen = new Set<number>()
    for (const record of dataset.records) {
        if (!isMetaEnumRecord(record.data)) continue
        let id: number | null = null
        let label: string | null = null
        for (const idField of META_ID_FIELDS) {
            for (const labelField of META_LABEL_FIELDS) {
                if (idField === labelField) continue
                if (typeof record.data[idField] === 'number' && typeof record.data[labelField] === 'string') {
                    id = record.data[idField] as number
                    label = record.data[labelField] as string
                    break
                }
            }
            if (id !== null) break
        }
        if (id === null || label === null) continue
        if (seen.has(id)) continue
        seen.add(id)
        options.push({ value: String(id), label, id })
    }
    return options
}

/**
 * 读取 meta 枚举选项，标签为“数值 id + 描述”，用于下拉框展示。
 * @param datasets 已预加载的 meta 数据集。
 * @param datasetName 数据集名称，对应 Data/Meta 下的文件名（不含扩展名）。
 */
export function getMetaEnumOptions(datasets: JsonDataset[], datasetName: string): MetaEnumOption[] {
    return getMetaEnumRawOptions(datasets, datasetName).map(option => ({
        ...option,
        label: `${option.id} ${option.label}`,
    }))
}

/**
 * 读取数值在 meta 数据集中的描述文本，用于表格与只读展示。
 * @param datasets 已预加载的 meta 数据集。
 * @param datasetName 数据集名称，对应 Data/Meta 下的文件名（不含扩展名）。
 * @param value 待查询的字段值，仅支持数值与纯数字字符串。
 * @returns 描述文本；数据集缺失或数值无对应描述时返回 null。
 */
export function getMetaEnumLabel(datasets: JsonDataset[], datasetName: string, value: JsonValue): string | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    const id = typeof value === 'number' ? value : Number(value.trim())
    if (!Number.isFinite(id)) return null
    return getMetaEnumRawOptions(datasets, datasetName).find(option => option.id === id)?.label ?? null
}

/** 一条字符串型 meta 枚举选项：值为字符串 id，标签为策划填写的中文描述。 */
export interface MetaStringOption {
    /** 选项值与字段当前值，例如 SkillAttack。 */
    value: string
    /** 选项显示文本。 */
    label: string
}

/**
 * 读取字符串型 meta 枚举选项，用于 SkillAttackScriptType 这类以字符串为 id 的枚举。
 * id 字段按 Id/ID 顺序识别，描述字段按 Desc/TypeName 顺序识别，与数值枚举保持同一套命名约定。
 * @param datasets 已预加载的 meta 数据集。
 * @param datasetName 数据集名称，对应 Data/Meta 下的文件名（不含扩展名）。
 */
export function getMetaStringOptions(datasets: JsonDataset[], datasetName: string): MetaStringOption[] {
    const dataset = datasets.find(item => item.name === datasetName)
    if (!dataset) return []

    const options: MetaStringOption[] = []
    const seen = new Set<string>()
    for (const record of dataset.records) {
        let id: string | null = null
        let label: string | null = null
        for (const idField of META_STRING_ID_FIELDS) {
            for (const labelField of META_LABEL_FIELDS) {
                if (idField === labelField) continue
                if (typeof record.data[idField] === 'string' && typeof record.data[labelField] === 'string') {
                    id = record.data[idField] as string
                    label = record.data[labelField] as string
                    break
                }
            }
            if (id !== null) break
        }
        if (id === null || label === null) continue
        if (seen.has(id)) continue
        seen.add(id)
        options.push({ value: id, label: `${id} ${label}` })
    }
    return options
}

/** Data/Meta 中各枚举数据集的名称。 */
export const META_DATASET_NAMES = {
    attackType: 'AttackType',
    staticSkillType: 'StaticSkillType',
    guideType: 'GuideType',
    buffType: 'BuffType',
    buffOverlayType: 'BuffOverlayType',
    buffTriggerType: 'BuffTriggerType',
    buffRemoveTriggerType: 'BuffRemoveTriggerType',
    skillQuality: 'SkillQuality',
    itemType: 'ItemType',
    itemQualityType: 'ItemQualityType',
    itemPhaseType: 'ItemPhaseType',
    itemShopType: 'ItemShopType',
    skillAttackScriptType: 'SkillAttackScriptType',
    itemGuideType: 'ItemGuideType',
    skillConsultType: 'SkillConsultType',
    itemUseType: 'ItemUseType',
    itemUseSeidMeta: 'ItemUseSeidMeta',
    itemEquipSeidMeta: 'ItemEquipSeidMeta',
    createAvatarSeidMeta: 'CreateAvatarSeidMeta',
    skillPhase: 'SkillPhase',
    skillSeidMeta: 'SkillSeidMeta',
    staticSkillSeidMeta: 'StaticSkillSeidMeta',
    buffSeidMeta: 'BuffSeidMeta',
    levelType: 'LevelType',
    elementType: 'ElementType',
} as const

/**
 * 各分组中需要渲染为 Data/Meta 枚举的字段：分组 -> 字段名 -> 数据集名称。
 * 数据表格与 JSON 编辑器共用同一份映射，避免两处配置漂移。
 */
export const GROUP_META_ENUM_FIELDS: Partial<Record<ProjectModGroupKey, Record<string, string>>> = {
    buff: {
        bufftype: META_DATASET_NAMES.buffType,
        BuffType: META_DATASET_NAMES.buffOverlayType,
        trigger: META_DATASET_NAMES.buffTriggerType,
        removeTrigger: META_DATASET_NAMES.buffRemoveTriggerType,
        seid: META_DATASET_NAMES.buffSeidMeta,
    },
    item: {
        type: META_DATASET_NAMES.itemType,
        quality: META_DATASET_NAMES.itemQualityType,
        typePinJie: META_DATASET_NAMES.itemPhaseType,
        ShopType: META_DATASET_NAMES.itemShopType,
        TuJianType: META_DATASET_NAMES.itemGuideType,
        WuWeiType: META_DATASET_NAMES.attackType,
        ShuXingType: META_DATASET_NAMES.elementType,
        seid: META_DATASET_NAMES.itemUseSeidMeta,
        Affix: META_DATASET_NAMES.itemEquipSeidMeta,
    },
    skill: {
        AttackType: META_DATASET_NAMES.staticSkillType,
        TuJianType: META_DATASET_NAMES.guideType,
        typePinJie: META_DATASET_NAMES.itemPhaseType,
        Skill_LV: META_DATASET_NAMES.skillQuality,
        qingjiaotype: META_DATASET_NAMES.skillConsultType,
        Skill_Type: META_DATASET_NAMES.skillPhase,
        seid: META_DATASET_NAMES.staticSkillSeidMeta,
        Affix: META_DATASET_NAMES.itemEquipSeidMeta,
    },
    shenTong: {
        AttackType: META_DATASET_NAMES.attackType,
        TuJianType: META_DATASET_NAMES.guideType,
        typePinJie: META_DATASET_NAMES.itemPhaseType,
        Skill_LV: META_DATASET_NAMES.skillQuality,
        qingjiaotype: META_DATASET_NAMES.skillConsultType,
        seid: META_DATASET_NAMES.skillSeidMeta,
        Affix2: META_DATASET_NAMES.itemEquipSeidMeta,
    },
    npcType: {
        Level: META_DATASET_NAMES.levelType,
    },
    npcWuDao: {
        lv: META_DATASET_NAMES.levelType,
    },
}

/**
 * 不依赖外部 Meta 文件的固定枚举字段。
 * 顺序按业务含义排列：是否参加拍卖用 0 表示“是”、1 表示“否”。
 */
export const GROUP_LOCAL_ENUM_FIELDS: Partial<Record<ProjectModGroupKey, Record<string, MetaEnumOption[]>>> = {
    npcType: {
        AvatarType: [
            { value: '1', label: '人', id: 1 },
            { value: '2', label: '妖', id: 2 },
            { value: '3', label: '魔', id: 3 },
            { value: '4', label: '鬼', id: 4 },
        ],
    },
}

/**
 * 读取字段对应的枚举选项：优先使用代码内固定枚举，其次读取 Data/Meta 数据集。
 * @param groupKey 当前分组 key。
 * @param field 字段名。
 * @param datasets 已预加载的 meta 数据集。
 */
export function getGroupEnumOptions(groupKey: ProjectModGroupKey | null, field: string, datasets: JsonDataset[]): MetaEnumOption[] {
    const localOptions = groupKey ? GROUP_LOCAL_ENUM_FIELDS[groupKey]?.[field] : undefined
    if (localOptions) return localOptions.map(option => ({ ...option, label: `${option.id} ${option.label}` }))
    const datasetName = groupKey ? GROUP_META_ENUM_FIELDS[groupKey]?.[field] : undefined
    return datasetName ? getMetaEnumOptions(datasets, datasetName) : []
}

/**
 * 读取字段值对应的枚举描述，用于表格只读展示。
 * @param groupKey 当前分组 key。
 * @param field 字段名。
 * @param value 字段值。
 * @param datasets 已预加载的 meta 数据集。
 */
export function getGroupEnumLabel(
    groupKey: ProjectModGroupKey | null,
    field: string,
    value: JsonValue,
    datasets: JsonDataset[]
): string | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    const id = typeof value === 'number' ? value : Number(value.trim())
    if (!Number.isFinite(id)) return null
    const localOptions = groupKey ? GROUP_LOCAL_ENUM_FIELDS[groupKey]?.[field] : undefined
    if (localOptions) return localOptions.find(option => option.id === id)?.label ?? null
    const datasetName = groupKey ? GROUP_META_ENUM_FIELDS[groupKey]?.[field] : undefined
    return datasetName ? getMetaEnumLabel(datasets, datasetName, id) : null
}

/**
 * 各分组记录中的图标字段名。
 * 分组与游戏数据的对应关系：buff -> BuffJsonData、item -> ItemJsonData、
 * shenTong -> skillJsonData（skill）、skill -> StaticSkillJsonData（staticskill）。
 */
export const GROUP_ICON_FIELDS: Partial<Record<ProjectModGroupKey, string>> = {
    buff: 'BuffIcon',
    item: 'ItemIcon',
    shenTong: 'icon',
    skill: 'icon',
    wuDao: 'icon',
}

/** 各分组图标在 Assets 下的子目录。 */
const GROUP_ICON_DIRECTORIES: Partial<Record<ProjectModGroupKey, string>> = {
    buff: 'buff icon',
    item: 'item icon',
    shenTong: 'skill icon',
    skill: 'staticskill icon',
    wuDao: 'wudao icon',
}

/** 功法与神通在 icon 为 0 时使用 Skill_ID 作为图标名。 */
const SKILL_ID_ICON_GROUPS = new Set<ProjectModGroupKey>(['skill', 'shenTong'])

/** mod 内图标所在的资源目录名。 */
const MOD_ICON_DIRECTORY = 'Assets'

function numericValue(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
}

/**
 * 解析记录在 Assets 下的图标相对路径。
 * icon 为 0 时：功法/神通使用 Skill_ID，其余分组使用 id/buffid；
 * icon 不为 0 时统一使用 icon 数值。
 */
function resolveModIconRelativePath(groupKey: ProjectModGroupKey, data: Record<string, JsonValue>): string | null {
    const iconField = GROUP_ICON_FIELDS[groupKey]
    const iconDirectory = GROUP_ICON_DIRECTORIES[groupKey]
    if (!iconField || !iconDirectory) return null

    const iconValue = numericValue(data[iconField])
    if (iconValue === null) return null

    let fileName: string | null = null
    if (iconValue !== 0) {
        fileName = `${iconValue}.png`
    } else if (SKILL_ID_ICON_GROUPS.has(groupKey)) {
        const skillId = numericValue(data.Skill_ID)
        if (skillId !== null) fileName = `${skillId}.png`
    } else {
        const identifierField = groupKey === 'buff' ? 'buffid' : 'id'
        const identifier = numericValue(data[identifierField])
        if (identifier !== null) fileName = `${identifier}.png`
    }

    return fileName ? `${iconDirectory}/${fileName}` : null
}

/**
 * 解析一条记录在 mod 的 Assets 对应分组目录中的图标相对路径。
 * @param modDirectory mod 文件夹相对项目根目录的路径，例如 plugins/Next/_/modDemo；也支持直接传 mod 文件夹名。
 * @param groupKey 当前分组 key。
 * @param data 记录数据。
 * @returns 以 / 分隔的相对路径；分组无图标字段或数值非法时返回 null。
 */
export function resolveModIconPath(
    modDirectory: string,
    groupKey: ProjectModGroupKey | null,
    data: Record<string, JsonValue>
): string | null {
    if (!groupKey) return null
    const directory = modDirectory.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!directory) return null
    const iconRelativePath = resolveModIconRelativePath(groupKey, data)
    if (!iconRelativePath) return null
    return `${directory}/${MOD_ICON_DIRECTORY}/${iconRelativePath}`
}

/**
 * 判断一条记录是否存在可用图标（分组有图标字段且图标值合法）。
 * 用于在编辑器与表格中决定是否展示图标预览。
 * @param groupKey 当前分组 key。
 * @param data 记录数据。
 */
export function hasModIcon(groupKey: ProjectModGroupKey | null, data: Record<string, JsonValue>): boolean {
    if (!groupKey) return false
    return resolveModIconRelativePath(groupKey, data) !== null
}

export interface RecordSelectOption {
    /** 用于下拉框比较的数值 id 字符串。 */
    value: string
    /** 记录的数值 id。 */
    id: number
    /** 包含 id 与名称的展示文本。 */
    label: string
}

/** 按神通 Skill_ID 合并同一技能的不同等级，优先使用最低等级记录作为展示名称。 */
export function getShenTongSkillSelectOptions(records: JsonRecord[]): RecordSelectOption[] {
    const bySkillId = new Map<number, { name: string; level: number }>()
    for (const record of records) {
        const skillId = numericValue(record.data.Skill_ID)
        if (skillId === null) continue
        const name = typeof record.data.name === 'string' ? record.data.name.trim() : ''
        const level = numericValue(record.data.Skill_Lv) ?? Number.MAX_SAFE_INTEGER
        const current = bySkillId.get(skillId)
        if (!current || level < current.level) bySkillId.set(skillId, { name, level })
    }
    return Array.from(bySkillId.entries())
        .sort(([left], [right]) => left - right)
        .map(([skillId, item]) => ({
            value: String(skillId),
            id: skillId,
            label: item.name ? `${skillId} ${item.name}` : String(skillId),
        }))
}

/**
 * 将已加载的 JSON 记录转换为选择器选项，优先使用 data.id，其次使用数值化的记录 key。
 * 重复 id 只保留第一条，避免 mod 预加载与项目数据同时存在时出现重复选项。
 */
export function getRecordSelectOptions(records: JsonRecord[]): RecordSelectOption[] {
    const options: RecordSelectOption[] = []
    const seen = new Set<number>()
    for (const record of records) {
        const id = numericValue(record.data.id) ?? numericValue(record.key)
        if (id === null || seen.has(id)) continue
        seen.add(id)
        const name = typeof record.data.name === 'string' ? record.data.name.trim() : ''
        options.push({ value: String(id), id, label: name ? `${id} ${name}` : String(id) })
    }
    return options
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
    /** mod 文件夹相对项目根目录的路径（以 / 分隔）。 */
    modDirectory: string
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
    const modDirectory = parts.slice(0, modIndex + 1).join('/')
    const rest = parts.slice(modIndex + 1)

    if (rest[0] === 'Config' && rest[1] === 'modConfig.json') {
        return { modName, modDirectory, groupKey: 'config' }
    }

    if (rest[0] !== 'Data') return null

    const tail = rest[rest.length - 1] || ''
    if (rest[1] === 'BuffJsonData' && tail.endsWith('.json')) return { modName, modDirectory, groupKey: 'buff' }
    if (rest[1] === 'ItemJsonData' && tail.endsWith('.json')) return { modName, modDirectory, groupKey: 'item' }
    if (rest[1] === 'skillJsonData' && tail.endsWith('.json')) return { modName, modDirectory, groupKey: 'shenTong' }
    if (rest[1] === 'StaticSkillJsonData.json') return { modName, modDirectory, groupKey: 'skill' }
    if (rest[1] === 'NPCLeiXingDate.json') return { modName, modDirectory, groupKey: 'npcType' }
    if (rest[1] === 'NPCWuDaoJson.json') return { modName, modDirectory, groupKey: 'npcWuDao' }
    if (rest[1] === 'WuDaoAllTypeJson.json') return { modName, modDirectory, groupKey: 'wuDaoAllType' }
    if (rest[1] === 'WuDaoJson.json') return { modName, modDirectory, groupKey: 'wuDao' }
    if (rest[1] === 'TuJianChunWenBen.json') return { modName, modDirectory, groupKey: 'tuJianChunWenBen' }
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

interface ProjectSeidFileMatch {
    modName: string
    modDirectory: string
    dataKey: SeidDataKey
    seidId: string
}

const SEID_DATA_DIRECTORIES: Record<string, SeidDataKey> = {
    BuffSeidJsonData: 'buff',
    SkillSeidJsonData: 'skill',
    StaticSkillSeidJsonData: 'staticSkill',
    ItemsSeidJsonData: 'itemUse',
    EquipSeidJsonData: 'itemEquip',
}

/** Match a JSON file under one of the *SeidJsonData directories. */
function matchProjectSeidFile(parts: string[]): ProjectSeidFileMatch | null {
    const modIndex = parts.findIndex(part => part.startsWith('mod'))
    if (modIndex < 0) return null

    const modName = parts[modIndex] || 'unnamed-mod'
    const modDirectory = parts.slice(0, modIndex + 1).join('/')
    const rest = parts.slice(modIndex + 1)
    if (rest[0] !== 'Data') return null

    const dataKey = SEID_DATA_DIRECTORIES[rest[1] ?? '']
    const fileName = rest[rest.length - 1] ?? ''
    if (!dataKey || !fileName.toLowerCase().endsWith('.json')) return null
    return {
        modName,
        modDirectory,
        dataKey,
        seidId: fileName.replace(/\.json$/i, ''),
    }
}

/** Parse one Seid file while preserving an empty map as an empty config file. */
function parseSeidFileContent(content: string): Record<string, Record<string, JsonValue>> {
    const parsed: unknown = parseJsonText(content)
    if (!isRecordObject(parsed)) throw new Error('Seid JSON top level must be an object')
    const result: Record<string, Record<string, JsonValue>> = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (!isRecordObject(value)) throw new Error(`Seid record ${key} must be an object`)
        result[key] = value
    }
    return result
}

/**
 * 将 Tauri 原生目录选择得到的 JSON 文件条目解析为项目结构。
 * 识别 plugins/Next 下的 modXXX，并按 BuffJsonData/ItemJsonData/skillJsonData 的目录结构合并数据。
 */
export async function parseProjectFromEntries(rootPath: string, entries: ProjectFileEntry[]): Promise<ProjectData> {
    const projectName = projectNameFromPath(rootPath)
    const grouped = new Map<string, Map<ProjectModGroupKey, ProjectFileEntry[]>>()
    const modDirectories = new Map<string, string>()
    const seidDataByMod = new Map<string, ProjectSeidData>()

    for (const entry of entries) {
        const parts = entry.relativePath.split('/').filter(Boolean)
        const match = matchProjectFile(parts)
        if (match) {
            const modMap = grouped.get(match.modName) ?? new Map<ProjectModGroupKey, ProjectFileEntry[]>()
            const bucket = modMap.get(match.groupKey) ?? []
            bucket.push(entry)
            modMap.set(match.groupKey, bucket)
            grouped.set(match.modName, modMap)
            modDirectories.set(match.modName, match.modDirectory)
            continue
        }

        const seidMatch = matchProjectSeidFile(parts)
        if (!seidMatch) continue
        const seidData = seidDataByMod.get(seidMatch.modName) ?? {}
        const fileData = seidData[seidMatch.dataKey] ?? {}
        fileData[seidMatch.seidId] = parseSeidFileContent(entry.content)
        seidData[seidMatch.dataKey] = fileData
        seidDataByMod.set(seidMatch.modName, seidData)
        grouped.set(seidMatch.modName, grouped.get(seidMatch.modName) ?? new Map<ProjectModGroupKey, ProjectFileEntry[]>())
        modDirectories.set(seidMatch.modName, seidMatch.modDirectory)
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
                def.key === 'wuDaoAllType' ||
                def.key === 'wuDao' ||
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

        mods.push({
            id: createDatasetId(modName),
            name: modName,
            directory: modDirectories.get(modName),
            seidData: seidDataByMod.get(modName),
            groups,
        })
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

/** 读取 Meta 记录用于跨来源合并的业务 ID。 */
function getMetaRecordIdentity(data: Record<string, JsonValue>): string | null {
    for (const field of META_ID_FIELDS) {
        const value = data[field]
        if (typeof value === 'number') return String(value)
    }
    for (const field of META_STRING_ID_FIELDS) {
        const value = data[field]
        if (typeof value === 'string') return value
    }
    return null
}

/**
 * 合并多个 Meta 来源中同名的数据集。
 * 数据集按首次出现顺序保留，记录按业务 ID 去重；同名记录由后加载的数据覆盖，
 * 无法识别业务 ID 的记录全部保留。
 */
export function mergeMetaDatasets(datasets: JsonDataset[]): JsonDataset[] {
    const mergedDatasets = new Map<string, JsonDataset>()

    for (const dataset of datasets) {
        const existing = mergedDatasets.get(dataset.name)
        if (!existing) {
            mergedDatasets.set(dataset.name, { ...dataset, records: [...dataset.records] })
            continue
        }

        const recordIndexes = new Map<string, number>()
        existing.records.forEach((record, index) => {
            const identity = getMetaRecordIdentity(record.data)
            if (identity !== null) recordIndexes.set(identity, index)
        })
        const records = [...existing.records]
        for (const record of dataset.records) {
            const identity = getMetaRecordIdentity(record.data)
            const existingIndex = identity === null ? undefined : recordIndexes.get(identity)
            if (existingIndex === undefined) {
                if (identity !== null) recordIndexes.set(identity, records.length)
                records.push(record)
            } else {
                records[existingIndex] = record
            }
        }
        mergedDatasets.set(dataset.name, { ...existing, records })
    }

    return [...mergedDatasets.values()]
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
function recordsToMap(groupKey: ProjectModGroupKey, records: JsonRecord[]): Record<string, JsonValue> {
    const map: Record<string, JsonValue> = {}
    for (const record of records) {
        map[record.key] = normalizeRecordData(groupKey, record.data, record.key)
    }
    return map
}

/** 单个文件承载全部分组数据的分组（config/skill/npcType/npcWuDao/wuDaoAllType/wuDao/tuJianChunWenBen）。 */
const SINGLE_FILE_GROUPS = new Set<ProjectModGroupKey>([
    'config',
    'skill',
    'npcType',
    'npcWuDao',
    'wuDaoAllType',
    'wuDao',
    'tuJianChunWenBen',
])

/** 每个分组的原始文件位置，用于将编辑结果写回原文件。 */
function modDirectoryName(modName: string): string {
    return modName.startsWith('mod') ? modName : `mod_${modName}`
}

const GROUP_FILE_PATHS: Partial<Record<ProjectModGroupKey, (modName: string, recordKey: string) => string>> = {
    buff: (modName, recordKey) => `plugins/Next/_/${modDirectoryName(modName)}/Data/BuffJsonData/${recordKey}.json`,
    item: (modName, recordKey) => `plugins/Next/_/${modDirectoryName(modName)}/Data/ItemJsonData/${recordKey}.json`,
    shenTong: (modName, recordKey) => `plugins/Next/_/${modDirectoryName(modName)}/Data/skillJsonData/${recordKey}.json`,
}

/** 解析目录型分组中单条记录对应的项目相对路径，用于新增、覆盖和删除文件。 */
export function resolveProjectRecordRelativePath(modName: string, groupKey: ProjectModGroupKey, recordKey: string): string | null {
    const resolve = GROUP_FILE_PATHS[groupKey]
    return resolve ? resolve(modName, recordKey) : null
}

/** 单文件分组的固定路径。 */
const SINGLE_FILE_PATHS: Partial<Record<ProjectModGroupKey, (modName: string) => string>> = {
    config: modName => `plugins/Next/_/${modDirectoryName(modName)}/Config/modConfig.json`,
    skill: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/StaticSkillJsonData.json`,
    npcType: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/NPCLeiXingDate.json`,
    npcWuDao: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/NPCWuDaoJson.json`,
    wuDaoAllType: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/WuDaoAllTypeJson.json`,
    wuDao: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/WuDaoJson.json`,
    tuJianChunWenBen: modName => `plugins/Next/_/${modDirectoryName(modName)}/Data/TuJianChunWenBen.json`,
}

/** Directory names used by the five Seid config data types. */
const SEID_FILE_DIRECTORIES: Record<SeidDataKey, string> = {
    buff: 'BuffSeidJsonData',
    skill: 'SkillSeidJsonData',
    staticSkill: 'StaticSkillSeidJsonData',
    itemUse: 'ItemsSeidJsonData',
    itemEquip: 'EquipSeidJsonData',
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
                writes.push({ relativePath: resolve(mod.name), content: stringifyJson(recordsToMap(group.key, group.records)) })
                continue
            }

            const resolveRecord = GROUP_FILE_PATHS[group.key]
            if (!resolveRecord) continue
            for (const record of group.records) {
                writes.push({
                    relativePath: resolveRecord(mod.name, record.key),
                    content: stringifyJson(normalizeRecordData(group.key, record.data, record.key)),
                })
            }
        }

        for (const dataKey of Object.keys(mod.seidData ?? {}) as SeidDataKey[]) {
            const fileData = mod.seidData?.[dataKey]
            if (!fileData) continue
            for (const [seidId, records] of Object.entries(fileData)) {
                writes.push({
                    relativePath: `plugins/Next/_/${modDirectoryName(mod.name)}/Data/${SEID_FILE_DIRECTORIES[dataKey]}/${seidId}.json`,
                    content: stringifyJson(records),
                })
            }
        }
    }

    return writes
}
