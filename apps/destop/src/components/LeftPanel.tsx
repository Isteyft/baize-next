import type { JsonDataset } from '../types/json'

/**
 * 左侧面板：列出已加载的 JSON 数据集，并允许选择当前数据集。
 */
interface LeftPanelProps {
    /** 所有已加载数据集。 */
    datasets: JsonDataset[]
    /** 当前选中的数据集 id。 */
    selectedId: string | null
    /** 数据集选择回调。 */
    onSelect: (id: string) => void
}

export function LeftPanel({ datasets, selectedId, onSelect }: LeftPanelProps) {
    return (
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-gray-800 bg-gray-900">
            <div className="shrink-0 border-b border-gray-800 p-3">
                <h2 className="text-sm font-medium text-gray-300">JSON 数据集</h2>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {datasets.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">请通过“文件”菜单打开 JSON 文件或文件夹</li>}
                {datasets.map(dataset => (
                    <li key={dataset.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(dataset.id)}
                            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                dataset.id === selectedId ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                            }`}
                        >
                            <div className="truncate font-medium">{dataset.name}</div>
                            <div className={`text-xs ${dataset.id === selectedId ? 'text-blue-200' : 'text-gray-500'}`}>
                                {dataset.kind === 'folder' ? '目录' : '文件'} · {dataset.records.length} 条
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    )
}
