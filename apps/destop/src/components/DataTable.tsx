import { translateField } from '@baize-next/i18n'
import type { JsonRecord, ProjectModGroupKey } from '@baize-next/types'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { collectRecordFields, formatCellValue } from '../utils/json'
import { ScrollArea } from './ScrollArea'

/**
 * 中间面板表格：以行列形式展示当前分组内的所有记录。
 * - 表头通过 @baize-next/i18n 映射为中文文案，并保持单行。
 * - 每条记录的 key 作为 ID 列展示，数据中若存在 key/id 字段不再重复展示。
 * - 行数据采用固定行高的虚拟滚动，只渲染可视范围附近的行，避免大数据量分组切换卡顿。
 */
interface DataTableProps {
    /** 当前分组数据键。 */
    groupKey: ProjectModGroupKey | null
    /** 当前分组记录列表。 */
    records: JsonRecord[]
    /** 当前选中记录的 key。 */
    selectedKey: string | null
    /** 记录选择回调。 */
    onSelect: (key: string) => void
}

/** Primary key fields per group; groups without a primary key show no ID column. */
const PRIMARY_FIELDS: Partial<Record<ProjectModGroupKey, string>> = {
    buff: 'buffid',
    item: 'id',
    skill: 'id',
    shenTong: 'id',
    npcType: 'id',
    npcWuDao: 'id',
    tuJianChunWenBen: 'id',
}

/** 暂不展示的词缀填写字段。 */
const HIDDEN_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    tuJianChunWenBen: ['name1'],
}

/** 单行像素高度：text-sm 行高 20px + 上下 py-2.5 各 10px。 */
const ROW_HEIGHT = 40

/** 可视区上下额外渲染的缓冲行数，减少快速滚动时的空白。 */
const OVERSCAN_ROWS = 8

/** 视口尚未测量（如 jsdom 环境）时使用的兜底高度。 */
const FALLBACK_VIEWPORT_HEIGHT = 600

function recordSortValue(record: JsonRecord, primaryField: string | null): string {
    const value = primaryField ? record.data[primaryField] : undefined
    if (typeof value === 'number' || typeof value === 'string') return String(value)
    return record.key
}

function numericSortValue(value: string): number | null {
    const trimmed = value.trim()
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
}

interface SortEntry {
    record: JsonRecord
    value: string
    number: number | null
}

/** 预计算排序键，避免排序过程中重复解析每条记录的字段值。 */
function sortRecords(records: JsonRecord[], primaryField: string | null): JsonRecord[] {
    const entries: SortEntry[] = records.map(record => {
        const value = recordSortValue(record, primaryField)
        return { record, value, number: numericSortValue(value) }
    })
    entries.sort((a, b) => {
        if (a.number !== null && b.number !== null) return a.number - b.number
        if (a.number !== null) return -1
        if (b.number !== null) return 1
        return a.value.localeCompare(b.value)
    })
    return entries.map(entry => entry.record)
}

/**
 * 计算当前需要渲染的行区间。
 * @param scrollTop 视口已滚动的像素距离。
 * @param viewportHeight 视口像素高度。
 * @param total 记录总数。
 * @param rowHeight 单行像素高度。
 * @param overscan 可视区外额外渲染的行数。
 */
export function getVisibleRange(
    scrollTop: number,
    viewportHeight: number,
    total: number,
    rowHeight: number = ROW_HEIGHT,
    overscan: number = OVERSCAN_ROWS
): { start: number; end: number } {
    const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
    const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight)
    const start = Math.min(total, Math.max(0, first - overscan))
    const end = Math.max(start, Math.min(total, last + overscan))
    return { start, end }
}

interface DataRowProps {
    record: JsonRecord
    fields: string[]
    primaryField: string | null
    hasPrimaryField: boolean
    selected: boolean
    onSelect: (key: string) => void
}

/** 单行渲染与选中态解耦，滚动或选中变化时仅重绘受影响的行。 */
const DataRow = memo(function DataRow({ record, fields, primaryField, hasPrimaryField, selected, onSelect }: DataRowProps) {
    return (
        <tr
            onClick={() => onSelect(record.key)}
            className={`cursor-pointer border-b border-line transition-colors ${
                selected ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'
            }`}
        >
            {hasPrimaryField && primaryField ? (
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                    {record.data[primaryField] !== undefined ? formatCellValue(record.data[primaryField]) : '-'}
                </td>
            ) : null}
            {fields.map(field => (
                <td key={field} className="max-w-72 truncate px-4 py-2.5">
                    {record.data[field] === undefined ? <span className="text-ink-subtle">—</span> : formatCellValue(record.data[field])}
                </td>
            ))}
        </tr>
    )
})

export function DataTable({ groupKey, records, selectedKey, onSelect }: DataTableProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const frameRef = useRef<number | null>(null)
    const prevGroupKeyRef = useRef(groupKey)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)

    const primaryField = groupKey ? (PRIMARY_FIELDS[groupKey] ?? null) : null
    const hasPrimaryField = useMemo(
        () => primaryField !== null && records.some(record => record.data[primaryField] !== undefined),
        [records, primaryField]
    )
    const fields = useMemo(() => {
        // 主键列按分组类型显示；分组不存在主键字段时不生成伪 ID。
        const hiddenFields = groupKey ? (HIDDEN_FIELDS[groupKey] ?? []) : []
        return collectRecordFields(records).filter(field => field !== 'key' && field !== primaryField && !hiddenFields.includes(field))
    }, [records, groupKey, primaryField])
    const sortedRecords = useMemo(() => sortRecords(records, primaryField), [records, primaryField])

    /** 视口滚动与尺寸变化均合帧处理，避免滚动过程中频繁触发 React 重渲染。 */
    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        const handleScroll = () => {
            if (frameRef.current !== null) return
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null
                setScrollTop(viewport.scrollTop)
            })
        }
        const measure = () => setViewportHeight(viewport.clientHeight)
        measure()
        viewport.addEventListener('scroll', handleScroll, { passive: true })
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        return () => {
            viewport.removeEventListener('scroll', handleScroll)
            observer.disconnect()
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = null
            }
        }
    }, [])

    /** 切换分组时回到顶部，避免沿用上一分组的滚动位置。 */
    useLayoutEffect(() => {
        if (prevGroupKeyRef.current === groupKey) return
        prevGroupKeyRef.current = groupKey
        const viewport = viewportRef.current
        if (viewport) viewport.scrollTop = 0
        setScrollTop(0)
    }, [groupKey])

    const { start, end } = getVisibleRange(scrollTop, viewportHeight || FALLBACK_VIEWPORT_HEIGHT, sortedRecords.length)
    const topPadding = start * ROW_HEIGHT
    const bottomPadding = (sortedRecords.length - end) * ROW_HEIGHT
    const columnCount = fields.length + (hasPrimaryField ? 1 : 0)

    return (
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-line bg-panel px-3 py-2">
                <h2 className="text-sm font-medium text-ink-muted">数据表格</h2>
            </div>
            <ScrollArea viewportRef={viewportRef} className="flex-1 bg-panel" viewportClassName="h-full">
                {sortedRecords.length === 0 ? (
                    <p className="p-4 text-sm text-ink-subtle">当前分组没有记录</p>
                ) : (
                    <table className="w-full min-w-max border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-raised text-ink-muted">
                            <tr>
                                {hasPrimaryField && primaryField ? (
                                    <th className="whitespace-nowrap border-b border-line-strong px-4 py-2.5">
                                        {groupKey ? translateField(groupKey, primaryField) : primaryField}
                                    </th>
                                ) : null}
                                {fields.map(field => (
                                    <th key={field} className="whitespace-nowrap border-b border-line-strong px-4 py-2.5">
                                        {groupKey ? translateField(groupKey, field) : field}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {topPadding > 0 ? (
                                <tr aria-hidden="true">
                                    <td colSpan={columnCount} style={{ height: topPadding, padding: 0 }} />
                                </tr>
                            ) : null}
                            {sortedRecords.slice(start, end).map(record => (
                                <DataRow
                                    key={record.key}
                                    record={record}
                                    fields={fields}
                                    primaryField={primaryField}
                                    hasPrimaryField={hasPrimaryField}
                                    selected={record.key === selectedKey}
                                    onSelect={onSelect}
                                />
                            ))}
                            {bottomPadding > 0 ? (
                                <tr aria-hidden="true">
                                    <td colSpan={columnCount} style={{ height: bottomPadding, padding: 0 }} />
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                )}
            </ScrollArea>
        </section>
    )
}
