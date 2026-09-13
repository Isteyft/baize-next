import type { JsonRecord } from '../types/json'
import { collectRecordFields, formatCellValue } from '../utils/json'

/**
 * 中间面板表格：以行列形式展示当前数据集内的所有记录。
 */
interface DataTableProps {
    /** 当前数据集记录列表。 */
    records: JsonRecord[]
    /** 当前选中记录的 key。 */
    selectedKey: string | null
    /** 记录选择回调。 */
    onSelect: (key: string) => void
}

export function DataTable({ records, selectedKey, onSelect }: DataTableProps) {
    const fields = collectRecordFields(records)

    return (
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-3 py-2">
                <h2 className="text-sm font-medium text-gray-300">数据表格</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-900">
                {records.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">当前数据集没有记录</p>
                ) : (
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-gray-800 text-gray-400">
                            <tr>
                                <th className="border-b border-gray-700 px-3 py-2">key</th>
                                {fields.map(field => (
                                    <th key={field} className="border-b border-gray-700 px-3 py-2">
                                        {field}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {records.map(record => (
                                <tr
                                    key={record.key}
                                    onClick={() => onSelect(record.key)}
                                    className={`cursor-pointer border-b border-gray-800 transition-colors ${
                                        record.key === selectedKey ? 'bg-blue-900/50 text-white' : 'text-gray-300 hover:bg-gray-800'
                                    }`}
                                >
                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{record.key}</td>
                                    {fields.map(field => (
                                        <td key={field} className="max-w-64 truncate px-3 py-2">
                                            {record.data[field] === undefined ? (
                                                <span className="text-gray-600">—</span>
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
            </div>
        </section>
    )
}
