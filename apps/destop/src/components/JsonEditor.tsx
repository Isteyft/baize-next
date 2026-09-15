import { translateField } from '@baize-next/i18n'
import type { JsonRecord, JsonValue, ProjectModGroupKey } from '@baize-next/types'
import { useState } from 'react'

import { ScrollArea } from './ScrollArea'

interface JsonEditorProps {
    /** 当前分组 key，用于字段 i18n 映射。 */
    groupKey: ProjectModGroupKey | null
    /** 当前选中记录，未选中时为 null。 */
    record: JsonRecord | null
    /** 字段变更回调，实时回写表格。 */
    onUpdate: (recordKey: string, field: string, value: JsonValue) => void
}

const inputClass =
    'w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-subtle focus:border-accent focus:outline-none'

/** 暂不展示的词缀填写字段。 */
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

export function JsonEditor({ groupKey, record, onUpdate }: JsonEditorProps) {
    const hiddenFields = groupKey ? (HIDDEN_FIELDS[groupKey] ?? []) : []
    const fields = record ? Object.keys(record.data).filter(field => !hiddenFields.includes(field)) : []

    return (
        <section className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-line bg-panel">
            <div className="shrink-0 border-b border-line px-3 py-2">
                <h2 className="text-sm font-medium text-ink-muted">JSON 编辑</h2>
            </div>
            <ScrollArea className="flex-1" viewportClassName="h-full">
                {record ? (
                    <div className="space-y-4 p-3">
                        {fields.map(field => {
                            const label = groupKey ? translateField(groupKey, field) : field
                            const value = record.data[field]
                            return (
                                <div key={field}>
                                    <div className="mb-1.5">
                                        <span className="block text-sm font-medium text-ink-soft">{label}</span>
                                    </div>
                                    <JsonFieldInput
                                        key={`${record.key}-${field}`}
                                        value={value}
                                        onChange={next => onUpdate(record.key, field, next)}
                                    />
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
    )
}
