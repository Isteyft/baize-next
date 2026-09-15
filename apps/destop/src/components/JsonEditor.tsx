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
    const fields = record ? Object.keys(record.data) : []

    return (
        <section className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-line bg-panel">
            <div className="shrink-0 border-b border-line px-3 py-2">
                <h2 className="text-sm font-medium text-ink-muted">JSON 编辑</h2>
            </div>
            <ScrollArea className="flex-1" viewportClassName="h-full">
                {record ? (
                    <div className="space-y-4 p-3">
                        <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
                            <span className="truncate text-sm font-medium text-ink">{record.key}</span>
                            <span className="shrink-0 text-xs text-ink-subtle">{fields.length} 个字段</span>
                        </div>
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
