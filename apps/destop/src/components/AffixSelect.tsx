import { translateField } from '@baize-next/i18n'
import type { JsonValue } from '@baize-next/types'
import { useEffect, useMemo, useState } from 'react'

import type { AffixSelectOption } from '../utils/json'

interface AffixSelectProps {
    value: JsonValue[]
    options: AffixSelectOption[]
    label: string
    onCommit: (value: JsonValue[]) => void
}

function numericIds(value: JsonValue[]): number[] {
    return value.filter((item): item is number => typeof item === 'number')
}

function selectionFromValue(value: JsonValue[]): Set<number> {
    return new Set(numericIds(value))
}

export function AffixSelect({ value, options, label, onCommit }: AffixSelectProps) {
    const [open, setOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => selectionFromValue(value))
    const optionById = useMemo(() => new Map(options.map(option => [option.id, option])), [options])
    const currentIds = useMemo(() => numericIds(value), [value])
    const currentOptions = currentIds.map(id => optionById.get(id)).filter((option): option is AffixSelectOption => option !== undefined)
    const allChecked = options.length > 0 && options.every(option => selectedIds.has(option.id))

    useEffect(() => {
        if (!open) return
        setSelectedIds(selectionFromValue(value))
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, value])

    function toggle(id: number): void {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleAll(): void {
        setSelectedIds(prev => {
            const next = new Set(prev)
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
        onCommit(next)
        setOpen(false)
    }

    const summary =
        currentOptions.length > 0
            ? `${currentOptions.length} 项：${currentOptions
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
                <span className="truncate">{summary}</span>
                <span aria-hidden="true" className="shrink-0 text-ink-muted">
                    选择
                </span>
            </button>
            {open ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setOpen(false)
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                        className="flex max-h-[78vh] w-[min(900px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-line-strong bg-base shadow-2xl"
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
                        <div className="min-h-0 flex-1 overflow-auto bg-panel">
                            {options.length === 0 ? (
                                <p className="p-4 text-sm text-ink-subtle">暂无本地词缀数据</p>
                            ) : (
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead className="sticky top-0 bg-raised text-ink-muted">
                                        <tr>
                                            <th className="w-10 border-b border-line-strong px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="全选"
                                                    checked={allChecked}
                                                    onChange={toggleAll}
                                                    className="h-4 w-4 accent-accent"
                                                />
                                            </th>
                                            <th className="whitespace-nowrap border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                ID
                                            </th>
                                            <th className="whitespace-nowrap border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {translateField('tuJianChunWenBen', 'name2')}
                                            </th>
                                            <th className="whitespace-nowrap border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {translateField('tuJianChunWenBen', 'name1')}
                                            </th>
                                            <th className="whitespace-nowrap border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {translateField('tuJianChunWenBen', 'typenum')}
                                            </th>
                                            <th className="whitespace-nowrap border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {translateField('tuJianChunWenBen', 'type')}
                                            </th>
                                            <th className="max-w-80 border-b border-line-strong px-3 py-2 text-xs font-medium">
                                                {translateField('tuJianChunWenBen', 'descr')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {options.map(option => {
                                            const checked = selectedIds.has(option.id)
                                            return (
                                                <tr
                                                    key={option.id}
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
                                                    <td className="whitespace-nowrap px-3 py-2">{option.label}</td>
                                                    <td className="whitespace-nowrap px-3 py-2">{option.name1}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{option.typenum}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{option.type}</td>
                                                    <td className="max-w-80 truncate px-3 py-2 text-ink-muted">{option.descr}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-panel px-4 py-3">
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
                        </footer>
                    </div>
                </div>
            ) : null}
        </>
    )
}
