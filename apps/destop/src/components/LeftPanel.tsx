import type { ProjectData, ProjectMod, ProjectModGroupKey } from '@baize-next/types'
import { useEffect, useRef, useState } from 'react'

import type { SelectionSource } from '../App'

/**
 * 左侧面板：分为“预加载数据”和“项目数据”两个可折叠区域。
 * - 预加载数据：mod 预加载得到的项目数据。
 * - 项目数据：打开项目后识别到的 mod，可折叠 mod 与其分组。
 * 右键项目区域可新建 mod；右键某个 mod 可重命名或删除。
 */
interface LeftPanelProps {
    /** mod 预加载得到的项目数据。 */
    preloadProject: ProjectData | null
    /** 当前打开的项目。 */
    project: ProjectData | null
    /** 当前选中来源。 */
    selection: SelectionSource
    /** 选择 mod 预加载分组回调。 */
    onSelectPreloadGroup: (modId: string, groupKey: ProjectModGroupKey) => void
    /** 选择项目分组回调。 */
    onSelectGroup: (modId: string, groupKey: ProjectModGroupKey) => void
    /** 创建 mod 回调，仅需名称。 */
    onCreateMod: (name: string) => void
    /** 重命名 mod 回调。 */
    onRenameMod: (modId: string, name: string) => void
    /** 删除 mod 回调。 */
    onDeleteMod: (modId: string) => void
}

type MenuState = { kind: 'project'; x: number; y: number } | { kind: 'mod'; x: number; y: number; modId: string; modName: string } | null

const PRELOAD_SECTION_TITLE = '预加载数据'
const PROJECT_SECTION_TITLE = '项目数据'
const EMPTY_PRELOAD_TEXT = '暂无 mod 预加载数据'
const EMPTY_PROJECT_TEXT = '请通过“文件”菜单打开项目'
const EMPTY_MOD_TEXT = '项目下未识别到 mod'
const CREATE_MOD_TEXT = '新建 mod'
const RENAME_MOD_TEXT = '重命名'
const DELETE_MOD_TEXT = '删除'
const MOD_NAME_PLACEHOLDER = 'mod 名称'
const CONFIRM_TEXT = '确定'
const CANCEL_TEXT = '取消'
const NEW_MOD_PREFIX = 'mod'

function Chevron({ open }: { open: boolean }) {
    return (
        <span aria-hidden="true" className={`inline-block w-3 text-ink-subtle transition-transform ${open ? 'rotate-90' : ''}`}>
            ▶
        </span>
    )
}

export function LeftPanel({
    preloadProject,
    project,
    selection,
    onSelectPreloadGroup,
    onSelectGroup,
    onCreateMod,
    onRenameMod,
    onDeleteMod,
}: LeftPanelProps) {
    const [preloadOpen, setPreloadOpen] = useState(true)
    const [projectOpen, setProjectOpen] = useState(true)
    const [collapsedModIds, setCollapsedModIds] = useState<string[]>([])
    const [menu, setMenu] = useState<MenuState>(null)
    const [editing, setEditing] = useState<{ modId: string; mode: 'create' | 'rename' } | null>(null)
    const [modName, setModName] = useState(NEW_MOD_PREFIX)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!menu) return
        function handleDocumentClick(event: MouseEvent): void {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenu(null)
            }
        }
        function handleKeydown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setMenu(null)
        }
        document.addEventListener('mousedown', handleDocumentClick)
        document.addEventListener('keydown', handleKeydown)
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick)
            document.removeEventListener('keydown', handleKeydown)
        }
    }, [menu])

    function toggleMod(modId: string): void {
        setCollapsedModIds(prev => (prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]))
    }

    function openCreateMod(): void {
        setMenu(null)
        setModName(NEW_MOD_PREFIX)
        setEditing({ modId: '', mode: 'create' })
        setProjectOpen(true)
    }

    function openRenameMod(modId: string, modName: string): void {
        setMenu(null)
        setModName(modName)
        setEditing({ modId, mode: 'rename' })
    }

    function submitEditing(): void {
        const name = modName.trim()
        if (!editing) return
        if (!name) return
        if (editing.mode === 'create') {
            onCreateMod(name)
        } else {
            onRenameMod(editing.modId, name)
        }
        setEditing(null)
        setModName(NEW_MOD_PREFIX)
    }

    function renderNameEditor(placeholder: string) {
        return (
            <div className="mb-1 flex items-center gap-1 px-2 py-1 pl-4">
                <input
                    autoFocus
                    type="text"
                    value={modName}
                    onChange={event => setModName(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter') submitEditing()
                        if (event.key === 'Escape') setEditing(null)
                    }}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 rounded-md border border-line bg-raised px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                />
                <button
                    type="button"
                    onClick={submitEditing}
                    className="rounded-md bg-accent px-2 py-1 text-xs text-accent-ink hover:bg-accent-hover"
                >
                    {CONFIRM_TEXT}
                </button>
                <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-raised"
                >
                    {CANCEL_TEXT}
                </button>
            </div>
        )
    }

    function renderModTree(
        source: 'preload' | 'project',
        mods: ProjectMod[],
        onSelect: (modId: string, groupKey: ProjectModGroupKey) => void,
        manageable: boolean
    ) {
        return (
            <div className="mt-0.5">
                {mods.length === 0 ? <p className="px-2 py-1.5 pl-6 text-xs text-ink-subtle">{EMPTY_MOD_TEXT}</p> : null}
                {manageable && editing?.mode === 'create' ? renderNameEditor(MOD_NAME_PLACEHOLDER) : null}
                {mods.map(mod => {
                    const collapsed = collapsedModIds.includes(mod.id)
                    const renaming = manageable && editing?.mode === 'rename' && editing.modId === mod.id
                    return (
                        <div key={mod.id} className="mb-1">
                            {renaming ? (
                                renderNameEditor(MOD_NAME_PLACEHOLDER)
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => toggleMod(mod.id)}
                                    onContextMenu={
                                        manageable
                                            ? event => {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  setMenu({
                                                      kind: 'mod',
                                                      x: event.clientX,
                                                      y: event.clientY,
                                                      modId: mod.id,
                                                      modName: mod.name,
                                                  })
                                              }
                                            : undefined
                                    }
                                    className="flex w-full items-center gap-1.5 rounded-md py-1.5 pl-4 pr-3 text-left text-xs font-medium text-ink-soft hover:bg-raised"
                                >
                                    <Chevron open={!collapsed} />
                                    <span className="truncate">{mod.name}</span>
                                </button>
                            )}
                            {!collapsed ? (
                                <ul>
                                    {mod.groups.length === 0 ? (
                                        <li className="py-1 pl-9 pr-3 text-xs text-ink-subtle">暂无数据</li>
                                    ) : (
                                        mod.groups.map(group => {
                                            const active =
                                                selection?.kind === source && selection.modId === mod.id && selection.groupKey === group.key
                                            return (
                                                <li key={group.key}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelect(mod.id, group.key)}
                                                        className={`w-full rounded-md py-1.5 pl-9 pr-3 text-left text-xs transition-colors ${
                                                            active ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:bg-raised'
                                                        }`}
                                                    >
                                                        {group.label}
                                                    </button>
                                                </li>
                                            )
                                        })
                                    )}
                                </ul>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-line bg-panel">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <section className="mb-2">
                    <button
                        type="button"
                        onClick={() => setPreloadOpen(value => !value)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink-soft hover:bg-raised"
                    >
                        <Chevron open={preloadOpen} />
                        <span className="truncate">
                            {PRELOAD_SECTION_TITLE}
                            {preloadProject ? ` · ${preloadProject.name}` : ''}
                        </span>
                    </button>
                    {preloadOpen ? (
                        !preloadProject || preloadProject.mods.length === 0 ? (
                            <p className="px-2 py-1.5 pl-6 text-xs text-ink-subtle">{EMPTY_PRELOAD_TEXT}</p>
                        ) : (
                            renderModTree('preload', preloadProject.mods, onSelectPreloadGroup, false)
                        )
                    ) : null}
                </section>

                <section>
                    <div
                        onContextMenu={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            setMenu({ kind: 'project', x: event.clientX, y: event.clientY })
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setProjectOpen(value => !value)}
                            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink-soft hover:bg-raised"
                        >
                            <Chevron open={projectOpen} />
                            <span className="truncate">
                                {project ? `${PROJECT_SECTION_TITLE} · ${project.name}` : PROJECT_SECTION_TITLE}
                            </span>
                        </button>
                    </div>
                    {projectOpen ? (
                        <div className="mt-0.5">
                            {!project ? (
                                <p className="px-2 py-1.5 pl-6 text-xs text-ink-subtle">{EMPTY_PROJECT_TEXT}</p>
                            ) : (
                                renderModTree('project', project.mods, onSelectGroup, true)
                            )}
                        </div>
                    ) : null}
                </section>
            </div>

            {menu ? (
                <div
                    ref={menuRef}
                    style={{ left: menu.x, top: menu.y }}
                    className="fixed z-50 min-w-32 rounded-md border border-line-strong bg-raised py-1 shadow-lg"
                >
                    {menu.kind === 'project' ? (
                        <button
                            type="button"
                            onClick={openCreateMod}
                            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                        >
                            {CREATE_MOD_TEXT}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => openRenameMod(menu.modId, menu.modName)}
                                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                            >
                                {RENAME_MOD_TEXT}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMenu(null)
                                    onDeleteMod(menu.modId)
                                }}
                                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-danger hover:bg-hover"
                            >
                                {DELETE_MOD_TEXT}
                            </button>
                        </>
                    )}
                </div>
            ) : null}
        </aside>
    )
}
