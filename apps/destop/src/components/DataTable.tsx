import { isConsultBookItem } from '@baize-next/core'
import { translateField } from '@baize-next/i18n'
import type { JsonDataset, JsonRecord, JsonValue, ProjectModGroupKey } from '@baize-next/types'
import {
    type FormEvent,
    memo,
    type MouseEvent as ReactMouseEvent,
    useDeferredValue,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

import { type BatchIdChange, buildBatchIdReplacements } from '../utils/batchId'
import {
    collectRecordFields,
    collectSearchableText,
    formatCellValue,
    getGroupEnumLabel,
    getRecordSelectOptions,
    GROUP_ICON_FIELDS,
    hasSearchKeyword,
    matchesSearchQuery,
    type RecordSelectOption,
    resolveModIconPath,
    TABLE_SEARCH_PLACEHOLDER,
} from '../utils/json'
import { AssetIcon } from './AssetIcon'
import { ContextMenu } from './ContextMenu'
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
    /** 当前已选记录 key 集合，用于 Ctrl/Shift 多选。 */
    selectedKeys?: readonly string[]
    /** 记录选择回调；清空选择时传入 null。 */
    onSelect: (key: string | null) => void
    /** 多选集合变化回调。 */
    onSelectionChange?: (keys: string[]) => void
    /** 新增具有指定主键的数据条目。 */
    onCreateRecord?: (key: string, data: Record<string, JsonValue>) => void
    /** 从当前功法或神通记录生成技能书物品。 */
    onGenerateSkillBook?: (recordKey: string) => void
    /** 从当前神通书/功法书物品生成请教书籍。 */
    onGenerateConsultBook?: (recordKey: string) => void
    /** 删除指定记录。 */
    onDeleteRecords?: (keys: string[]) => void
    /** 批量替换选中记录的主键 ID。 */
    onBatchUpdateIds?: (changes: BatchIdChange[]) => void
    /** 已预加载的 meta 数据集，用于把枚举字段渲染为描述文本。 */
    metaDatasets?: JsonDataset[]
    /** 悟道类型记录，用于把悟道的 Type 数组显示为中文名称。 */
    wuDaoTypeRecords?: JsonRecord[]
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
    npcType: ['Type', 'Level'],
    npcWuDao: ['Type', 'lv'],
    wuDaoAllType: ['name', 'name1'],
    wuDao: ['name', 'Lv', 'Type'],
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
    wuDaoAllType: 'id',
    wuDao: 'id',
    tuJianChunWenBen: 'id',
}

/** 暂不展示的字段：tuJianChunWenBen 的词缀项目值，以及 skill 分组的老词缀。 */
const HIDDEN_FIELDS: Partial<Record<ProjectModGroupKey, string[]>> = {
    tuJianChunWenBen: ['name1'],
    shenTong: ['Affix'],
}

function parseRecordId(value: string): string | number {
    if (!/^-?\d+$/.test(value)) return value
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : value
}

export type NpcBatchRealmField = 'Level' | 'lv'

export interface NpcBatchGenerationResult {
    records: JsonRecord[]
    conflictKey: string | null
}

/**
 * 以指定 NPC 记录为模板，生成境界 1-15 的批量记录。
 * 流水号从模板 ID 后连续递增，除 id 与境界字段外的字段保持不变。
 */
export function buildNpcBatchRecords(
    records: JsonRecord[],
    templateKey: string,
    realmField: NpcBatchRealmField = 'Level'
): NpcBatchGenerationResult {
    const template = records.find(record => record.key === templateKey)
    const templateId = Number(template?.data.id)
    if (!template || !Number.isSafeInteger(templateId)) {
        return { records: [], conflictKey: template?.key ?? templateKey }
    }

    const existingKeys = new Set(records.map(record => record.key))
    const existingIds = new Set(
        records
            .map(record => record.data.id)
            .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
            .map(String)
    )
    const generatedRecords: JsonRecord[] = []

    for (let level = 1; level <= 15; level += 1) {
        const id = templateId + level
        const key = String(id)
        if (existingKeys.has(key) || existingIds.has(key)) {
            return { records: generatedRecords, conflictKey: key }
        }
        generatedRecords.push({
            key,
            data: {
                ...template.data,
                id,
                [realmField]: level,
            },
        })
    }

    return { records: generatedRecords, conflictKey: null }
}

/** 将一个悟道类型值转换成悟道类型表中的中文名称。 */
function formatWuDaoTypeValue(value: JsonValue, options: RecordSelectOption[]): string {
    const values = Array.isArray(value) ? value : [value]
    return values
        .map(item => {
            const id = typeof item === 'number' ? item : typeof item === 'string' && item.trim() ? Number(item.trim()) : NaN
            if (!Number.isFinite(id)) return formatCellValue(item)
            const option = options.find(candidate => candidate.id === id)
            if (!option) return formatCellValue(item)
            const prefix = `${option.id} `
            return option.label.startsWith(prefix) ? option.label.slice(prefix.length) : option.label
        })
        .join('、')
}

/**
 * 将单元格值格式化为展示文本：配置了 meta 枚举的字段显示“描述(id)”，其余保持原样。
 * @param groupKey 当前分组 key。
 * @param field 字段名。
 * @param value 字段值。
 * @param metaDatasets 已预加载的 meta 数据集。
 * @param wuDaoTypeOptions 悟道类型选项，用于把悟道的 Type 数组显示为中文名称。
 */
export function formatCellText(
    groupKey: ProjectModGroupKey | null,
    field: string,
    value: JsonValue,
    metaDatasets: JsonDataset[] = [],
    wuDaoTypeOptions: RecordSelectOption[] = []
): string {
    if (groupKey === 'wuDao' && field === 'Type') return formatWuDaoTypeValue(value, wuDaoTypeOptions)
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
    wuDaoTypeOptions: RecordSelectOption[]
    /** 当前记录图标的 Assets 相对路径，无图标时为 null。 */
    iconPath: string | null
    /** 读取 mod 资源并返回可展示的 data URL。 */
    readAsset?: ((relativePath: string) => Promise<string | null>) | undefined
    selected: boolean
    onSelect: (key: string, event: ReactMouseEvent<HTMLTableRowElement>) => void
    onContextMenu: (key: string, event: ReactMouseEvent<HTMLTableRowElement>) => void
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
    wuDaoTypeOptions,
    iconPath,
    readAsset,
    selected,
    onSelect,
    onContextMenu,
}: DataRowProps) {
    return (
        <tr
            onClick={event => onSelect(record.key, event)}
            onContextMenu={event => onContextMenu(record.key, event)}
            className={
                'cursor-pointer border-b border-line transition-colors ' +
                (selected ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised')
            }
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
                        ? formatCellText(groupKey, primaryField, record.data[primaryField], metaDatasets, wuDaoTypeOptions)
                        : '-'}
                </td>
            ) : null}
            {fields.map(field => {
                const value = record.data[field]
                return (
                    <td key={field} className="max-w-72 truncate px-4 py-2.5">
                        {value === undefined ? (
                            <span className="text-ink-subtle">—</span>
                        ) : (
                            formatCellText(groupKey, field, value, metaDatasets, wuDaoTypeOptions)
                        )}
                    </td>
                )
            })}
        </tr>
    )
})

export function DataTable({
    groupKey,
    records,
    selectedKey,
    selectedKeys,
    onSelect,
    onSelectionChange,
    onCreateRecord,
    onGenerateSkillBook,
    onGenerateConsultBook,
    onDeleteRecords,
    onBatchUpdateIds,
    metaDatasets = [],
    wuDaoTypeRecords = [],
    searchPlaceholder = TABLE_SEARCH_PLACEHOLDER,
    modDirectory = null,
    readAsset,
}: DataTableProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const frameRef = useRef<number | null>(null)
    const selectionAnchorRef = useRef<string | null>(selectedKey)
    const prevGroupKeyRef = useRef(groupKey)
    const prevQueryRef = useRef('')
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [query, setQuery] = useState('')
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; keys: string[] } | null>(null)
    const [addOpen, setAddOpen] = useState(false)
    const [addId, setAddId] = useState('')
    const [addError, setAddError] = useState('')
    const [deleteKeys, setDeleteKeys] = useState<string[] | null>(null)
    const [idConflict, setIdConflict] = useState<string | null>(null)
    const [batchModifyKeys, setBatchModifyKeys] = useState<string[] | null>(null)
    const [batchIdInput, setBatchIdInput] = useState('')
    const [batchIdError, setBatchIdError] = useState('')
    const [batchIdConflict, setBatchIdConflict] = useState<string | null>(null)

    const contextMenuRecord =
        contextMenu && contextMenu.keys.length === 1 ? (records.find(record => record.key === contextMenu.keys[0]) ?? null) : null
    const canGenerateConsultBook =
        contextMenu !== null &&
        contextMenu.keys.length === 1 &&
        groupKey === 'item' &&
        onGenerateConsultBook !== undefined &&
        contextMenuRecord !== null &&
        isConsultBookItem(contextMenuRecord)

    const primaryField = groupKey ? (PRIMARY_FIELDS[groupKey] ?? null) : null
    const batchRealmField: NpcBatchRealmField | null = groupKey === 'npcType' ? 'Level' : groupKey === 'npcWuDao' ? 'lv' : null
    const currentSelectedKeys = selectedKeys ?? (selectedKey ? [selectedKey] : [])
    const selectedKeySet = useMemo(() => new Set(currentSelectedKeys), [currentSelectedKeys])
    const wuDaoTypeOptions = useMemo(() => getRecordSelectOptions(wuDaoTypeRecords), [wuDaoTypeRecords])
    const showIconColumn = Boolean(modDirectory) && groupKey !== null && groupKey !== 'wuDao' && GROUP_ICON_FIELDS[groupKey] !== undefined
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
    const searchIndex = useMemo(() => sortedRecords.map(record => searchIndexKey(record, primaryField)), [sortedRecords, primaryField])
    const deferredQuery = useDeferredValue(query)
    const filteredRecords = useMemo(() => {
        if (!hasSearchKeyword(deferredQuery)) return sortedRecords
        return sortedRecords.filter((_, index) => matchesSearchQuery(searchIndex[index] ?? '', deferredQuery))
    }, [sortedRecords, searchIndex, deferredQuery])

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

    useLayoutEffect(() => {
        const groupChanged = prevGroupKeyRef.current !== groupKey
        const changed = groupChanged || prevQueryRef.current !== deferredQuery
        if (!changed) return
        if (groupChanged) selectionAnchorRef.current = selectedKey
        prevGroupKeyRef.current = groupKey
        prevQueryRef.current = deferredQuery
        const viewport = viewportRef.current
        if (viewport) viewport.scrollTop = 0
        setScrollTop(0)
    }, [groupKey, deferredQuery, selectedKey])

    useEffect(() => {
        setContextMenu(null)
        setAddOpen(false)
        setAddId('')
        setAddError('')
        setDeleteKeys(null)
        setIdConflict(null)
        setBatchModifyKeys(null)
        setBatchIdInput('')
        setBatchIdError('')
        setBatchIdConflict(null)
    }, [groupKey])

    function commitSelection(keys: string[], activeKey: string | null): void {
        const nextKeys = [...new Set(keys)]
        onSelectionChange?.(nextKeys)
        onSelect(activeKey)
    }

    function handleRowClick(recordKey: string, event: ReactMouseEvent<HTMLTableRowElement>): void {
        const visibleKeys = filteredRecords.map(record => record.key)
        if (event.shiftKey) {
            let anchorKey = selectionAnchorRef.current
            let anchorIndex = anchorKey ? visibleKeys.indexOf(anchorKey) : -1
            if (anchorIndex < 0 && selectedKey) {
                anchorKey = selectedKey
                anchorIndex = visibleKeys.indexOf(selectedKey)
            }
            const targetIndex = visibleKeys.indexOf(recordKey)
            if (anchorIndex < 0 || targetIndex < 0) {
                selectionAnchorRef.current = recordKey
                commitSelection([recordKey], recordKey)
                return
            }
            const start = Math.min(anchorIndex, targetIndex)
            const end = Math.max(anchorIndex, targetIndex)
            const range = visibleKeys.slice(start, end + 1)
            const nextKeys = event.ctrlKey || event.metaKey ? [...new Set([...currentSelectedKeys, ...range])] : range
            commitSelection(nextKeys, recordKey)
            return
        }

        if (event.ctrlKey || event.metaKey) {
            const nextKeys = new Set(currentSelectedKeys)
            let activeKey: string | null = recordKey
            if (nextKeys.has(recordKey)) {
                nextKeys.delete(recordKey)
                if (selectedKey === recordKey) {
                    const remaining = [...nextKeys]
                    activeKey = remaining[remaining.length - 1] ?? null
                }
            } else {
                nextKeys.add(recordKey)
            }
            selectionAnchorRef.current = recordKey
            commitSelection([...nextKeys], activeKey)
            return
        }

        selectionAnchorRef.current = recordKey
        commitSelection([recordKey], recordKey)
    }

    function handleRowContextMenu(recordKey: string, event: ReactMouseEvent<HTMLTableRowElement>): void {
        event.preventDefault()
        event.stopPropagation()
        const keys = selectedKeySet.has(recordKey) ? [...selectedKeySet] : [recordKey]
        if (!selectedKeySet.has(recordKey)) {
            selectionAnchorRef.current = recordKey
            commitSelection([recordKey], recordKey)
        }
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            keys,
        })
    }

    function handleAddSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault()
        if (!primaryField || !onCreateRecord) return
        const id = addId.trim()
        if (!id) {
            setAddError('请输入 ID')
            return
        }
        const value = parseRecordId(id)
        const key = String(value)
        const duplicate = records.some(record => {
            const current = record.data[primaryField]
            return record.key === key || (typeof current === 'number' || typeof current === 'string' ? String(current) === key : false)
        })
        if (duplicate) {
            setAddError('该 ID 已存在')
            return
        }
        onCreateRecord(key, { [primaryField]: value })
        setAddOpen(false)
        setAddId('')
        setAddError('')
    }

    function handleBatchGenerate(templateKey: string): void {
        if (!batchRealmField || !onCreateRecord) return
        setContextMenu(null)
        const result = buildNpcBatchRecords(records, templateKey, batchRealmField)
        for (const record of result.records) {
            onCreateRecord(record.key, record.data)
        }
        setIdConflict(result.conflictKey)
    }

    function handleGenerateSkillBook(recordKey: string): void {
        if (!onGenerateSkillBook) return
        setContextMenu(null)
        onGenerateSkillBook(recordKey)
    }

    function handleGenerateConsultBook(recordKey: string): void {
        if (!onGenerateConsultBook) return
        setContextMenu(null)
        onGenerateConsultBook(recordKey)
    }

    function openBatchIdDialog(keys: string[]): void {
        setContextMenu(null)
        setBatchModifyKeys(keys)
        setBatchIdInput('')
        setBatchIdError('')
        setBatchIdConflict(null)
    }

    function submitBatchIdDialog(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault()
        if (!batchModifyKeys || !primaryField || !onBatchUpdateIds) return
        setBatchIdError('')
        const result = buildBatchIdReplacements(records, batchModifyKeys, primaryField, batchIdInput)
        if (!result.ok) {
            if (result.code === 'conflict') {
                setBatchIdConflict(result.conflictingId ?? result.message)
                setBatchModifyKeys(null)
            } else {
                setBatchIdError(result.message)
            }
            return
        }
        onBatchUpdateIds(result.changes)
        setBatchModifyKeys(null)
        setBatchIdInput('')
        setBatchIdError('')
    }

    function confirmDelete(): void {
        if (!deleteKeys || !onDeleteRecords) return
        onDeleteRecords(deleteKeys)
        setDeleteKeys(null)
        setContextMenu(null)
    }

    const { start, end } = getVisibleRange(scrollTop, viewportHeight || FALLBACK_VIEWPORT_HEIGHT, filteredRecords.length)
    const topPadding = start * ROW_HEIGHT
    const bottomPadding = (filteredRecords.length - end) * ROW_HEIGHT
    const totalColumnCount = fields.length + (hasPrimaryField ? 1 : 0) + (showIconColumn ? 1 : 0)
    return (
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-2">
                {primaryField ? (
                    <button
                        type="button"
                        aria-label="增加记录"
                        disabled={!onCreateRecord}
                        onClick={() => {
                            setAddId('')
                            setAddError('')
                            setAddOpen(true)
                        }}
                        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        增加
                    </button>
                ) : null}
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
                                    wuDaoTypeOptions={wuDaoTypeOptions}
                                    iconPath={iconPaths.get(record.key) ?? null}
                                    readAsset={readAsset}
                                    selected={selectedKeySet.has(record.key)}
                                    onSelect={handleRowClick}
                                    onContextMenu={handleRowContextMenu}
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

            {contextMenu ? (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    {canGenerateConsultBook ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleGenerateConsultBook(contextMenu.keys[0]!)}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                        >
                            生成请教书籍
                        </button>
                    ) : null}
                    {(groupKey === 'skill' || groupKey === 'shenTong') && onGenerateSkillBook && contextMenu.keys.length === 1 ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleGenerateSkillBook(contextMenu.keys[0]!)}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                        >
                            生成技能书
                        </button>
                    ) : null}
                    {batchRealmField && onCreateRecord && contextMenu.keys.length === 1 ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleBatchGenerate(contextMenu.keys[0]!)}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                        >
                            批量生成
                        </button>
                    ) : null}
                    {primaryField && onBatchUpdateIds && contextMenu.keys.length > 0 ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => openBatchIdDialog(contextMenu.keys)}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                        >
                            批量修改 ID
                        </button>
                    ) : null}

                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => setDeleteKeys(contextMenu.keys)}
                        className="flex w-full items-center px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                    >
                        删除{contextMenu.keys.length > 1 ? ' (' + contextMenu.keys.length + ')' : ''}
                    </button>
                </ContextMenu>
            ) : null}

            {addOpen ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setAddOpen(false)
                    }}
                >
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-label="增加数据条目"
                        onSubmit={handleAddSubmit}
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">增加数据条目</h3>
                        </header>
                        <div className="p-5">
                            <label className="mb-2 block text-sm text-ink-soft" htmlFor="data-table-add-id">
                                ID
                            </label>
                            <input
                                id="data-table-add-id"
                                autoFocus
                                value={addId}
                                onChange={event => {
                                    setAddId(event.target.value)
                                    setAddError('')
                                }}
                                className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
                                placeholder="请输入 ID"
                            />
                            {addError ? <p className="mt-2 text-sm text-danger">{addError}</p> : null}
                        </div>
                        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
                            <button
                                type="button"
                                onClick={() => setAddOpen(false)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                确定
                            </button>
                        </footer>
                    </form>
                </div>
            ) : null}

            {batchModifyKeys ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setBatchModifyKeys(null)
                    }}
                >
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-label="批量修改 ID"
                        onSubmit={submitBatchIdDialog}
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">批量修改 ID</h3>
                        </header>
                        <div className="p-5">
                            <p className="mb-3 text-sm text-ink-soft">已选择 {batchModifyKeys.length} 条记录，请输入首个 ID。</p>
                            <label className="mb-2 block text-sm text-ink-soft" htmlFor="data-table-batch-id">
                                首个 ID
                            </label>
                            <input
                                id="data-table-batch-id"
                                type="text"
                                value={batchIdInput}
                                onChange={event => setBatchIdInput(event.target.value)}
                                autoFocus
                                placeholder="请输入首个 ID"
                                className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm text-ink transition-colors placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                            />
                            {batchIdError ? <p className="mt-2 text-sm text-danger">{batchIdError}</p> : null}
                        </div>
                        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
                            <button
                                type="button"
                                onClick={() => setBatchModifyKeys(null)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                确定
                            </button>
                        </footer>
                    </form>
                </div>
            ) : null}

            {batchIdConflict ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setBatchIdConflict(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="批量修改 ID 冲突"
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">批量修改 ID</h3>
                        </header>
                        <p className="px-5 py-5 text-sm text-ink-soft">ID {batchIdConflict} 已被占用，批量修改已取消。</p>
                        <footer className="flex justify-end border-t border-line px-5 py-3">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setBatchIdConflict(null)}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                知道
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}

            {idConflict ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setIdConflict(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="ID 冲突"
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">ID 冲突</h3>
                        </header>
                        <p className="px-5 py-5 text-sm text-ink-soft">ID {idConflict} 已存在，批量生成已停止。</p>
                        <footer className="flex justify-end border-t border-line px-5 py-3">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setIdConflict(null)}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                知道了
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}

            {deleteKeys ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setDeleteKeys(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="确认删除"
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">确认删除</h3>
                        </header>
                        <p className="px-5 py-5 text-sm text-ink-soft">确定删除已选中的 {deleteKeys.length} 条记录吗？</p>
                        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
                            <button
                                type="button"
                                onClick={() => setDeleteKeys(null)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                            >
                                确认删除
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}
        </section>
    )
}
