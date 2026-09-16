import { translateField } from '@baize-next/i18n'
import type { JsonDataset, JsonRecord, JsonValue, ProjectModGroupKey, ProjectSeidData, SeidDataKey } from '@baize-next/types'
import { useState } from 'react'

import {
    getAffixProjectTypeOptions,
    getAffixSelectOptions,
    getAffixTypeOptions,
    getGroupEnumOptions,
    getMetaStringOptions,
    GROUP_ICON_FIELDS,
    hasModIcon,
    META_DATASET_NAMES,
    resolveModIconPath,
} from '../utils/json'
import { isSeidProjectGroup, type SeidDrawerRecords } from '../utils/seid'
import { AffixSelect } from './AffixSelect'
import { AssetIcon } from './AssetIcon'
import { ScrollArea } from './ScrollArea'
import { SeidEditor } from './SeidEditor'
import { Select, type SelectOption } from './Select'

interface JsonEditorProps {
    /** 当前分组 key，用于字段 i18n 映射。 */
    groupKey: ProjectModGroupKey | null
    /** 当前选中记录，未选中时为 null。 */
    record: JsonRecord | null
    metaDatasets?: JsonDataset[]
    affixRecords?: JsonRecord[]
    /** 当前 mod 文件夹相对项目根目录的路径，用于解析 Assets 下的图标。 */
    modDirectory?: string | null
    /** 读取 mod 资源并返回可展示的 data URL。 */
    readAsset?: ((relativePath: string) => Promise<string | null>) | undefined
    /** 字段变更回调，实时回写表格。 */
    /** Current mod Seid parameter data. */
    seidData?: ProjectSeidData
    /** Records used by Seid SpecialDrawer selectors. */
    seidRecords?: SeidDrawerRecords
    onUpdate: (recordKey: string, field: string, value: JsonValue) => void
    /** Callback for Seid parameter changes. */
    onUpdateSeidData?: (dataKey: SeidDataKey, seidId: string, targetKey: string, value: Record<string, JsonValue> | null) => void
}

const EMPTY_SEID_RECORDS: SeidDrawerRecords = {
    buff: [],
    skill: [],
    staticSkill: [],
    item: [],
}

const inputClass =
    'w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-subtle focus:border-accent focus:outline-none'

/** 可通过词缀选择器编辑的字段。 */
const AFFIX_FIELDS = new Set(['Affix', 'Affix2'])

/** 神通分组保留旧字符段但不展示，避免和 Affix2 混淆。 */
const LEGACY_AFFIX_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    shenTong: ['Affix'],
}

/** 图标字段优先移动到的编号字段。 */
const ICON_FIELD_ANCHORS = ['id', 'buffid']

/** 使用 0/1 复选框即可清晰表达的字段。 */
const BOOL_NUMBER_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    buff: ['isHide', 'ShowOnlyOne'],
    skill: ['DF'],
    shenTong: ['DF'],
}

/** 字符串型 Meta 枚举字段：分组 -> 字段名 -> 数据集名称。 */
const META_STRING_FIELDS: Partial<Record<ProjectModGroupKey, Record<string, string>>> = {
    shenTong: {
        script: META_DATASET_NAMES.skillAttackScriptType,
    },
}

const HIDDEN_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    tuJianChunWenBen: ['name1'],
}

function createArrayItemValue(values: JsonValue[]): JsonValue {
    const first = values[0]
    if (typeof first === 'string') return ''
    if (typeof first === 'number') return 0
    if (typeof first === 'boolean') return false
    if (first === null) return null
    if (typeof first === 'object') return JSON.parse(JSON.stringify(first)) as JsonValue
    return 0
}

function JsonArrayInput({ value, onChange }: { value: JsonValue[]; onChange: (value: JsonValue[]) => void }) {
    function handleAdd(): void {
        onChange([...value, createArrayItemValue(value)])
    }

    function handleRemove(index: number): void {
        onChange(value.filter((_, itemIndex) => itemIndex !== index))
    }

    function handleItemChange(index: number, next: JsonValue): void {
        onChange(value.map((item, itemIndex) => (itemIndex === index ? next : item)))
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-end">
                <button
                    type="button"
                    onClick={handleAdd}
                    title="添加数组项"
                    aria-label="添加数组项"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                    +
                </button>
            </div>
            {value.length === 0 ? (
                <p className="text-xs text-ink-subtle">暂无数组项</p>
            ) : (
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-line-strong text-ink-subtle">
                            <th className="pb-1 pr-2 text-xs font-medium">值</th>
                            <th className="w-14 pb-1 text-right text-xs font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {value.map((item, index) => (
                            <tr key={index} className="border-b border-line">
                                <td className="py-1.5 pr-2 align-top">
                                    <JsonFieldInput value={item} onChange={next => handleItemChange(index, next)} />
                                </td>
                                <td className="w-14 py-1.5 text-right align-top">
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(index)}
                                        aria-label={`移除第 ${index + 1} 项`}
                                        className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger hover:text-white"
                                    >
                                        移除
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

function JsonComplexInput({ value, onCommit }: { value: JsonValue; onCommit: (value: JsonValue) => void }) {
    const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
    const [error, setError] = useState<string | null>(null)

    function commit(): void {
        try {
            onCommit(JSON.parse(draft) as JsonValue)
            setError(null)
        } catch {
            setError('JSON 格式不正确')
        }
    }

    return (
        <>
            <textarea
                value={draft}
                rows={4}
                spellCheck={false}
                onChange={event => {
                    setDraft(event.target.value)
                    if (error) setError(null)
                }}
                onBlur={commit}
                className={`${inputClass} resize-y font-mono text-xs ${error ? 'border-danger' : ''}`}
            />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </>
    )
}

function JsonFieldInput({ value, onChange }: { value: JsonValue; onChange: (value: JsonValue) => void }) {
    if (Array.isArray(value)) {
        return <JsonArrayInput value={value} onChange={onChange} />
    }
    if (value === null) {
        return <input type="text" value="null" readOnly className={`${inputClass} opacity-60`} />
    }
    if (typeof value === 'string') {
        return <input type="text" value={value} onChange={event => onChange(event.target.value)} className={inputClass} />
    }
    if (typeof value === 'number') {
        return (
            <input
                type="number"
                value={value}
                onChange={event => {
                    const parsed = Number(event.target.value)
                    onChange(Number.isFinite(parsed) ? parsed : 0)
                }}
                className={inputClass}
            />
        )
    }
    if (typeof value === 'boolean') {
        return (
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-2.5">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={event => onChange(event.target.checked)}
                    className="h-4 w-4 accent-accent"
                />
                <span className="text-sm text-ink">{value ? 'true' : 'false'}</span>
            </label>
        )
    }
    return <JsonComplexInput value={value} onCommit={onChange} />
}

interface JsonEnumInputProps {
    value: JsonValue
    options: SelectOption<string>[]
    label: string
    multiple?: boolean
    onSelect: (value: string) => void
}

function enumValueOf(value: JsonValue): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    return ''
}

function enumAriaLabel(label: string, options: SelectOption<string>[], current: string, suffix = ''): string {
    const selected = options.find(option => option.value === current)
    const base = selected ? `${label}（${selected.label}）` : label
    return `${base}${suffix}`
}

function JsonEnumInput({ value, options, label, multiple = false, onSelect }: JsonEnumInputProps) {
    if (!multiple) {
        const current = enumValueOf(value)
        return (
            <Select
                value={current}
                options={options}
                onChange={onSelect}
                aria-label={enumAriaLabel(label, options, current)}
                className="w-full"
            />
        )
    }

    const values = Array.isArray(value) ? value : []
    return (
        <div className="space-y-2">
            {values.map((item, index) => {
                const current = enumValueOf(item)
                return (
                    <Select
                        key={index}
                        value={current}
                        options={options}
                        onChange={onSelect}
                        aria-label={enumAriaLabel(label, options, current, ` 第 ${index + 1} 项`)}
                        className="w-full"
                    />
                )
            })}
        </div>
    )
}

function JsonFlagInput({ value, label, onChange }: { value: JsonValue; label: string; onChange: (value: JsonValue) => void }) {
    const checked = value === 1
    return (
        <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-2.5 text-sm text-ink">
            <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                onChange={event => onChange(event.target.checked ? 1 : 0)}
                className="h-4 w-4 accent-accent"
            />
            <span>{checked ? '是' : '否'}</span>
        </label>
    )
}

export function JsonEditor({
    groupKey,
    record,
    metaDatasets = [],
    affixRecords = [],
    modDirectory = null,
    readAsset,
    seidData = {},
    seidRecords = EMPTY_SEID_RECORDS,
    onUpdate,
    onUpdateSeidData,
}: JsonEditorProps) {
    const [seidEditorOpen, setSeidEditorOpen] = useState(false)
    const hiddenFields = groupKey ? (HIDDEN_FIELDS[groupKey] ?? []) : []
    const legacyAffixFields = groupKey ? (LEGACY_AFFIX_FIELDS[groupKey] ?? []) : []
    const fields = record
        ? Object.keys(record.data).filter(field => !hiddenFields.includes(field) && !legacyAffixFields.includes(field))
        : []
    const iconField = groupKey ? GROUP_ICON_FIELDS[groupKey] : undefined
    const iconAnchorField =
        record && iconField ? (ICON_FIELD_ANCHORS.find(anchor => anchor !== iconField && record.data[anchor] !== undefined) ?? null) : null
    const iconPath =
        record && modDirectory && hasModIcon(groupKey, record.data) ? resolveModIconPath(modDirectory, groupKey, record.data) : null
    const seidGroupKey = record && groupKey && isSeidProjectGroup(groupKey) ? groupKey : null
    if (record && seidGroupKey && !fields.includes('seid')) fields.push('seid')

    function renderControl(field: string) {
        if (!record) return null
        const label = groupKey ? translateField(groupKey, field) : field
        const value = record.data[field]
        const isAffixField =
            groupKey !== null &&
            (groupKey === 'buff' || groupKey === 'item' || groupKey === 'skill' || groupKey === 'shenTong') &&
            AFFIX_FIELDS.has(field)
        const isFlagField = groupKey !== null && (BOOL_NUMBER_FIELDS[groupKey] ?? []).includes(field)
        const metaOptions = getGroupEnumOptions(groupKey, field, metaDatasets)
        const stringDatasetName = groupKey ? META_STRING_FIELDS[groupKey]?.[field] : undefined
        const stringOptions = stringDatasetName ? getMetaStringOptions(metaDatasets, stringDatasetName) : []
        let control = <JsonFieldInput value={value} onChange={next => onUpdate(record.key, field, next)} />
        const isSeidField = field === 'seid' && seidGroupKey !== null

        if (isSeidField) {
            const count = Array.isArray(value) ? value.length : 0
            control = (
                <button
                    type="button"
                    disabled={!onUpdateSeidData}
                    onClick={() => setSeidEditorOpen(true)}
                    className="flex w-full items-center justify-between rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <span>{'\u7f16\u8f91 Seid'}</span>
                    <span className="text-xs text-ink-subtle">
                        {count} {'\u9879'}
                    </span>
                </button>
            )
        } else if (isAffixField && Array.isArray(value)) {
            const options = getAffixSelectOptions(affixRecords)
            control = <AffixSelect value={value} options={options} label={label} onCommit={next => onUpdate(record.key, field, next)} />
        } else if (isFlagField) {
            control = <JsonFlagInput value={value} label={label} onChange={next => onUpdate(record.key, field, next)} />
        } else if (stringOptions.length > 0) {
            const current = enumValueOf(value)
            control = (
                <Select
                    value={current}
                    options={stringOptions}
                    onChange={next => onUpdate(record.key, field, next)}
                    aria-label={enumAriaLabel(label, stringOptions, current)}
                    className="w-full"
                />
            )
        } else if (metaOptions.length > 0) {
            const isArrayValue = Array.isArray(value)
            control = (
                <JsonEnumInput
                    value={value}
                    options={metaOptions}
                    label={label}
                    multiple={isArrayValue}
                    onSelect={next => {
                        const option = metaOptions.find(item => item.value === next)
                        if (!option) return
                        if (!isArrayValue) {
                            onUpdate(record.key, field, option.id)
                            return
                        }
                        const values = value as JsonValue[]
                        const selectedIndex = values.findIndex(item => enumValueOf(item) === next)
                        const nextValues =
                            selectedIndex >= 0 ? values.filter((_, itemIndex) => itemIndex !== selectedIndex) : [...values, option.id]
                        onUpdate(record.key, field, nextValues)
                    }}
                />
            )
        } else if (groupKey === 'tuJianChunWenBen' && field === 'typenum') {
            const options = getAffixProjectTypeOptions(metaDatasets)
            if (options.length > 0) {
                control = (
                    <JsonEnumInput
                        value={value}
                        options={options}
                        label={label}
                        onSelect={next => {
                            const option = options.find(item => item.value === next)
                            if (option) {
                                onUpdate(record.key, 'typenum', option.typeNum)
                                onUpdate(record.key, 'name1', option.typeName)
                            }
                        }}
                    />
                )
            }
        } else if (groupKey === 'tuJianChunWenBen' && field === 'type') {
            const options = getAffixTypeOptions(metaDatasets)
            if (options.length > 0) {
                control = (
                    <JsonEnumInput
                        value={value}
                        options={options}
                        label={label}
                        onSelect={next => {
                            const option = options.find(item => item.value === next)
                            if (option) onUpdate(record.key, 'type', option.typeId)
                        }}
                    />
                )
            }
        }
        return control
    }

    function renderIconPreview() {
        if (!record || !iconPath) return null
        const title = typeof record.data.name === 'string' ? record.data.name : String(record.key)
        return <AssetIcon path={iconPath} resolve={readAsset} title={title} />
    }

    function renderMovedIconField() {
        if (!record || !iconField) return null
        const label = groupKey ? translateField(groupKey, iconField) : iconField
        return (
            <div className="mt-3">
                <div className="mb-1.5">
                    <span className="block text-sm font-medium text-ink-soft">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">{renderControl(iconField)}</div>
                    {renderIconPreview()}
                </div>
            </div>
        )
    }

    return (
        <>
            <section className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-line bg-panel">
                <div className="shrink-0 border-b border-line px-3 py-2">
                    <h2 className="text-sm font-medium text-ink-muted">JSON 编辑</h2>
                </div>
                <ScrollArea className="flex-1" viewportClassName="h-full">
                    {record ? (
                        <div className="space-y-4 p-3">
                            {fields.map(field => {
                                const label = groupKey ? translateField(groupKey, field) : field
                                const isMovedIconField = iconField === field && iconAnchorField !== null
                                if (isMovedIconField) return null
                                const showMovedIcon = iconField !== undefined && iconAnchorField === field
                                const showInlineIcon = iconField === field && iconAnchorField === null
                                return (
                                    <div key={field}>
                                        <div className="mb-1.5">
                                            <span className="block text-sm font-medium text-ink-soft">{label}</span>
                                        </div>
                                        {renderControl(field)}
                                        {showMovedIcon ? renderMovedIconField() : null}
                                        {showInlineIcon ? <div className="mt-2">{renderIconPreview()}</div> : null}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center p-4 text-sm text-ink-subtle">
                            在左侧分组中选择一条 JSON 记录后编辑
                        </div>
                    )}
                </ScrollArea>
            </section>
            {record && seidGroupKey && onUpdateSeidData ? (
                <SeidEditor
                    open={seidEditorOpen}
                    groupKey={seidGroupKey}
                    record={record}
                    seidData={seidData}
                    metaDatasets={metaDatasets}
                    records={seidRecords}
                    onClose={() => setSeidEditorOpen(false)}
                    onUpdateRecord={onUpdate}
                    onUpdateSeidData={onUpdateSeidData}
                />
            ) : null}
        </>
    )
}
