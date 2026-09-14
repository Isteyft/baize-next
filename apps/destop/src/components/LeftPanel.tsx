import type { ProjectData, ProjectModGroupKey } from '@baize-next/types'

/**
 * 左侧面板：以项目结构树形式展示 mod 及其数据分组。
 */
interface LeftPanelProps {
    /** 当前打开的项目。 */
    project: ProjectData | null
    /** 当前选中的 mod id。 */
    selectedModId: string | null
    /** 当前选中的分组键。 */
    selectedGroupKey: ProjectModGroupKey | null
    /** 分组选择回调。 */
    onSelectGroup: (modId: string, groupKey: ProjectModGroupKey) => void
}

export function LeftPanel({ project, selectedModId, selectedGroupKey, onSelectGroup }: LeftPanelProps) {
    return (
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-gray-800 bg-gray-900">
            <div className="shrink-0 border-b border-gray-800 p-3">
                <h2 className="text-sm font-medium text-gray-300">项目结构</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {!project ? (
                    <p className="px-2 py-3 text-sm text-gray-500">请通过“文件”菜单打开项目</p>
                ) : (
                    <>
                        <div className="mb-2 px-2 text-sm font-semibold text-gray-200">{project.name}</div>
                        {project.mods.length === 0 && <p className="px-2 py-2 text-sm text-gray-500">项目下未识别到 mod</p>}
                        {project.mods.map(mod => (
                            <div key={mod.id} className="mb-2">
                                <div className="px-2 py-1 text-sm font-medium text-gray-200">{mod.name}</div>
                                <ul>
                                    {mod.groups.map(group => (
                                        <li key={group.key}>
                                            <button
                                                type="button"
                                                onClick={() => onSelectGroup(mod.id, group.key)}
                                                className={`w-full rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                                                    mod.id === selectedModId && group.key === selectedGroupKey
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-300 hover:bg-gray-800'
                                                }`}
                                            >
                                                {group.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </aside>
    )
}
