import { translateField } from '@baize-next/i18n'
import type { JsonDataset, JsonRecord, JsonValue, ProjectModGroupKey } from '@baize-next/types'
import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
    collectRecordFields,
    collectSearchableText,
    formatCellValue,
    getGroupEnumLabel,
    GROUP_ICON_FIELDS,
    hasSearchKeyword,
    matchesSearchQuery,
    resolveModIconPath,
    TABLE_SEARCH_PLACEHOLDER,
} from '../utils/json'
import { AssetIcon } from './AssetIcon'
import { ScrollArea } from './ScrollArea'

/**
 * 中间面板表格：以行列形式展示当前分组内的所有记录。
 * - 列跟随数据自适应：只展示 id/名称/介绍这类关键字段，其余字段在右侧 JSON 编辑器中查看与编辑。
 * - 表头通过 @baize-next/i18n 映射为中文文案，并保持单行。
 * - 右上角搜索框按关键词过滤记录，命中 ID/名称/介绍任一字段即可。
 * - 行数据采用固定行高的虚拟滚动，只渲染可视范围附近的行，避免大数据量切换卡顿。
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
    /** 已预加载的 meta 数据集，用于把枚举字段渲染为描述文本。 */
    metaDatasets?: JsonDataset[]
    /** 搜索框占位文案，默认按 id/名称/介绍搜索。 */
    searchPlaceholder?: string
    /** 当前 mod 文件夹相对项目根目录的路径，用于解析 Assets 下的图标。 */
    modDirectory?: string | null
    /** 读取 mod 资源并返回可展示的 data URL。 */
    readAsset?: ((relativePath: string) => Promise<string | null>) | undefined
    /** 点击图标单元格时打开对应记录的编辑器。 */
    onSelectRecord?: (key: string) => void
}

/**
 * 每个分组在表格中展示的列（按顺序）。
 * 表格只保留 id/名称/介绍类关键字段，其余字段在右侧 JSON 编辑器中查看与编辑。
 * 字段不存在于当前数据中时不会生成空列。
 */
const VISIBLE_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    buff: ['name', 'descr'],
    item: ['name', 'desc'],
    skill: ['name', 'descr'],
    shenTong: ['name', 'descr'],
    npcType: ['Type'],
    npcWuDao: ['Type'],
    tuJianChunWenBen: ['name2', 'descr'],
}

/**
 * 扮格搜索需要比对的关键字段（ID/名称/介绍）。
 * 无主键分组使用 record.key 作为 ID，因此不在此列出。
 */
const SEARCH_FIELDS: string[] = ['id', 'name', 'name2', 'descr', 'desc', 'desc2']

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

/** 暂不展示的字段：tuJianChunWenBen 的词缀项目值，以及 skill 分组的老词缀。 */
const HIDDEN_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    tuJianChunWenBen: ['name1'],
    shenTong: ['Affix'],
}

/**
 * 将单元格值格式化为展示文本：配置了 meta 枚举的字段显示“描述(id)”，其余保持原样。
 * @param groupKey 当前分组 key。
 * @param field 字段名。
 * @param value 字段值。
 * @param metaDatasets 已预加载的 meta 数据集。
 */
export function formatCellText(
    groupKey: ProjectModGroupKey | null,
    field: string,
    value: JsonValue,
    metaDatasets: JsonDataset[] = []
): string {
    const label = getGroupEnumLabel(groupKey, field, value, metaDatasets)
    if (label !== null) return `${label}(${formatCellValue(value)})`
    return formatCellValue(value)
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

/** 预计算每条记录的搜索文本，避免输入关键词时反复遍历字段。 */
function searchIndexKey(record: JsonRecord, primaryField: string | null): string {
    return `${record.key}\u0000${primaryField ?? ''}\u0000${collectSearchableText(record, primaryField, SEARCH_FIELDS)}`
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
    showIconColumn: boolean
    groupKey: ProjectModGroupKey | null
    metaDatasets: JsonDataset[]
    /** 当前记录图标的 Assets 相对路径，无图标时为 null。 */
    iconPath: string | null
    /** 读取 mod 资源并返回可展示的 data URL。 */
    readAsset?: ((relativePath: string) => Promise<string | null>) | undefined
    selected: boolean
    onSelect: (key: string) => void
}

/** 单行渲染与选中态解耦，滚动或选中变化时仅重绘受影响的行。 */
const DataRow = memo(function DataRow({
    record,
    fields,
    primaryField,
    hasPrimaryField,
    showIconColumn,
    groupKey,
    metaDatasets,
    iconPath,
    readAsset,
    selected,
    onSelect,
}: DataRowProps) {
    return (
        <tr
            onClick={() => onSelect(record.key)}
            className={`cursor-pointer border-b border-line transition-colors ${
                selected ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'
            }`}
        >
            {showIconColumn ? (
                <td className="w-12 whitespace-nowrap px-3 py-2">
                    <AssetIcon
                        path={iconPath}
                        resolve={readAsset}
                        title={String(record.data[primaryField ?? 'name'] ?? record.key)}
                        className="h-6 w-6"
                    />
                </td>
            ) : null}
            {hasPrimaryField && primaryField ? (
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                    {record.data[primaryField] !== undefined
                        ? formatCellText(groupKey, primaryField, record.data[primaryField], metaDatasets)
                        : '-'}
                </td>
            ) : null}
            {fields.map(field => (
                <td key={field} className="max-w-72 truncate px-4 py-2.5">
                    {record.data[field] === undefined ? (
                        <span className="text-ink-subtle">—</span>
                    ) : (
                        formatCellText(groupKey, field, record.data[field], metaDatasets)
                    )}
                </td>
            ))}
        </tr>
    )
})

export function DataTable({
    groupKey,
    records,
    selectedKey,
    onSelect,
    metaDatasets = [],
    searchPlaceholder = TABLE_SEARCH_PLACEHOLDER,
    modDirectory = null,
    readAsset,
}: DataTableProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const frameRef = useRef<number | null>(null)
    const prevGroupKeyRef = useRef(groupKey)
    const prevQueryRef = useRef('')
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [query, setQuery] = useState('')

    const primaryField = groupKey ? (PRIMARY_FIELDS[groupKey] ?? null) : null
    /** 当前分组是否展示图标列：有图标字段且能定位到 mod 目录时才展示。 */
    const showIconColumn = Boolean(modDirectory) && groupKey !== null && GROUP_ICON_FIELDS[groupKey] !== undefined
    /** 记录 key -> 图标相对路径，避免每行重复解析路径。 */
    const iconPaths = useMemo(() => {
        const paths = new Map<string, string | null>()
        for (const record of records) {
            paths.set(record.key, showIconColumn ? resolveModIconPath(modDirectory ?? '', groupKey, record.data) : null)
        }
        return paths
    }, [records, showIconColumn, modDirectory, groupKey])
    const hasPrimaryField = useMemo(
        () => primaryField !== null && records.some(record => record.data[primaryField] !== undefined),
        [records, primaryField]
    )
    /** 仅保留当前分组配置且真实存在的列，避免出现整列空白。 */
    const fields = useMemo(() => {
        const available = new Set(collectRecordFields(records))
        const hiddenFields = groupKey ? (HIDDEN_FIELDS[groupKey] ?? []) : []
        const configured = groupKey ? VISIBLE_FIELDS[groupKey] : undefined
        if (!configured) return []
        return configured.filter(
            field => available.has(field) && field !== 'key' && field !== primaryField && !hiddenFields.includes(field)
        )
    }, [records, groupKey, primaryField])
    const sortedRecords = useMemo(() => sortRecords(records, primaryField), [records, primaryField])
    /** 搜索索引与排序结果一同缓存，避免每次输入都重建全量字符串。 */
    const searchIndex = useMemo(() => sortedRecords.map(record => searchIndexKey(record, primaryField)), [sortedRecords, primaryField])
    /** 搜索输入使用延迟值，避免大数据量下每次按键都同步过滤。 */
    const deferredQuery = useDeferredValue(query)
    const filteredRecords = useMemo(() => {
        if (!hasSearchKeyword(deferredQuery)) return sortedRecords
        return sortedRecords.filter((_, index) => matchesSearchQuery(searchIndex[index] ?? '', deferredQuery))
    }, [sortedRecords, searchIndex, deferredQuery])

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

    /** 切换分组或搜索条件时回到顶部，避免沿用上一个视图的滚动位置。 */
    useLayoutEffect(() => {
        const changed = prevGroupKeyRef.current !== groupKey || prevQueryRef.current !== deferredQuery
        if (!changed) return
        prevGroupKeyRef.current = groupKey
        prevQueryRef.current = deferredQuery
        const viewport = viewportRef.current
        if (viewport) viewport.scrollTop = 0
        setScrollTop(0)
    }, [groupKey, deferredQuery])

    const { start, end } = getVisibleRange(scrollTop, viewportHeight || FALLBACK_VIEWPORT_HEIGHT, filteredRecords.length)
    const topPadding = start * ROW_HEIGHT
    const bottomPadding = (filteredRecords.length - end) * ROW_HEIGHT
    const columnCount = fields.length + (hasPrimaryField ? 1 : 0)
    const totalColumnCount = columnCount + (showIconColumn ? 1 : 0)

    return (
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-3 border-b border-line bg-panel px-3 py-2">
                <h2 className="shrink-0 text-sm font-medium text-ink-muted">数据表格</h2>
                <div className="relative ml-auto w-64 max-w-[60%]">
                    <input
                        type="search"
                        aria-label={searchPlaceholder}
                        placeholder={searchPlaceholder}
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-subtle focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:cursor-pointer"
                    />
                </div>
            </div>
            <ScrollArea viewportRef={viewportRef} className="flex-1 bg-panel" viewportClassName="h-full">
                {sortedRecords.length === 0 ? (
                    <p className="p-4 text-sm text-ink-subtle">当前分组没有记录</p>
                ) : filteredRecords.length === 0 ? (
                    <p className="p-4 text-sm text-ink-subtle">没有匹配“{query}”的记录</p>
                ) : (
                    <table className="w-full min-w-max border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-raised text-ink-muted">
                            <tr>
                                {showIconColumn ? (
                                    <th className="w-12 whitespace-nowrap border-b border-line-strong px-3 py-2.5">图标</th>
                                ) : null}
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
                                    <td colSpan={totalColumnCount} style={{ height: topPadding, padding: 0 }} />
                                </tr>
                            ) : null}
                            {filteredRecords.slice(start, end).map(record => (
                                <DataRow
                                    key={record.key}
                                    record={record}
                                    fields={fields}
                                    primaryField={primaryField}
                                    hasPrimaryField={hasPrimaryField}
                                    showIconColumn={showIconColumn}
                                    groupKey={groupKey}
                                    metaDatasets={metaDatasets}
                                    iconPath={iconPaths.get(record.key) ?? null}
                                    readAsset={readAsset}
                                    selected={record.key === selectedKey}
                                    onSelect={onSelect}
                                />
                            ))}
                            {bottomPadding > 0 ? (
                                <tr aria-hidden="true">
                                    <td colSpan={totalColumnCount} style={{ height: bottomPadding, padding: 0 }} />
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                )}
            </ScrollArea>
        </section>
    )
}
