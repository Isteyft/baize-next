import { translateField } from '@baize-next/i18n'
import type { JsonDataset, JsonRecord, JsonValue, ProjectModGroupKey, ProjectSeidData, SeidDataKey } from '@baize-next/types'
import { useEffect, useMemo, useState } from 'react'

import { getDefaultRecordFieldValue, getRecordFieldNames } from '../utils/defaultRecordTemplates'
import {
    getAffixProjectTypeOptions,
    getAffixSelectOptions,
    getAffixTypeOptions,
    getGroupEnumOptions,
    getMetaStringOptions,
    getRecordSelectOptions,
    getShenTongSkillSelectOptions,
    GROUP_ICON_FIELDS,
    hasModIcon,
    META_DATASET_NAMES,
    type RecordSelectOption,
    resolveModIconPath,
} from '../utils/json'
import { isSeidProjectGroup, type SeidDrawerRecords } from '../utils/seid'
import { AffixSelect } from './AffixSelect'
import { AssetIcon } from './AssetIcon'
import { ScrollArea } from './ScrollArea'
import { SeidEditor } from './SeidEditor'
import { Select, type SelectOption } from './Select'

interface JsonEditorProps {
    /** 右侧编辑栏宽度（逻辑像素），缺省使用默认宽度 384。 */
    width?: number
    /** 当前分组 key，用于字段 i18n 映射。 */
    groupKey: ProjectModGroupKey | null
    /** 当前选中记录，未选中时为 null。 */
    record: JsonRecord | null
    metaDatasets?: JsonDataset[]
    affixRecords?: JsonRecord[]
    /** 当前已加载的神通记录，供 NPC 技能绑定选择。 */
    shenTongRecords?: JsonRecord[]
    /** 当前已加载的功法记录，供 NPC 功法绑定选择。 */
    skillRecords?: JsonRecord[]
    /** 当前已加载的悟道类型记录，供悟道的 Type 字段多选。 */
    wuDaoTypeRecords?: JsonRecord[]
    /** 当前已加载的悟道记录，供 NPC 悟道的悟道神通字段多选。 */
    wuDaoRecords?: JsonRecord[]
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
    item: ['CanSale', 'NPCCanUse'],
    skill: ['DF'],
    shenTong: ['DF'],
    npcType: ['canjiaPaiMai'],
}

/** 这些字段使用 0 表示勾选、 1 表示未勾选。 */
const INVERTED_BOOL_NUMBER_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    item: ['CanSale'],
    npcType: ['canjiaPaiMai'],
}

/** 描述类字段统一使用多行文本输入。 */
function isDescriptionField(field: string): boolean {
    return /desc/i.test(field)
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

function JsonArrayInput({ value, label, onChange }: { value: JsonValue[]; label: string; onChange: (value: JsonValue[]) => void }) {
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
                                    <JsonFieldInput
                                        label={`${label} ${index + 1}`}
                                        value={item}
                                        onChange={next => handleItemChange(index, next)}
                                    />
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

function JsonComplexInput({ value, label, onCommit }: { value: JsonValue; label: string; onCommit: (value: JsonValue) => void }) {
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
                aria-label={label}
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

function NumericTextInput({
    value,
    label,
    onChange,
    className = inputClass,
}: {
    value: number
    label: string
    onChange: (value: number) => void
    className?: string
}) {
    const [draft, setDraft] = useState(() => String(value))

    useEffect(() => {
        setDraft(String(value))
    }, [value])

    function handleChange(next: string): void {
        setDraft(next)
        if (next.trim() === '') return
        const parsed = Number(next)
        if (Number.isFinite(parsed)) onChange(parsed)
    }

    function handleBlur(): void {
        const parsed = Number(draft)
        if (draft.trim() === '' || !Number.isFinite(parsed)) {
            setDraft(String(value))
            return
        }
        setDraft(String(parsed))
        if (parsed !== value) onChange(parsed)
    }

    return (
        <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            value={draft}
            onChange={event => handleChange(event.target.value)}
            onBlur={handleBlur}
            className={className}
        />
    )
}

function JsonFieldInput({
    value,
    label,
    multiline = false,
    onChange,
}: {
    value: JsonValue
    label: string
    multiline?: boolean
    onChange: (value: JsonValue) => void
}) {
    if (Array.isArray(value)) {
        return <JsonArrayInput value={value} label={label} onChange={onChange} />
    }
    if (value === null) {
        return <input type="text" aria-label={label} value="null" readOnly className={`${inputClass} opacity-60`} />
    }
    if (typeof value === 'string') {
        if (multiline) {
            return (
                <textarea
                    aria-label={label}
                    value={value}
                    rows={4}
                    onChange={event => onChange(event.target.value)}
                    className={`${inputClass} resize-y`}
                />
            )
        }
        return (
            <input type="text" aria-label={label} value={value} onChange={event => onChange(event.target.value)} className={inputClass} />
        )
    }
    if (typeof value === 'number') {
        return <NumericTextInput value={value} label={label} onChange={onChange} />
    }
    if (typeof value === 'boolean') {
        return (
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-2.5">
                <input
                    type="checkbox"
                    aria-label={label}
                    checked={value}
                    onChange={event => onChange(event.target.checked)}
                    className="h-4 w-4 accent-accent"
                />
                <span className="text-sm text-ink">{value ? 'true' : 'false'}</span>
            </label>
        )
    }
    return <JsonComplexInput value={value} label={label} onCommit={onChange} />
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

function numericIds(value: JsonValue): number[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is number => typeof item === 'number')
}

function parseNumericIdsText(text: string): number[] {
    const result: number[] = []
    const seen = new Set<number>()
    for (const part of text.split(/[,，]/)) {
        const trimmed = part.trim()
        if (!trimmed) continue
        const value = Number(trimmed)
        if (!Number.isFinite(value) || seen.has(value)) continue
        seen.add(value)
        result.push(value)
    }
    return result
}

function selectedOptionLabels(value: JsonValue, options: { id: number; label: string }[]): string {
    const ids = Array.isArray(value) ? numericIds(value) : typeof value === 'number' ? [value] : []
    if (ids.length === 0) return '未选择'
    return ids.map(id => options.find(option => option.id === id)?.label ?? String(id)).join('、')
}

function SelectionInfo({ label, content }: { label: string; content: string }) {
    return (
        <span className="group relative inline-flex">
            <span
                tabIndex={0}
                aria-label={`查看${label}已选内容`}
                className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
            >
                ?
            </span>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-[110] mt-1 w-64 whitespace-pre-line break-words rounded-md border border-line-strong bg-raised px-3 py-2 text-xs text-ink-soft opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {content}
            </span>
        </span>
    )
}

function JsonMultiSelectDialog({
    value,
    options,
    label,
    optionColumnLabel = '名称',
    quickEdit = false,
    onChange,
}: {
    value: JsonValue
    options: { value: string; id: number; label: string }[]
    label: string
    optionColumnLabel?: string
    quickEdit?: boolean
    onChange: (value: JsonValue) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [draft, setDraft] = useState(() => numericIds(value).join(','))
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(numericIds(value)))
    const currentIds = numericIds(value)
    const keyword = query.trim().toLowerCase()
    const filtered = keyword ? options.filter(option => option.label.toLowerCase().includes(keyword)) : options
    const currentOptions = options.filter(option => selectedIds.has(option.id))
    const allChecked = options.length > 0 && options.every(option => selectedIds.has(option.id))

    useEffect(() => {
        const ids = numericIds(value)
        setSelectedIds(new Set(ids))
        setDraft(ids.join(','))
    }, [value])

    useEffect(() => {
        if (!open) return
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open])

    function toggle(id: number): void {
        setSelectedIds(previous => {
            const next = new Set(previous)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleAll(): void {
        setSelectedIds(previous => {
            const next = new Set(previous)
            if (allChecked) {
                for (const option of options) next.delete(option.id)
            } else {
                for (const option of options) next.add(option.id)
            }
            return next
        })
    }

    function commit(): void {
        const knownIds = new Set(options.map(option => option.id))
        const next = currentIds.filter(id => !knownIds.has(id))
        for (const option of options) {
            if (selectedIds.has(option.id)) next.push(option.id)
        }
        onChange(next)
        setOpen(false)
    }

    function commitQuickEdit(): void {
        const next = parseNumericIdsText(draft)
        setDraft(next.join(','))
        onChange(next)
    }

    const summary =
        selectedIds.size > 0
            ? `${selectedIds.size} 项：${currentOptions
                  .slice(0, 3)
                  .map(option => option.label)
                  .join('、')}`
            : '未选择'

    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => setOpen(true)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hover focus:outline-none"
            >
                <span className={selectedIds.size > 0 ? 'truncate text-ink' : 'text-ink-subtle'}>{summary}</span>
                <span aria-hidden="true" className="shrink-0 text-ink-muted">
                    选择
                </span>
            </button>
            {quickEdit ? (
                <input
                    type="text"
                    aria-label={`快速编辑${label}`}
                    value={draft}
                    placeholder="用逗号分隔 ID"
                    onChange={event => setDraft(event.target.value)}
                    onBlur={commitQuickEdit}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            event.currentTarget.blur()
                        } else if (event.key === 'Escape') {
                            setDraft(numericIds(value).join(','))
                        }
                    }}
                    className={`${inputClass} mt-2 font-mono text-xs`}
                />
            ) : null}
            {open ? (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setOpen(false)
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                        className="flex max-h-[78vh] w-[min(820px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-line-strong bg-base shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3">
                            <h2 className="min-w-0 truncate text-sm font-medium text-ink-soft">{label}</h2>
                            <button
                                type="button"
                                aria-label="关闭"
                                onClick={() => setOpen(false)}
                                className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                            >
                                X
                            </button>
                        </header>
                        <div className="shrink-0 border-b border-line bg-panel p-3">
                            <input
                                type="search"
                                aria-label={`搜索${label}`}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder="搜索 id / 名称"
                                className={inputClass}
                            />
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto bg-panel">
                            {filtered.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-ink-subtle">没有匹配项</p>
                            ) : (
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead className="sticky top-0 bg-raised text-ink-muted">
                                        <tr>
                                            <th className="w-14 border-b border-line-strong px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`全选${label}`}
                                                    checked={allChecked}
                                                    onChange={toggleAll}
                                                    className="h-4 w-4 accent-accent"
                                                />
                                            </th>
                                            <th className="w-32 border-b border-line-strong px-3 py-2 text-xs font-medium">ID</th>
                                            <th className="border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {optionColumnLabel}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(option => {
                                            const checked = selectedIds.has(option.id)
                                            const name = option.label.startsWith(`${option.id} `)
                                                ? option.label.slice(String(option.id).length + 1)
                                                : option.label
                                            return (
                                                <tr
                                                    key={option.value}
                                                    onClick={() => toggle(option.id)}
                                                    className={`cursor-pointer border-b border-line transition-colors ${
                                                        checked ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'
                                                    }`}
                                                >
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`选择 ${option.label}`}
                                                            checked={checked}
                                                            onClick={event => event.stopPropagation()}
                                                            onChange={() => toggle(option.id)}
                                                            className="h-4 w-4 accent-accent"
                                                        />
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{option.id}</td>
                                                    <td className="px-3 py-2">{name}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-panel px-4 py-3">
                            <span className="text-xs text-ink-subtle">已选择 {selectedIds.size} 项</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-hover hover:text-ink"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={commit}
                                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                                >
                                    确定
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            ) : null}
        </>
    )
}

function JsonRecordSingleSelectDialog({
    value,
    options,
    label,
    onChange,
}: {
    value: JsonValue
    options: RecordSelectOption[]
    label: string
    onChange: (value: JsonValue) => void
}) {
    const current = typeof value === 'number' && Number.isFinite(value) ? value : 0
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedId, setSelectedId] = useState(current)
    const selectOptions = [...(options.some(option => option.id === 0) ? options : [{ value: '0', id: 0, label: '0 无' }, ...options])]
    if (!selectOptions.some(option => option.id === current)) {
        selectOptions.unshift({ value: String(current), id: current, label: String(current) })
    }
    const selectedOption = selectOptions.find(option => option.id === current)
    const pendingOption = selectOptions.find(option => option.id === selectedId)
    const keyword = query.trim().toLowerCase()
    const filtered = keyword ? selectOptions.filter(option => option.label.toLowerCase().includes(keyword)) : selectOptions

    useEffect(() => {
        setSelectedId(current)
    }, [current, value])

    useEffect(() => {
        if (!open) return
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open])

    function commit(): void {
        onChange(selectedId)
        setOpen(false)
    }

    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => setOpen(true)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hover focus:outline-none"
            >
                <span className="truncate">{selectedOption?.label ?? String(current)}</span>
                <span aria-hidden="true" className="shrink-0 text-ink-muted">
                    选择
                </span>
            </button>
            {open ? (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setOpen(false)
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                        className="flex max-h-[78vh] w-[min(820px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-line-strong bg-base shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3">
                            <h2 className="min-w-0 truncate text-sm font-medium text-ink-soft">{label}</h2>
                            <button
                                type="button"
                                aria-label="关闭"
                                onClick={() => setOpen(false)}
                                className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                            >
                                X
                            </button>
                        </header>
                        <div className="shrink-0 border-b border-line bg-panel p-3">
                            <input
                                type="search"
                                aria-label={`搜索${label}`}
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder="搜索 id / 名称"
                                className={inputClass}
                            />
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto bg-panel">
                            {filtered.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-ink-subtle">没有匹配项</p>
                            ) : (
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead className="sticky top-0 bg-raised text-ink-muted">
                                        <tr>
                                            <th className="w-14 border-b border-line-strong px-3 py-2 text-xs font-medium">选择</th>
                                            <th className="w-32 border-b border-line-strong px-3 py-2 text-xs font-medium">ID</th>
                                            <th className="border-b border-line-strong px-3 py-2 text-xs font-medium">名称</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(option => (
                                            <tr
                                                key={option.value}
                                                onClick={() => setSelectedId(option.id)}
                                                className={`cursor-pointer border-b border-line transition-colors ${
                                                    selectedId === option.id ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'
                                                }`}
                                            >
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="radio"
                                                        name={`single-select-${label}`}
                                                        aria-label={`选择 ${option.label}`}
                                                        checked={selectedId === option.id}
                                                        onClick={event => event.stopPropagation()}
                                                        onChange={() => setSelectedId(option.id)}
                                                        className="h-4 w-4 accent-accent"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{option.id}</td>
                                                <td className="px-3 py-2">
                                                    {option.label.startsWith(`${option.id} `)
                                                        ? option.label.slice(String(option.id).length + 1)
                                                        : option.label}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-panel px-4 py-3">
                            <span className="text-xs text-ink-subtle">已选择 {pendingOption?.label ?? String(selectedId)}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-hover hover:text-ink"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={commit}
                                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                                >
                                    确定
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            ) : null}
        </>
    )
}

function JsonFlagInput({
    value,
    label,
    inverted = false,
    onChange,
}: {
    value: JsonValue
    label: string
    inverted?: boolean
    onChange: (value: JsonValue) => void
}) {
    const checked = inverted ? value === 0 : value === 1
    return (
        <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-2.5 text-sm text-ink">
            <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                onChange={event => onChange(event.target.checked ? (inverted ? 0 : 1) : inverted ? 1 : 0)}
                className="h-4 w-4 accent-accent"
            />
            <span>{checked ? '是' : '否'}</span>
        </label>
    )
}

export function JsonEditor({
    width = 384,
    groupKey,
    record,
    metaDatasets = [],
    affixRecords = [],
    shenTongRecords = [],
    skillRecords = [],
    wuDaoTypeRecords = [],
    wuDaoRecords = [],
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
        ? getRecordFieldNames(groupKey, record.data).filter(field => !hiddenFields.includes(field) && !legacyAffixFields.includes(field))
        : []
    const iconField = groupKey ? GROUP_ICON_FIELDS[groupKey] : undefined
    const iconAnchorField =
        record && iconField ? (ICON_FIELD_ANCHORS.find(anchor => anchor !== iconField && record.data[anchor] !== undefined) ?? null) : null
    const iconPath =
        record && modDirectory && hasModIcon(groupKey, record.data) ? resolveModIconPath(modDirectory, groupKey, record.data) : null
    const shenTongOptions = useMemo(() => getShenTongSkillSelectOptions(shenTongRecords), [shenTongRecords])
    const skillOptions = useMemo(() => getRecordSelectOptions(skillRecords), [skillRecords])
    const wuDaoTypeOptions = useMemo(() => getRecordSelectOptions(wuDaoTypeRecords), [wuDaoTypeRecords])
    const wuDaoOptions = useMemo(() => getRecordSelectOptions(wuDaoRecords), [wuDaoRecords])
    const yuanyingOptions = useMemo(() => [{ value: '0', id: 0, label: '0 无' }, ...skillOptions], [skillOptions])
    const affixOptions = useMemo(() => getAffixSelectOptions(affixRecords), [affixRecords])
    const seidGroupKey = record && groupKey && isSeidProjectGroup(groupKey) ? groupKey : null
    if (record && seidGroupKey && !fields.includes('seid')) fields.push('seid')

    function renderControl(field: string) {
        if (!record) return null
        const label = groupKey ? translateField(groupKey, field) : field
        const value = record.data[field] ?? getDefaultRecordFieldValue(groupKey, field, record.key) ?? null
        const isAffixField =
            groupKey !== null &&
            (groupKey === 'buff' || groupKey === 'item' || groupKey === 'skill' || groupKey === 'shenTong') &&
            AFFIX_FIELDS.has(field)
        const isFlagField = groupKey !== null && (BOOL_NUMBER_FIELDS[groupKey] ?? []).includes(field)
        const isInvertedFlagField = groupKey !== null && (INVERTED_BOOL_NUMBER_FIELDS[groupKey] ?? []).includes(field)
        const metaOptions = getGroupEnumOptions(groupKey, field, metaDatasets)
        const stringDatasetName = groupKey ? META_STRING_FIELDS[groupKey]?.[field] : undefined
        const stringOptions = stringDatasetName ? getMetaStringOptions(metaDatasets, stringDatasetName) : []
        let control = (
            <JsonFieldInput
                label={label}
                value={value}
                multiline={isDescriptionField(field)}
                onChange={next => onUpdate(record.key, field, next)}
            />
        )
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
            control = (
                <AffixSelect value={value} options={affixOptions} label={label} onCommit={next => onUpdate(record.key, field, next)} />
            )
        } else if (isFlagField) {
            control = (
                <JsonFlagInput
                    value={value}
                    label={label}
                    inverted={isInvertedFlagField}
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'shenTong' && field === 'AttackType' && metaOptions.length > 0) {
            control = (
                <JsonMultiSelectDialog
                    value={value}
                    options={metaOptions}
                    label={label}
                    optionColumnLabel="属性"
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'npcType' && field === 'skills') {
            control = (
                <JsonMultiSelectDialog
                    value={value}
                    options={shenTongOptions}
                    label={label}
                    quickEdit
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'npcType' && field === 'staticSkills') {
            control = (
                <JsonMultiSelectDialog
                    value={value}
                    options={skillOptions}
                    label={label}
                    quickEdit
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'npcType' && field === 'yuanying') {
            control = (
                <JsonRecordSingleSelectDialog
                    value={value}
                    options={yuanyingOptions}
                    label={label}
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'wuDao' && field === 'Type') {
            control = (
                <JsonMultiSelectDialog
                    value={value}
                    options={wuDaoTypeOptions}
                    label={label}
                    optionColumnLabel="悟道类型"
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
        } else if (groupKey === 'npcWuDao' && field === 'wudaoID') {
            control = (
                <JsonMultiSelectDialog
                    value={value}
                    options={wuDaoOptions}
                    label={label}
                    optionColumnLabel="悟道"
                    quickEdit
                    onChange={next => onUpdate(record.key, field, next)}
                />
            )
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

    function getSelectionDetails(field: string): string | null {
        if (!record) return null
        const value = record.data[field] ?? getDefaultRecordFieldValue(groupKey, field, record.key) ?? null
        if (groupKey === 'npcWuDao' && field === 'wudaoID') return selectedOptionLabels(value, wuDaoOptions)
        if (groupKey === 'npcType' && field === 'skills') return selectedOptionLabels(value, shenTongOptions)
        if (groupKey === 'npcType' && field === 'staticSkills') return selectedOptionLabels(value, skillOptions)
        if (groupKey === 'npcType' && field === 'yuanying') return selectedOptionLabels(value, yuanyingOptions)
        if (AFFIX_FIELDS.has(field) && (groupKey === 'buff' || groupKey === 'item' || groupKey === 'skill' || groupKey === 'shenTong')) {
            return selectedOptionLabels(value, affixOptions)
        }
        return null
    }

    function renderIconPreview() {
        if (!record || !iconPath) return null
        const title = typeof record.data.name === 'string' ? record.data.name : String(record.key)
        return (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-line bg-raised">
                <AssetIcon path={iconPath} resolve={readAsset} title={title} className="h-full w-full" />
            </div>
        )
    }

    function renderMovedIconField() {
        if (!record || !iconField) return null
        const label = groupKey ? translateField(groupKey, iconField) : iconField
        return (
            <div className="mt-3">
                <div className="mb-1.5">
                    <span className="block text-sm font-medium text-ink-soft">{label}</span>
                </div>
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{renderControl(iconField)}</div>
                    {renderIconPreview()}
                </div>
            </div>
        )
    }

    return (
        <>
            <section style={{ width }} className="flex shrink-0 flex-col overflow-hidden border-l border-line bg-panel">
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
                                const selectionDetails = getSelectionDetails(field)
                                const showMovedIcon = iconField !== undefined && iconAnchorField === field
                                const showInlineIcon = iconField === field && iconAnchorField === null
                                return (
                                    <div key={field}>
                                        <div className="mb-1.5 flex items-center gap-1.5">
                                            <span className="block text-sm font-medium text-ink-soft">{label}</span>
                                            {selectionDetails ? <SelectionInfo label={label} content={selectionDetails} /> : null}
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
