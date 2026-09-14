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
    const parsed: unknown = JSON.parse(content)

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

    return null
}

/**
 * 将项目根目录下的文件列表解析为项目结构。
 * 识别 plugins/Next 下的 modXXX，并按需要汇总 BuffJsonData/ItemJsonData/skillJsonData。
 * @param files webkitdirectory 选出的项目文件。
 * @returns 解析后的项目结构。
 */
export async function parseProjectFromFiles(files: File[]): Promise<ProjectData> {
    const projectName = files[0]?.webkitRelativePath.split('/')[0] || '未命名项目'
    const grouped = new Map<string, Map<ProjectModGroupKey, File[]>>()

    for (const file of files) {
        if (!file.webkitRelativePath) continue
        const parts = file.webkitRelativePath.split('/').filter(Boolean)
        const match = matchProjectFile(parts)
        if (!match) continue

        const modMap = grouped.get(match.modName) ?? new Map<ProjectModGroupKey, File[]>()
        const bucket = modMap.get(match.groupKey) ?? []
        bucket.push(file)
        modMap.set(match.groupKey, bucket)
        grouped.set(match.modName, modMap)
    }

    const mods: ProjectMod[] = []
    for (const [modName, groupFiles] of grouped) {
        const groups: ProjectModGroup[] = []

        for (const def of PROJECT_GROUP_DEFS) {
            const bucket = groupFiles.get(def.key) ?? []
            const records: JsonRecord[] = []

            if (def.key === 'config' || def.key === 'skill' || def.key === 'npcType' || def.key === 'npcWuDao') {
                // 单文件记录映射类型
                for (const file of bucket) {
                    const content = await readFileAsText(file)
                    const dataset = parseJsonContent(file.name.replace(/\.json$/i, ''), content)
                    records.push(...dataset.records)
                }
            } else {
                // 目录下 1json1数据 类型，全部读取后合并为一组
                for (const file of bucket) {
                    const content = await readFileAsText(file)
                    const parsed: unknown = JSON.parse(content)
                    if (!isRecordObject(parsed)) {
                        throw new Error(`文件 ${file.name} 不是对象，无法作为记录`)
                    }
                    records.push({ key: resolveRecordKey(parsed, file.name.replace(/\.json$/i, '')), data: parsed })
                }
            }

            groups.push({ key: def.key, label: def.label, records })
        }

        mods.push({ id: createDatasetId(modName), name: modName, groups })
    }

    return { id: createDatasetId(projectName), name: projectName, mods }
}
