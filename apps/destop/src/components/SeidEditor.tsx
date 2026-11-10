import type { JsonDataset, JsonRecord, JsonValue, ProjectSeidData, SeidDataKey } from '@baize-next/types'
import { useEffect, useRef, useState } from 'react'

import {
    createSeidParameterRecord,
    filterSeidDefinitions,
    getSeidDataKey,
    getSeidDefinitionsForRecord,
    getSeidPropertyOptions,
    isSeidMultiSelect,
    type SeidDrawerRecords,
    type SeidMetaDefinition,
    type SeidMetaProperty,
    type SeidOption,
    type SeidProjectGroupKey,
    seidValuesToStrings,
} from '../utils/seid'
import { ScrollArea } from './ScrollArea'
import { Select } from './Select'

interface SeidEditorProps {
    open: boolean
    groupKey: SeidProjectGroupKey
    record: JsonRecord
    seidData: ProjectSeidData
    metaDatasets: JsonDataset[]
    records: SeidDrawerRecords
    onClose: () => void
    onUpdateRecord: (recordKey: string, field: string, value: JsonValue) => void
    onUpdateSeidData: (dataKey: SeidDataKey, seidId: string, targetKey: string, value: Record<string, JsonValue> | null) => void
}

const inputClass =
    'w-full rounded-md border border-line bg-panel px-2.5 py-2 text-sm text-ink transition-colors placeholder:text-ink-subtle focus:border-accent focus:outline-none'

function getSeidIds(value: JsonValue): string[] {
    if (!Array.isArray(value)) return []
    return value.filter(item => typeof item === 'number' || typeof item === 'string').map(String)
}

function toSeidJsonValue(value: string): JsonValue {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
}

function valueForOption(option: SeidOption): JsonValue {
    return option.id
}

function parseSeidTextInput(raw: string, useNumber: boolean): JsonValue[] {
    return raw
        .split(/[,，\s]+/)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
            const parsed = Number(item)
            return useNumber && Number.isFinite(parsed) ? parsed : item
        })
}

function SeidMultiSelect({
    value,
    options,
    label,
    onChange,
}: {
    value: JsonValue
    options: SeidOption[]
    label: string
    onChange: (value: JsonValue) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [text, setText] = useState('')
    const rootRef = useRef<HTMLDivElement>(null)
    const selected = new Set(seidValuesToStrings(value))
    const filtered = query ? options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase())) : options

    // 同步文本输入框与当前选中值；输入框聚焦时由用户自由编辑，不覆盖其内容。
    const values = seidValuesToStrings(value)
    const useNumber = values.length === 0 || values.some(item => Number.isFinite(Number(item)) && item !== '')
    const selectedText = values.join(', ')
    useEffect(() => {
        setText(selectedText)
    }, [selectedText])

    useEffect(() => {
        if (!open) return
        function handleDocumentClick(event: MouseEvent): void {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
        }
        function handleDocumentKeydown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', handleDocumentClick)
        document.addEventListener('keydown', handleDocumentKeydown)
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick)
            document.removeEventListener('keydown', handleDocumentKeydown)
        }
    }, [open])

    function toggle(option: SeidOption): void {
        const next = selected.has(option.value)
            ? options.filter(item => selected.has(item.value) && item.value !== option.value).map(valueForOption)
            : [...options.filter(item => selected.has(item.value)).map(valueForOption), valueForOption(option)]
        onChange(next)
    }

    function commitText(): void {
        const next = parseSeidTextInput(text, useNumber)
        onChange(next)
        setText(next.map(String).join(', '))
    }

    return (
        <div ref={rootRef} className="relative">
            <div className="flex w-full items-stretch gap-1">
                <input
                    type="text"
                    aria-label={`${label}（已选值）`}
                    value={text}
                    onChange={event => setText(event.target.value)}
                    onBlur={commitText}
                    onKeyDown={event => {
                        if (event.key === 'Enter') commitText()
                    }}
                    placeholder="输入值，用逗号分隔"
                    className={`${inputClass} min-w-0 flex-1`}
                />
                <button
                    type="button"
                    aria-label={`${label}（${selected.size} 项）`}
                    onClick={() => setOpen(current => !current)}
                    className="flex shrink-0 items-center justify-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hover focus:outline-none"
                >
                    <span aria-hidden="true" className={`origin-center text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </button>
            </div>
            {open ? (
                <div className="absolute left-0 right-0 z-[70] mt-1 overflow-hidden rounded-md border border-line-strong bg-raised shadow-xl">
                    <div className="border-b border-line p-2">
                        <input
                            type="search"
                            aria-label={`搜索${label}`}
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="搜索"
                            className={inputClass}
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-ink-subtle">没有匹配项</p>
                        ) : (
                            filtered.map(option => {
                                const active = selected.has(option.value)
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => toggle(option)}
                                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                                            active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-hover'
                                        }`}
                                    >
                                        <span className="w-4 text-center" aria-hidden="true">
                                            {active ? '✓' : ''}
                                        </span>
                                        <span>{option.label}</span>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function SeidArrayInput({ value, onChange }: { value: JsonValue; onChange: (value: JsonValue) => void }) {
    const values = Array.isArray(value) ? value : []
    const useNumber = values.length === 0 || values.some(item => typeof item === 'number')
    return (
        <div className="space-y-2">
            {values.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <input
                        type="text"
                        inputMode={useNumber ? 'decimal' : undefined}
                        value={String(item ?? '')}
                        onChange={event => {
                            const next = useNumber ? Number(event.target.value) : event.target.value
                            onChange(values.map((current, itemIndex) => (itemIndex === index ? next : current)))
                        }}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                        className="rounded-md border border-line px-2 py-2 text-xs text-ink-muted hover:bg-hover"
                    >
                        删除
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...values, useNumber ? 0 : ''])}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:bg-hover"
            >
                + 添加数组项
            </button>
        </div>
    )
}

function SeidPropertyInput({
    property,
    value,
    options,
    onChange,
}: {
    property: SeidMetaProperty
    value: JsonValue
    options: SeidOption[]
    onChange: (value: JsonValue) => void
}) {
    if (isSeidMultiSelect(property, options)) {
        return <SeidMultiSelect value={value} options={options} label={property.description} onChange={onChange} />
    }

    if (options.length > 0) {
        const current = seidValuesToStrings(value)[0] ?? ''
        return (
            <Select
                value={current}
                options={options}
                onChange={next => {
                    const option = options.find(item => item.value === next)
                    if (option) onChange(option.id)
                }}
                aria-label={property.description}
                className="w-full"
            />
        )
    }

    if (property.type.endsWith('Array')) return <SeidArrayInput value={value} onChange={onChange} />

    if (property.type === 'Int' || property.type === 'Float') {
        return (
            <input
                type="text"
                inputMode={property.type === 'Float' ? 'decimal' : 'numeric'}
                value={typeof value === 'number' || typeof value === 'string' ? value : 0}
                onChange={event => {
                    const next = Number(event.target.value)
                    onChange(Number.isFinite(next) ? next : 0)
                }}
                className={inputClass}
            />
        )
    }

    return (
        <input
            type="text"
            value={typeof value === 'string' ? value : String(value ?? '')}
            onChange={event => onChange(event.target.value)}
            className={inputClass}
        />
    )
}

export function SeidEditor({
    open,
    groupKey,
    record,
    seidData,
    metaDatasets,
    records,
    onClose,
    onUpdateRecord,
    onUpdateSeidData,
}: SeidEditorProps) {
    const definitions = getSeidDefinitionsForRecord(metaDatasets, groupKey, record.data)
    const dataKey = getSeidDataKey(groupKey, record.data)
    const seidIds = getSeidIds(record.data.seid)
    const definitionMap = new Map(definitions.map(definition => [String(definition.id), definition]))
    const availableDefinitions = definitions.filter(definition => !seidIds.includes(String(definition.id)))
    const [selectedId, setSelectedId] = useState('')
    const [addOpen, setAddOpen] = useState(false)
    const [addQuery, setAddQuery] = useState('')
    const filteredDefinitions = filterSeidDefinitions(availableDefinitions, addQuery)
    const selectedDefinition = definitionMap.get(selectedId)
    const storedValue = seidData[dataKey]?.[selectedId]?.[record.key]
    const parameterValue = selectedDefinition
        ? { ...createSeidParameterRecord(selectedDefinition, record.key), ...(storedValue ?? {}) }
        : (storedValue ?? {})

    useEffect(() => {
        if (!open) return
        if (selectedId && seidIds.includes(selectedId)) return
        setSelectedId(seidIds[0] ?? '')
    }, [open, selectedId, seidIds])

    useEffect(() => {
        if (!open) return
        function handleKeydown(event: KeyboardEvent): void {
            if (event.key !== 'Escape') return
            if (addOpen) {
                setAddOpen(false)
                return
            }
            onClose()
        }
        document.addEventListener('keydown', handleKeydown)
        return () => document.removeEventListener('keydown', handleKeydown)
    }, [addOpen, open, onClose])

    if (!open) return null

    function handleAdd(definition: SeidMetaDefinition): void {
        const seidId = String(definition.id)
        const nextIds = [...seidIds, seidId]
        onUpdateRecord(record.key, 'seid', nextIds.map(toSeidJsonValue))
        if (definition.properties.length > 0) {
            onUpdateSeidData(dataKey, seidId, record.key, createSeidParameterRecord(definition, record.key))
        }
        setSelectedId(seidId)
        setAddOpen(false)
        setAddQuery('')
    }

    function handleMove(index: number, offset: -1 | 1): void {
        const targetIndex = index + offset
        if (targetIndex < 0 || targetIndex >= seidIds.length) return
        const nextIds = [...seidIds]
        const current = nextIds[index]
        const target = nextIds[targetIndex]
        if (current === undefined || target === undefined) return
        nextIds[index] = target
        nextIds[targetIndex] = current
        onUpdateRecord(record.key, 'seid', nextIds.map(toSeidJsonValue))
        setSelectedId(current)
    }

    function handleRemove(seidId: string): void {
        const nextIds = seidIds.filter(id => id !== seidId)
        onUpdateRecord(record.key, 'seid', nextIds.map(toSeidJsonValue))
        onUpdateSeidData(dataKey, seidId, record.key, null)
        setSelectedId(nextIds[0] ?? '')
    }

    function handlePropertyChange(propertyId: string, value: JsonValue): void {
        if (!selectedDefinition) return
        onUpdateSeidData(dataKey, selectedId, record.key, { ...parameterValue, [propertyId]: value })
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-6"
            role="presentation"
            onMouseDown={event => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Seid 编辑器"
                className="flex h-[min(760px,calc(100vh-48px))] w-[min(1120px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
            >
                <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
                    <div>
                        <h2 className="text-base font-semibold text-ink">Seid 编辑器</h2>
                        <p className="mt-0.5 text-xs text-ink-subtle">为当前记录增加特性并填写参数</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                    >
                        关闭
                    </button>
                </header>

                <div className="flex min-h-0 flex-1">
                    <aside className="flex w-[390px] shrink-0 flex-col border-r border-line">
                        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
                            <button
                                type="button"
                                onClick={() => setAddOpen(true)}
                                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                增加 Seid
                            </button>
                            <span className="text-xs text-ink-subtle">{availableDefinitions.length} 项可选</span>
                        </div>
                        <ScrollArea className="flex-1" viewportClassName="h-full">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="sticky top-0 bg-raised text-ink-muted">
                                    <tr>
                                        <th className="border-b border-line-strong px-3 py-2.5">Seid</th>
                                        <th className="border-b border-line-strong px-3 py-2.5">名称</th>
                                        <th className="w-44 border-b border-line-strong px-3 py-2.5 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {seidIds.map((seidId, index) => {
                                        const definition = definitionMap.get(seidId)
                                        return (
                                            <tr
                                                key={seidId}
                                                onClick={() => setSelectedId(seidId)}
                                                className={`cursor-pointer border-b border-line transition-colors ${
                                                    selectedId === seidId ? 'bg-accent-soft' : 'hover:bg-hover'
                                                }`}
                                            >
                                                <td className="px-3 py-2.5 text-ink">{seidId}</td>
                                                <td className="px-3 py-2.5 text-ink-soft">{definition?.name ?? '未知 Seid'}</td>
                                                <td className="w-44 px-3 py-2.5 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            aria-label={`上移 Seid ${seidId}`}
                                                            disabled={index === 0}
                                                            onClick={event => {
                                                                event.stopPropagation()
                                                                handleMove(index, -1)
                                                            }}
                                                            className="rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-hover disabled:cursor-not-allowed disabled:opacity-35"
                                                        >
                                                            上移
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-label={`下移 Seid ${seidId}`}
                                                            disabled={index === seidIds.length - 1}
                                                            onClick={event => {
                                                                event.stopPropagation()
                                                                handleMove(index, 1)
                                                            }}
                                                            className="rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-hover disabled:cursor-not-allowed disabled:opacity-35"
                                                        >
                                                            下移
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-label={`删除 Seid ${seidId}`}
                                                            onClick={event => {
                                                                event.stopPropagation()
                                                                handleRemove(seidId)
                                                            }}
                                                            className="rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10"
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {seidIds.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-8 text-center text-ink-subtle">
                                                尚未增加 Seid
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </aside>

                    <section className="flex min-w-0 flex-1 flex-col">
                        <ScrollArea className="flex-1" viewportClassName="h-full">
                            {selectedDefinition ? (
                                <div className="space-y-5 p-5">
                                    <div className="rounded-lg border border-line bg-raised p-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-ink">
                                                {selectedDefinition.id} {selectedDefinition.name}
                                            </h3>
                                            <span className="rounded bg-accent-soft px-2 py-0.5 text-xs text-accent">
                                                {selectedDefinition.idField}
                                            </span>
                                        </div>
                                        {selectedDefinition.description ? (
                                            <p className="mt-1 text-sm text-ink-muted">{selectedDefinition.description}</p>
                                        ) : null}
                                    </div>

                                    {selectedDefinition.properties.length === 0 ? (
                                        <p className="text-sm text-ink-subtle">该 Seid 没有需要填写的参数。</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedDefinition.properties.map(property => {
                                                const options = getSeidPropertyOptions(property, metaDatasets, records, definitions)
                                                return (
                                                    <div key={property.id}>
                                                        <div className="mb-1.5 flex items-center gap-2">
                                                            <span className="text-sm font-medium text-ink-soft">
                                                                {property.description}
                                                            </span>
                                                            <span className="rounded bg-hover px-1.5 py-0.5 text-[11px] text-ink-subtle">
                                                                {property.id}
                                                            </span>
                                                            <span className="text-[11px] text-ink-subtle">{property.type}</span>
                                                        </div>
                                                        <SeidPropertyInput
                                                            property={property}
                                                            value={parameterValue[property.id] ?? ''}
                                                            options={options}
                                                            onChange={value => handlePropertyChange(property.id, value)}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center p-6 text-sm text-ink-subtle">
                                    在左侧选择或增加一个 Seid
                                </div>
                            )}
                        </ScrollArea>
                    </section>
                </div>
            </section>
            {addOpen ? (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setAddOpen(false)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="选择 Seid"
                        className="flex h-[min(680px,calc(100vh-64px))] w-[min(920px,calc(100vw-64px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
                            <h3 className="text-base font-semibold text-ink">选择 Seid</h3>
                            <button
                                type="button"
                                onClick={() => setAddOpen(false)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                关闭
                            </button>
                        </header>
                        <div className="shrink-0 border-b border-line p-3">
                            <input
                                type="search"
                                aria-label="搜索 Seid"
                                value={addQuery}
                                onChange={event => setAddQuery(event.target.value)}
                                placeholder="搜索 ID、名称或描述"
                                className={inputClass}
                            />
                        </div>
                        <ScrollArea className="flex-1" viewportClassName="h-full">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="sticky top-0 bg-raised text-ink-muted">
                                    <tr>
                                        <th className="w-24 border-b border-line-strong px-4 py-2.5">Seid</th>
                                        <th className="w-56 border-b border-line-strong px-4 py-2.5">名称</th>
                                        <th className="border-b border-line-strong px-4 py-2.5">描述</th>
                                        <th className="w-24 border-b border-line-strong px-4 py-2.5 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDefinitions.map(definition => (
                                        <tr key={definition.id} className="border-b border-line hover:bg-hover">
                                            <td className="px-4 py-2.5 text-ink">{definition.id}</td>
                                            <td className="px-4 py-2.5 text-ink-soft">{definition.name}</td>
                                            <td className="px-4 py-2.5 text-ink-subtle">{definition.description}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    type="button"
                                                    aria-label={`添加 Seid ${definition.id}`}
                                                    onClick={() => handleAdd(definition)}
                                                    className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-hover"
                                                >
                                                    添加
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDefinitions.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-12 text-center text-ink-subtle">
                                                没有匹配项
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </section>
                </div>
            ) : null}
        </div>
    )
}
