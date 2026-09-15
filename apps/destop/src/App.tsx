import type { JsonValue, ProjectData, ProjectModGroupKey } from '@baize-next/types'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'

import { DataTable } from './components/DataTable'
import { JsonEditor } from './components/JsonEditor'
import { LeftPanel } from './components/LeftPanel'
import { TitleBar } from './components/TitleBar'
import { subscribeTheme } from './theme'
import { parseProjectFromEntries, type ProjectFileEntry } from './utils/json'

/**
 * 桌面端根组件。
 * 职责：打开整个项目目录，展示 plugins/Next 下各 mod 的项目树与分组数据。
 */
export default function App() {
    const [project, setProject] = useState<ProjectData | null>(null)
    const [selectedModId, setSelectedModId] = useState<string | null>(null)
    const [selectedGroupKey, setSelectedGroupKey] = useState<ProjectModGroupKey | null>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)

    const selectedMod = project?.mods.find(mod => mod.id === selectedModId) ?? null
    const selectedGroup = selectedMod?.groups.find(group => group.key === selectedGroupKey) ?? null
    const selectedRecord = selectedGroup?.records.find(record => record.key === selectedRecordKey) ?? null

    // 跨窗口同步主题：主题应用由 theme.ts 内部完成，这里仅注册订阅，使主窗口实时跟随。
    useEffect(() => {
        return subscribeTheme(() => undefined)
    }, [])

    /** 让“文件 > 打开项目”弹出系统目录选择器。 */
    async function handleOpenProject(): Promise<void> {
        try {
            const selected = await open({ directory: true, recursive: true, multiple: false, title: '选择项目目录' })
            if (typeof selected !== 'string' || !selected) return

            const entries = await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: selected })
            const parsedProject = await parseProjectFromEntries(selected, entries)
            setProject(parsedProject)
            const firstMod = parsedProject.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelectedModId(firstMod?.id ?? null)
            setSelectedGroupKey(firstGroup?.key ?? null)
            setSelectedRecordKey(firstGroup?.records[0]?.key ?? null)
        } catch (error) {
            window.alert(error instanceof Error ? `打开项目失败：${error.message}` : '打开项目失败')
        }
    }

    /** 切换到某个 mod 下的数据分组。 */
    function handleSelectGroup(modId: string, groupKey: ProjectModGroupKey): void {
        const mod = project?.mods.find(item => item.id === modId)
        const group = mod?.groups.find(item => item.key === groupKey)
        setSelectedModId(modId)
        setSelectedGroupKey(groupKey)
        setSelectedRecordKey(group?.records[0]?.key ?? null)
    }

    /** 将编辑后的 JSON 字段回写项目状态，让表格实时刷新。 */
    function handleUpdateRecord(recordKey: string, field: string, value: JsonValue): void {
        if (!selectedModId || !selectedGroupKey) return
        setProject(prev =>
            prev
                ? {
                      ...prev,
                      mods: prev.mods.map(mod =>
                          mod.id === selectedModId
                              ? {
                                    ...mod,
                                    groups: mod.groups.map(group =>
                                        group.key === selectedGroupKey
                                            ? {
                                                  ...group,
                                                  records: group.records.map(record =>
                                                      record.key === recordKey
                                                          ? { ...record, data: { ...record.data, [field]: value } }
                                                          : record
                                                  ),
                                              }
                                            : group
                                    ),
                                }
                              : mod
                      ),
                  }
                : prev
        )
    }

    /** 从“设置”菜单打开独立设置窗口。 */
    async function handleOpenSettings(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel('settings')
            if (existing) return

            new WebviewWindow('settings', {
                url: 'index.html?window=settings',
                title: '设置',
                width: 560,
                height: 420,
                minWidth: 420,
                minHeight: 320,
                center: true,
                decorations: false,
            })
        } catch {
            // 非 Tauri 环境（如浏览器预览）时忽略，避免点击设置按钮崩溃。
        }
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink" onContextMenu={event => event.preventDefault()}>
            <TitleBar onOpenProject={() => void handleOpenProject()} onOpenSettings={() => void handleOpenSettings()} />
            <main className="flex min-h-0 flex-1">
                <LeftPanel
                    project={project}
                    selectedModId={selectedModId}
                    selectedGroupKey={selectedGroupKey}
                    onSelectGroup={handleSelectGroup}
                />
                <DataTable
                    groupKey={selectedGroupKey}
                    records={selectedGroup?.records ?? []}
                    selectedKey={selectedRecordKey}
                    onSelect={setSelectedRecordKey}
                />
                <JsonEditor groupKey={selectedGroupKey} record={selectedRecord} onUpdate={handleUpdateRecord} />
            </main>
        </div>
    )
}
