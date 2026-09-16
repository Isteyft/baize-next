import type { ProjectData, ProjectMod, ProjectModGroupKey } from '@baize-next/types'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { SelectionSource } from '../utils/projectSession'

/**
 * 左侧面板：分为“预加载数据”和“项目数据”两个可折叠区域。
 * - 两个区域直接展开全部项目，并在各项目下独立展示 Mod。
 * - 项目右键菜单提供新建 Mod 与关闭项目；Mod 右键菜单提供重命名与删除。
 */
interface LeftPanelProps {
    /** 已加载的 Mod 预加载项目。 */
    preloadProjects: ProjectData[]
    /** 当前同时打开的项目。 */
    projects: ProjectData[]
    /** 当前选中来源。 */
    selection: SelectionSource
    /** 选择 Mod 预加载分组。 */
    onSelectPreloadGroup: (projectId: string, modId: string, groupKey: ProjectModGroupKey) => void
    /** 选择项目分组。 */
    onSelectGroup: (projectId: string, modId: string, groupKey: ProjectModGroupKey) => void
    /** 在指定项目中创建 Mod。 */
    onCreateMod: (projectId: string, name: string) => void
    /** 重命名指定项目中的 Mod。 */
    onRenameMod: (projectId: string, modId: string, name: string) => void
    /** 删除指定项目中的 Mod。 */
    onDeleteMod: (projectId: string, modId: string) => void
    /** 从当前预加载结果中移除指定 Mod。 */
    onDeletePreloadMod: (projectId: string, modId: string) => void
    /** 保存指定项目。 */
    onSaveProject: (projectId: string) => void
    /** 关闭项目并卸载其数据。 */
    onCloseProject: (projectId: string) => void
    /** 从当前预加载结果中移除项目。 */
    onClosePreloadProject: (projectId: string) => void
}

type MenuState =
    | { kind: 'project'; source: 'preload' | 'project'; x: number; y: number; projectId: string }
    | {
          kind: 'mod'
          x: number
          y: number
          source: 'preload' | 'project'
          projectId: string
          modId: string
          modName: string
      }
    | null

type EditingState = { projectId: string; modId: string; mode: 'create' | 'rename' } | null

const PRELOAD_SECTION_TITLE = '预加载数据'
const PROJECT_SECTION_TITLE = '项目数据'
const EMPTY_PRELOAD_TEXT = '暂无 Mod 预加载项目'
const EMPTY_PROJECT_TEXT = '暂未打开项目，请通过“文件”菜单打开'
const EMPTY_MOD_TEXT = '项目下未识别到 Mod'
const SAVE_PROJECT_TEXT = '保存该项目'
const CREATE_MOD_TEXT = '新建 Mod'
const RENAME_MOD_TEXT = '重命名'
const DELETE_MOD_TEXT = '删除 Mod'
const CLOSE_PROJECT_TEXT = '关闭此项目'
const MOD_NAME_PLACEHOLDER = 'Mod 名称'
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
    preloadProjects,
    projects,
    selection,
    onSelectPreloadGroup,
    onSelectGroup,
    onCreateMod,
    onRenameMod,
    onDeleteMod,
    onDeletePreloadMod,
    onSaveProject,
    onCloseProject,
    onClosePreloadProject,
}: LeftPanelProps) {
    const [preloadOpen, setPreloadOpen] = useState(true)
    const [projectOpen, setProjectOpen] = useState(true)
    const [collapsedProjectKeys, setCollapsedProjectKeys] = useState<string[]>([])
    const [collapsedModKeys, setCollapsedModKeys] = useState<string[]>([])
    const [menu, setMenu] = useState<MenuState>(null)
    const [editing, setEditing] = useState<EditingState>(null)
    const [modName, setModName] = useState(NEW_MOD_PREFIX)
    const asideRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const root = asideRef.current
        if (!root) return
        function handleContextMenu(event: MouseEvent): void {
            const target = event.target instanceof Element ? event.target : null
            const contextNode = target?.closest<HTMLElement>('[data-context-kind]') ?? null
            if (!contextNode) return

            const source = contextNode.dataset.contextSource === 'preload' ? 'preload' : 'project'
            event.preventDefault()
            event.stopPropagation()

            if (contextNode.dataset.contextKind === 'mod') {
                setMenu({
                    kind: 'mod',
                    x: event.clientX,
                    y: event.clientY,
                    source,
                    projectId: contextNode.dataset.contextProjectId ?? '',
                    modId: contextNode.dataset.contextModId ?? '',
                    modName: contextNode.dataset.contextModName ?? '',
                })
                return
            }

            if (contextNode.dataset.contextKind === 'project') {
                setMenu({
                    kind: 'project',
                    source,
                    x: event.clientX,
                    y: event.clientY,
                    projectId: contextNode.dataset.contextProjectId ?? '',
                })
            }
        }
        root.addEventListener('contextmenu', handleContextMenu, true)
        return () => root.removeEventListener('contextmenu', handleContextMenu, true)
    }, [])

    useEffect(() => {
        if (!menu) return
        function handleKeydown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setMenu(null)
        }
        document.addEventListener('keydown', handleKeydown)
        return () => document.removeEventListener('keydown', handleKeydown)
    }, [menu])

    function projectTreeKey(source: 'preload' | 'project', projectId: string): string {
        return `${source}:${projectId}`
    }

    function modTreeKey(projectId: string, modId: string): string {
        return `${projectId}:${modId}`
    }

    function toggleProject(source: 'preload' | 'project', projectId: string): void {
        const key = projectTreeKey(source, projectId)
        setCollapsedProjectKeys(previous => (previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]))
    }

    function toggleMod(projectId: string, modId: string): void {
        const key = modTreeKey(projectId, modId)
        setCollapsedModKeys(previous => (previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]))
    }

    function openCreateMod(projectId: string): void {
        setMenu(null)
        setModName(NEW_MOD_PREFIX)
        setEditing({ projectId, modId: '', mode: 'create' })
        setProjectOpen(true)
    }

    function openRenameMod(projectId: string, modId: string, name: string): void {
        setMenu(null)
        setModName(name)
        setEditing({ projectId, modId, mode: 'rename' })
    }

    function submitEditing(): void {
        const name = modName.trim()
        if (!editing || !name) return
        if (editing.mode === 'create') {
            onCreateMod(editing.projectId, name)
        } else {
            onRenameMod(editing.projectId, editing.modId, name)
        }
        setEditing(null)
        setModName(NEW_MOD_PREFIX)
    }

    function renderNameEditor(placeholder: string) {
        return (
            <div className="mb-1 flex items-center gap-1 px-2 py-1 pl-6">
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
        projectId: string,
        mods: ProjectMod[],
        onSelect: (projectId: string, modId: string, groupKey: ProjectModGroupKey) => void,
        manageable: boolean
    ) {
        return (
            <div className="mt-0.5">
                {mods.length === 0 ? <p className="px-2 py-1.5 pl-10 text-xs text-ink-subtle">{EMPTY_MOD_TEXT}</p> : null}
                {manageable && editing?.mode === 'create' && editing.projectId === projectId
                    ? renderNameEditor(MOD_NAME_PLACEHOLDER)
                    : null}
                {mods.map(mod => {
                    const key = modTreeKey(projectId, mod.id)
                    const collapsed = collapsedModKeys.includes(key)
                    const renaming = manageable && editing?.mode === 'rename' && editing.projectId === projectId && editing.modId === mod.id
                    return (
                        <div key={mod.id} className="mb-1">
                            {renaming ? (
                                renderNameEditor(MOD_NAME_PLACEHOLDER)
                            ) : (
                                <button
                                    type="button"
                                    data-context-kind="mod"
                                    data-context-mod-id={mod.id}
                                    data-context-project-id={projectId}
                                    data-context-source={source}
                                    data-context-mod-name={mod.name}
                                    onClick={() => toggleMod(projectId, mod.id)}
                                    className="flex w-full items-center gap-1.5 rounded-md py-1.5 pl-7 pr-3 text-left text-xs font-medium text-ink-soft hover:bg-raised"
                                >
                                    <Chevron open={!collapsed} />
                                    <span className="truncate">{mod.name}</span>
                                </button>
                            )}
                            {!collapsed ? (
                                <ul>
                                    {mod.groups.length === 0 ? (
                                        <li className="py-1 pl-12 pr-3 text-xs text-ink-subtle">暂无数据</li>
                                    ) : (
                                        mod.groups.map(group => {
                                            const active =
                                                selection?.kind === source &&
                                                selection.projectId === projectId &&
                                                selection.modId === mod.id &&
                                                selection.groupKey === group.key
                                            return (
                                                <li key={group.key}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelect(projectId, mod.id, group.key)}
                                                        className={`w-full rounded-md py-1.5 pl-12 pr-3 text-left text-xs transition-colors ${
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

    function renderProjectTree(
        source: 'preload' | 'project',
        sourceProjects: ProjectData[],
        onSelect: (projectId: string, modId: string, groupKey: ProjectModGroupKey) => void,
        manageable: boolean
    ) {
        if (sourceProjects.length === 0) {
            return (
                <p className="px-2 py-1.5 pl-4 text-xs text-ink-subtle">{source === 'preload' ? EMPTY_PRELOAD_TEXT : EMPTY_PROJECT_TEXT}</p>
            )
        }

        return sourceProjects.map(project => {
            const key = projectTreeKey(source, project.id)
            const collapsed = collapsedProjectKeys.includes(key)
            const activeProject = selection?.projectId === project.id
            return (
                <div
                    key={project.id}
                    className="mb-1"
                    data-context-kind="project"
                    data-context-project-id={project.id}
                    data-context-source={source}
                >
                    <button
                        type="button"
                        aria-expanded={!collapsed}
                        onClick={() => toggleProject(source, project.id)}
                        className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pl-4 pr-3 text-left text-xs font-semibold transition-colors ${
                            activeProject ? 'bg-raised text-ink' : 'text-ink-soft hover:bg-raised'
                        }`}
                    >
                        <Chevron open={!collapsed} />
                        <span className="truncate">{project.name}</span>
                    </button>
                    {!collapsed ? renderModTree(source, project.id, project.mods, onSelect, manageable) : null}
                </div>
            )
        })
    }

    return (
        <aside ref={asideRef} className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-line bg-panel">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <section className="mb-3">
                    <button
                        type="button"
                        onClick={() => setPreloadOpen(value => !value)}
                        className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink-soft hover:bg-raised"
                    >
                        <Chevron open={preloadOpen} />
                        <span className="truncate">{PRELOAD_SECTION_TITLE}</span>
                    </button>
                    {preloadOpen ? (
                        <div className="px-1">{renderProjectTree('preload', preloadProjects, onSelectPreloadGroup, false)}</div>
                    ) : null}
                </section>

                <section>
                    <button
                        type="button"
                        onClick={() => setProjectOpen(value => !value)}
                        className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink-soft hover:bg-raised"
                    >
                        <Chevron open={projectOpen} />
                        <span className="truncate">{PROJECT_SECTION_TITLE}</span>
                    </button>
                    {projectOpen ? <div className="px-1">{renderProjectTree('project', projects, onSelectGroup, true)}</div> : null}
                </section>
            </div>

            {menu
                ? createPortal(
                      <>
                          <div
                              className="fixed inset-0 z-[99]"
                              onMouseDown={() => setMenu(null)}
                              onContextMenu={event => {
                                  event.preventDefault()
                                  setMenu(null)
                              }}
                          />
                          <div
                              role="menu"
                              style={{ left: menu.x, top: menu.y }}
                              className="fixed z-[100] min-w-32 overflow-hidden rounded-md border border-line-strong bg-raised py-1 shadow-xl"
                          >
                              {menu.kind === 'project' ? (
                                  <>
                                      {menu.source === 'project' ? (
                                          <>
                                              <button
                                                  type="button"
                                                  role="menuitem"
                                                  onClick={() => {
                                                      setMenu(null)
                                                      onSaveProject(menu.projectId)
                                                  }}
                                                  className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                                              >
                                                  {SAVE_PROJECT_TEXT}
                                              </button>
                                              <button
                                                  type="button"
                                                  role="menuitem"
                                                  onClick={() => openCreateMod(menu.projectId)}
                                                  className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                                              >
                                                  {CREATE_MOD_TEXT}
                                              </button>
                                          </>
                                      ) : null}
                                      <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                              setMenu(null)
                                              if (menu.source === 'preload') {
                                                  onClosePreloadProject(menu.projectId)
                                              } else {
                                                  onCloseProject(menu.projectId)
                                              }
                                          }}
                                          className="flex w-full items-center px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                                      >
                                          {CLOSE_PROJECT_TEXT}
                                      </button>
                                  </>
                              ) : (
                                  <>
                                      {menu.source === 'project' ? (
                                          <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => openRenameMod(menu.projectId, menu.modId, menu.modName)}
                                              className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-hover"
                                          >
                                              {RENAME_MOD_TEXT}
                                          </button>
                                      ) : null}
                                      <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                              setMenu(null)
                                              if (menu.source === 'preload') {
                                                  onDeletePreloadMod(menu.projectId, menu.modId)
                                              } else {
                                                  onDeleteMod(menu.projectId, menu.modId)
                                              }
                                          }}
                                          className="flex w-full items-center px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                                      >
                                          {DELETE_MOD_TEXT}
                                      </button>
                                  </>
                              )}
                          </div>
                      </>,
                      document.body
                  )
                : null}
        </aside>
    )
}
