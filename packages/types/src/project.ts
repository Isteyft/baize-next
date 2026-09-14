/**
 * 项目结构、JSON 通用类型定义。
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

/** mod 下可识别的数据分组键。 */
export type ProjectModGroupKey = 'config' | 'buff' | 'item' | 'skill' | 'shenTong' | 'npcType' | 'npcWuDao'

/** mod 下的一个数据分组。 */
export interface ProjectModGroup {
    /** 分组唯一键。 */
    key: ProjectModGroupKey
    /** 分组展示名称，例如 “buff”“物品”。 */
    label: string
    /** 分组内记录。 */
    records: JsonRecord[]
}

/** 单个 mod（modXXX）。 */
export interface ProjectMod {
    /** mod 唯一 id。 */
    id: string
    /** mod 文件夹名，例如 modXXX。 */
    name: string
    /** mod 下的数据分组。 */
    groups: ProjectModGroup[]
}

/** 一个已打开的项目。 */
export interface ProjectData {
    /** 项目唯一 id。 */
    id: string
    /** 项目根目录名。 */
    name: string
    /** 项目下所有 mod。 */
    mods: ProjectMod[]
}
