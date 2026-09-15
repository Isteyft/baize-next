import { translateField } from '@baize-next/i18n'
import type { JsonRecord, ProjectModGroupKey } from '@baize-next/types'

import { collectRecordFields, formatCellValue } from '../utils/json'
import { ScrollArea } from './ScrollArea'

/**
 * 中间面板表格：以行列形式展示当前分组内的所有记录。
 * - 表头通过 @baize-next/i18n 映射为中文文案，并保持单行。
 * - 每条记录的 key 作为 ID 列展示，数据中若存在 key/id 字段不再重复展示。
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
}

export function DataTable({ groupKey, records, selectedKey, onSelect }: DataTableProps) {
    const allFields = collectRecordFields(records)
    // 主键列按分组类型显示；分组不存在主键字段时不生成伪 ID。
    const primaryField = groupKey ? (PRIMARY_FIELDS[groupKey] ?? null) : null
    const hasPrimaryField = primaryField !== null && records.some(record => record.data[primaryField] !== undefined)
    const fields = allFields.filter(field => field !== 'key' && field !== primaryField)

    return (
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-line bg-panel px-3 py-2">
                <h2 className="text-sm font-medium text-ink-muted">数据表格</h2>
            </div>
            <ScrollArea className="flex-1 bg-panel" viewportClassName="h-full">
                {records.length === 0 ? (
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
                            {records.map(record => (
                                <tr
                                    key={record.key}
                                    onClick={() => onSelect(record.key)}
                                    className={`cursor-pointer border-b border-line transition-colors ${
                                        record.key === selectedKey ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-raised'
                                    }`}
                                >
                                    {hasPrimaryField && primaryField ? (
                                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                                            {record.data[primaryField] !== undefined ? formatCellValue(record.data[primaryField]) : '-'}
                                        </td>
                                    ) : null}
                                    {fields.map(field => (
                                        <td key={field} className="max-w-72 truncate px-4 py-2.5">
                                            {record.data[field] === undefined ? (
                                                <span className="text-ink-subtle">—</span>
                                            ) : (
                                                formatCellValue(record.data[field])
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </ScrollArea>
        </section>
    )
}
