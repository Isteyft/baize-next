/**
 * JSON 数据模型定义。
 * 用于描述当前应用读取、展示与编辑的 JSON 结构。
 */

/** 可被 JSON 直接表示的原始值。 */
export type JsonPrimitive = string | number | boolean | null

/** JSON 值：原始值、数组或对象。 */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** 一条 JSON 记录，key 用作表格与编辑器的稳定标识。 */
export interface JsonRecord {
    /** 记录的键，通常来自对象键或 id 字段。 */
    key: string
    /** 记录的实际数据。 */
    data: Record<string, JsonValue>
}

/** 一个 JSON 数据集，可能来自单个 JSON 文件或一个 JSON 文件目录。 */
export interface JsonDataset {
    /** 数据集全局唯一 id。 */
    id: string
    /** 展示名称。 */
    name: string
    /** 数据来源类型。 */
    kind: 'file' | 'folder'
    /** 数据集内的所有记录。 */
    records: JsonRecord[]
}
