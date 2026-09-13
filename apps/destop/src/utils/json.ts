import type { JsonDataset, JsonRecord, JsonValue } from '../types/json'

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
 * 支持三种形态：
 * 1. 数组（每个元素为一条记录）；
 * 2. 记录映射（每个字段值为一条记录）；
 * 3. 单个对象（作为唯一一条记录）。
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
 * 将目录中的一个或多个 JSON 文件解析为一个数据集。
 * @param folderName 文件夹名称。
 * @param files 目录下的 JSON 文件。
 * @returns 合并后的数据集，每个文件对应一条记录。
 */
export async function parseFolderFiles(folderName: string, files: File[]): Promise<JsonDataset> {
    const records: JsonRecord[] = []

    for (const file of files) {
        const content = await readFileAsText(file)
        const parsed: unknown = JSON.parse(content)
        if (!isRecordObject(parsed)) {
            throw new Error(`文件 ${file.name} 不是对象，无法作为记录`)
        }
        records.push({ key: resolveRecordKey(parsed, file.name.replace(/\.json$/i, '')), data: parsed })
    }

    return { id: createDatasetId(folderName), name: folderName, kind: 'folder', records }
}

/**
 * 生成无碰撞的数据集 id。
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
 * 返回数据集内所有记录字段的并集，保持出现顺序。
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

/**
 * 将记录数据格式化为两空格缩进的 JSON 文本。
 * @param data 记录数据。
 */
export function formatRecordJson(data: Record<string, JsonValue>): string {
    return JSON.stringify(data, null, 2)
}
