import type { ProjectData, ProjectModGroupKey } from '@baize-next/types'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'

import { DataTable } from './components/DataTable'
import { LeftPanel } from './components/LeftPanel'
import { RightTodo } from './components/RightTodo'
import { TitleBar } from './components/TitleBar'
import { subscribeTheme } from './theme'
import { parseProjectFromFiles } from './utils/json'

/**
 * 桌面端根组件。
 * 职责：打开整个项目目录，展示 plugins/Next 下各 mod 的项目树与分组数据。
 */
export default function App() {
    const [project, setProject] = useState<ProjectData | null>(null)
    const [selectedModId, setSelectedModId] = useState<string | null>(null)
    const [selectedGroupKey, setSelectedGroupKey] = useState<ProjectModGroupKey | null>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)

    const projectInputRef = useRef<HTMLInputElement | null>(null)

    const selectedMod = project?.mods.find(mod => mod.id === selectedModId) ?? null
    const selectedGroup = selectedMod?.groups.find(group => group.key === selectedGroupKey) ?? null

    // 项目根目录选择控件需要 webkitdirectory 支持整目录读取。
    useEffect(() => {
        projectInputRef.current?.setAttribute('webkitdirectory', '')
    }, [])

    // 跨窗口同步主题：主题应用由 theme.ts 内部完成，这里仅注册订阅，使主窗口实时跟随。
    useEffect(() => {
        return subscribeTheme(() => undefined)
    }, [])

    /** 让“文件 > 打开项目”触发项目目录选择。 */
    function handleOpenProject(): void {
        projectInputRef.current?.click()
    }

    /** 选择项目根目录后解析项目结构。 */
    async function handleProjectChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const files = event.target.files
        if (!files || files.length === 0) return
        try {
            const parsedProject = await parseProjectFromFiles(Array.from(files))
            setProject(parsedProject)
            const firstMod = parsedProject.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelectedModId(firstMod?.id ?? null)
            setSelectedGroupKey(firstGroup?.key ?? null)
            setSelectedRecordKey(firstGroup?.records[0]?.key ?? null)
        } catch (error) {
            window.alert(error instanceof Error ? `打开项目失败：${error.message}` : '打开项目失败')
        } finally {
            event.target.value = ''
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
            <TitleBar onOpenProject={handleOpenProject} onOpenSettings={() => void handleOpenSettings()} />
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
                <RightTodo />
            </main>

            {/* 隐藏的项目根目录选择输入框 */}
            <input ref={projectInputRef} type="file" className="hidden" onChange={event => void handleProjectChange(event)} />
        </div>
    )
}
