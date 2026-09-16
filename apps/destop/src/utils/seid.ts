import type { JsonDataset, JsonRecord, JsonValue, ProjectModGroupKey, SeidDataKey } from '@baize-next/types'

import { getMetaEnumOptions, getMetaStringOptions } from './json'

/** Seid Meta 中描述的一个可填写属性。 */
export interface SeidMetaProperty {
    id: string
    type: string
    description: string
    drawers: string[]
}

/** 一条 Seid Meta 定义。 */
export interface SeidMetaDefinition {
    id: number
    name: string
    description: string
    idField: string
    properties: SeidMetaProperty[]
}

/** Seid 属性下拉选项。 */
export interface SeidOption {
    value: string
    label: string
    id: number | string
}

/** Seid 弹窗可用的记录数据源。 */
export interface SeidDrawerRecords {
    buff: JsonRecord[]
    skill: JsonRecord[]
    staticSkill: JsonRecord[]
    item: JsonRecord[]
}

/** 支持 Seid 编辑的主数据分组。 */
export type SeidProjectGroupKey = 'buff' | 'item' | 'skill' | 'shenTong' | 'wuDao'

const SEID_GROUPS = new Set<ProjectModGroupKey>(['buff', 'item', 'skill', 'shenTong', 'wuDao'])

const DRAWER_META_DATASETS: Record<string, string> = {
    ArithmeticOperatorTypeDrawer: 'ArithmeticOperatorType',
    AttackTypeArrayDrawer: 'AttackType',
    AttackTypeDrawer: 'AttackType',
    BuffRemoveTriggerTypeDrawer: 'BuffRemoveTriggerType',
    BuffTypeDrawer: 'BuffType',
    ComparisonOperatorTypeDrawer: 'ComparisonOperatorType',
    ElementTypeArrayDrawer: 'ElementType',
    ElementTypeDrawer: 'ElementType',
    LevelTypeDrawer: 'LevelType',
    TargetTypeDrawer: 'TargetType',
}

function numericValue(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
}

/** 判断主记录分组是否支持 Seid。 */
export function isSeidProjectGroup(groupKey: ProjectModGroupKey | null): groupKey is SeidProjectGroupKey {
    return groupKey !== null && SEID_GROUPS.has(groupKey)
}

/** 根据 item type 判断使用装备 Seid 还是使用型 Seid。 */
export function getItemSeidDataKey(data: Record<string, JsonValue>): Extract<SeidDataKey, 'itemUse' | 'itemEquip'> {
    const itemType = numericValue(data.type)
    return itemType === 0 || itemType === 1 || itemType === 2 ? 'itemEquip' : 'itemUse'
}

/** 主记录分组与数据共同决定 Seid 数据目录。 */
export function getSeidDataKey(groupKey: SeidProjectGroupKey, data: Record<string, JsonValue>): SeidDataKey {
    if (groupKey === 'buff') return 'buff'
    if (groupKey === 'shenTong') return 'skill'
    if (groupKey === 'skill' || groupKey === 'wuDao') return 'staticSkill'
    return getItemSeidDataKey(data)
}

/** 主记录分组与数据共同决定 Seid Meta 数据集。 */
export function getSeidMetaDatasetName(groupKey: SeidProjectGroupKey, data: Record<string, JsonValue>): string {
    const dataKey = getSeidDataKey(groupKey, data)
    if (dataKey === 'buff') return 'BuffSeidMeta'
    if (dataKey === 'skill') return 'SkillSeidMeta'
    if (dataKey === 'staticSkill') return 'StaticSkillSeidMeta'
    return dataKey === 'itemEquip' ? 'ItemEquipSeidMeta' : 'ItemUseSeidMeta'
}

function stringArray(value: JsonValue | undefined): string[] {
    if (typeof value === 'string') return [value]
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string')
}

/** 从 Meta 记录中解析 Seid 定义及属性。 */
export function getSeidDefinitions(datasets: JsonDataset[], datasetName: string): SeidMetaDefinition[] {
    const dataset = datasets.find(item => item.name === datasetName)
    if (!dataset) return []

    const definitions: SeidMetaDefinition[] = []
    const seen = new Set<number>()
    for (const record of dataset.records) {
        const id = numericValue(record.data.ID)
        if (id === null || seen.has(id)) continue
        seen.add(id)

        const properties: SeidMetaProperty[] = []
        if (Array.isArray(record.data.Properties)) {
            for (const item of record.data.Properties) {
                if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
                const idValue = item.ID
                const type = item.Type
                if (typeof idValue !== 'string' || typeof type !== 'string') continue
                properties.push({
                    id: idValue,
                    type,
                    description: typeof item.Desc === 'string' ? item.Desc : idValue,
                    drawers: stringArray(item.SpecialDrawer),
                })
            }
        }

        definitions.push({
            id,
            name: typeof record.data.Name === 'string' ? record.data.Name : String(id),
            description: typeof record.data.Desc === 'string' ? record.data.Desc : '',
            idField: typeof record.data.IDName === 'string' ? record.data.IDName : 'id',
            properties,
        })
    }
    return definitions
}

/** 根据分组和当前记录计算可选 Seid 定义。 */
export function getSeidDefinitionsForRecord(
    datasets: JsonDataset[],
    groupKey: SeidProjectGroupKey,
    data: Record<string, JsonValue>
): SeidMetaDefinition[] {
    return getSeidDefinitions(datasets, getSeidMetaDatasetName(groupKey, data))
}

/** 判断属性值是否为数组。 */
/** Filter Seid definitions by id, name and description. */
export function filterSeidDefinitions(definitions: SeidMetaDefinition[], query: string): SeidMetaDefinition[] {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return definitions
    return definitions.filter(definition =>
        [String(definition.id), definition.name, definition.description].some(value => value.toLowerCase().includes(keyword))
    )
}

export function isSeidArrayProperty(property: SeidMetaProperty): boolean {
    return property.type.endsWith('Array') || property.drawers.some(drawer => drawer.endsWith('ArrayDrawer'))
}

/** 创建属性默认值。 */
export function createSeidDefaultValue(property: SeidMetaProperty): JsonValue {
    if (isSeidArrayProperty(property)) return []
    if (property.type === 'Float' || property.type === 'Int') return 0
    return ''
}

/** 创建当前记录在一个 Seid 下的初始参数对象。 */
export function createSeidParameterRecord(definition: SeidMetaDefinition, targetKey: string): Record<string, JsonValue> {
    const targetId = numericValue(targetKey)
    const result: Record<string, JsonValue> = {
        [definition.idField]: targetId ?? targetKey,
    }
    for (const property of definition.properties) {
        result[property.id] = createSeidDefaultValue(property)
    }
    return result
}

function recordId(record: JsonRecord): number | string {
    const fields = ['id', 'buffid', 'Skill_ID']
    for (const field of fields) {
        const value = numericValue(record.data[field])
        if (value !== null) return value
    }
    const parsedKey = numericValue(record.key)
    return parsedKey ?? record.key
}

/** 将主记录列表转换成可直接展示的 Seid 选项。 */
export function getSeidRecordOptions(records: JsonRecord[]): SeidOption[] {
    const options: SeidOption[] = []
    const seen = new Set<string>()
    for (const record of records) {
        const id = recordId(record)
        const value = String(id)
        if (seen.has(value)) continue
        seen.add(value)
        const name =
            typeof record.data.name === 'string' ? record.data.name : typeof record.data.name2 === 'string' ? record.data.name2 : ''
        options.push({ id, value, label: name ? `${value} ${name}` : value })
    }
    return options
}

function getMetaDrawerOptions(datasets: JsonDataset[], drawer: string): SeidOption[] {
    const datasetName = DRAWER_META_DATASETS[drawer]
    if (!datasetName) return []
    const numeric = getMetaEnumOptions(datasets, datasetName).map(option => ({ id: option.id, value: option.value, label: option.label }))
    if (numeric.length > 0) return numeric
    return getMetaStringOptions(datasets, datasetName).map(option => ({ id: option.value, value: option.value, label: option.label }))
}

/** 根据 SpecialDrawer 解析一个 Seid 属性的选项来源。 */
export function getSeidPropertyOptions(
    property: SeidMetaProperty,
    datasets: JsonDataset[],
    records: SeidDrawerRecords,
    definitions: SeidMetaDefinition[]
): SeidOption[] {
    for (const drawer of property.drawers) {
        const metaOptions = getMetaDrawerOptions(datasets, drawer)
        if (metaOptions.length > 0) return metaOptions
        if (drawer.startsWith('Buff')) return getSeidRecordOptions(records.buff)
        if (drawer.startsWith('StaticSkill')) return getSeidRecordOptions(records.staticSkill)
        if (drawer.startsWith('Skill')) return getSeidRecordOptions(records.skill)
        if (drawer.startsWith('Item')) return getSeidRecordOptions(records.item)
        if (drawer.startsWith('Seid')) {
            return definitions.map(definition => ({
                id: definition.id,
                value: String(definition.id),
                label: `${definition.id} ${definition.name}`,
            }))
        }
    }
    return []
}

/** 判断属性是否应渲染为多选下拉。 */
export function isSeidMultiSelect(property: SeidMetaProperty, options: SeidOption[]): boolean {
    return options.length > 0 && isSeidArrayProperty(property)
}

/** 将当前 JSON 值转换成 Seid 选项的字符串值数组。 */
export function seidValuesToStrings(value: JsonValue): string[] {
    const values = Array.isArray(value) ? value : [value]
    return values.filter(item => typeof item === 'string' || typeof item === 'number').map(String)
}
