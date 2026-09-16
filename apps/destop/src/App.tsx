import {
    type JsonDataset,
    type JsonRecord,
    type JsonValue,
    PreloadSourceMode,
    type ProjectData,
    type ProjectMod,
    type ProjectModGroupKey,
    type ProjectSeidData,
    type SeidDataKey,
} from '@baize-next/types'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'

import { DataTable } from './components/DataTable'
import { JsonEditor } from './components/JsonEditor'
import { LeftPanel } from './components/LeftPanel'
import { StartupLoading } from './components/StartupLoading'
import { Tip, type TipTone } from './components/Tip'
import { TitleBar } from './components/TitleBar'
import { appendErrorLog, resetErrorLog } from './errorLog'
import { DEFAULT_META_PRELOAD_PATH, getSavedPreloadSettings, PRELOAD_MODE_OPTIONS } from './preload'
import { subscribeTheme } from './theme'
import {
    collectGroupRecords,
    createDatasetId,
    parseMetaEntriesFromEntries,
    parseModPreloadFromEntries,
    parseModPreloadJsonEntry,
    parseProjectFromEntries,
    PROJECT_GROUP_DEFS,
    type ProjectFileEntry,
    serializeProjectFiles,
} from './utils/json'
import type { SeidDrawerRecords } from './utils/seid'

const PRELOAD_FAILED_LABEL = '\u9884\u52a0\u8f7d\u5931\u8d25'
const SAVED_TEXT = '\u5df2\u4fdd\u5b58'
const SAVE_FAILED_TEXT = '\u4fdd\u5b58\u5931\u8d25'
/** 当前表格与编辑器展示的数据来源。 */
export type SelectionSource =
    | { kind: 'preload'; modId: string; groupKey: ProjectModGroupKey }
    | { kind: 'project'; modId: string; groupKey: ProjectModGroupKey }
    | null

function mergeProjectData(base: ProjectData | null, next: ProjectData): ProjectData {
    if (!base) return next
    return { ...base, mods: [...base.mods, ...next.mods] }
}

function updateModSeidData(
    mod: ProjectMod,
    dataKey: SeidDataKey,
    seidId: string,
    targetKey: string,
    value: Record<string, JsonValue> | null
): ProjectMod {
    const seidData: ProjectSeidData = { ...(mod.seidData ?? {}) }
    const files = { ...(seidData[dataKey] ?? {}) }
    const records = { ...(files[seidId] ?? {}) }
    if (value === null) {
        delete records[targetKey]
    } else {
        records[targetKey] = value
    }
    files[seidId] = records
    seidData[dataKey] = files
    return { ...mod, seidData }
}

function updateProjectSeidData(
    project: ProjectData | null,
    modId: string,
    dataKey: SeidDataKey,
    seidId: string,
    targetKey: string,
    value: Record<string, JsonValue> | null
): ProjectData | null {
    if (!project) return project
    return {
        ...project,
        mods: project.mods.map(mod => (mod.id === modId ? updateModSeidData(mod, dataKey, seidId, targetKey, value) : mod)),
    }
}

function createEmptyMod(name: string): ProjectMod {
    return {
        id: createDatasetId(name),
        name,
        groups: PROJECT_GROUP_DEFS.map(def => ({ key: def.key, label: def.label, records: [] })),
    }
}

export default function App() {
    const [preloadProject, setPreloadProject] = useState<ProjectData | null>(null)
    const [metaDatasets, setMetaDatasets] = useState<JsonDataset[]>([])
    const [project, setProject] = useState<ProjectData | null>(null)
    const [selection, setSelection] = useState<SelectionSource>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)
    const [bootPhase, setBootPhase] = useState<'loading' | 'ready' | 'error'>('loading')
    const [bootError, setBootError] = useState<string>('')
    const [bootPath, setBootPath] = useState<string>(DEFAULT_META_PRELOAD_PATH)
    const [bootMode, setBootMode] = useState<PreloadSourceMode>(PreloadSourceMode.Directory)
    const [reloadToken, setReloadToken] = useState(0)
    const [projectRootPath, setProjectRootPath] = useState<string | null>(null)
    /** 各 mod 的来源根目录，用于解析 Assets 下的图标等资源。 */
    const [modRootPaths, setModRootPaths] = useState<Record<string, string>>({})
    const [dirty, setDirty] = useState(false)
    const [tip, setTip] = useState<{ message: string; tone: TipTone } | null>(null)

    const selectedMod =
        selection?.kind === 'preload'
            ? (preloadProject?.mods.find(mod => mod.id === selection.modId) ?? null)
            : selection?.kind === 'project'
              ? (project?.mods.find(mod => mod.id === selection.modId) ?? null)
              : null
    const selectedGroup =
        selectedMod?.groups.find(
            group => group.key === (selection?.kind === 'preload' || selection?.kind === 'project' ? selection.groupKey : null)
        ) ?? null

    const records: JsonRecord[] = selectedGroup?.records ?? []
    const groupKey: ProjectModGroupKey | null = selection?.kind === 'preload' || selection?.kind === 'project' ? selection.groupKey : null
    const selectedRecord = records.find(record => record.key === selectedRecordKey) ?? null
    const affixRecords = [...collectGroupRecords(preloadProject, 'tuJianChunWenBen'), ...collectGroupRecords(project, 'tuJianChunWenBen')]
    const seidDrawerRecords: SeidDrawerRecords = {
        buff: [...collectGroupRecords(preloadProject, 'buff'), ...collectGroupRecords(project, 'buff')],
        skill: [...collectGroupRecords(preloadProject, 'shenTong'), ...collectGroupRecords(project, 'shenTong')],
        staticSkill: [...collectGroupRecords(preloadProject, 'skill'), ...collectGroupRecords(project, 'skill')],
        item: [...collectGroupRecords(preloadProject, 'item'), ...collectGroupRecords(project, 'item')],
    }
    /** 当前选中 mod 的名称与根目录，用于定位 mod 内的资源文件。 */
    const currentRootPath = selection?.kind === 'project' ? projectRootPath : selectedMod ? (modRootPaths[selectedMod.id] ?? null) : null
    const readAsset = useCallback(
        async (relativePath: string): Promise<string | null> => {
            if (!currentRootPath) return null
            try {
                return await invoke<string>('read_mod_asset', { rootPath: currentRootPath, relativePath })
            } catch {
                return null
            }
        },
        [currentRootPath]
    )

    function recordError(source: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error)
        setBootError(message)
        void appendErrorLog(source, error)
    }

    useEffect(() => {
        return subscribeTheme(() => undefined)
    }, [])

    useEffect(() => {
        const handleWindowError = (event: ErrorEvent): void => {
            void appendErrorLog('window', event.error ?? event.message)
        }
        const handleRejection = (event: PromiseRejectionEvent): void => {
            void appendErrorLog('unhandledrejection', event.reason)
        }
        window.addEventListener('error', handleWindowError)
        window.addEventListener('unhandledrejection', handleRejection)
        return () => {
            window.removeEventListener('error', handleWindowError)
            window.removeEventListener('unhandledrejection', handleRejection)
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function runBootPreload(): Promise<void> {
            await resetErrorLog()
            const preload = getSavedPreloadSettings()
            const firstPreload = preload.mods[0] ?? preload.meta[0]
            if (firstPreload) {
                setBootPath(firstPreload.path)
                setBootMode(firstPreload.mode)
            }
            setBootPhase('loading')
            setBootError('')
            setSelection(null)
            setSelectedRecordKey(null)

            setPreloadProject(null)
            setMetaDatasets([])
            setProject(null)
            setProjectRootPath(null)
            setDirty(false)

            const loadedMeta: JsonDataset[] = []
            for (const entry of preload.meta) {
                try {
                    const files =
                        entry.mode === PreloadSourceMode.Json
                            ? [await invoke<ProjectFileEntry>('read_json_file', { path: entry.path })]
                            : await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: entry.path })
                    loadedMeta.push(...parseMetaEntriesFromEntries(files))
                } catch (error) {
                    recordError(`meta-preload ${entry.path}`, error)
                }
            }

            let mergedProject: ProjectData | null = null
            const preloadRootPaths: Record<string, string> = {}
            for (const entry of preload.mods) {
                try {
                    const loaded =
                        entry.mode === PreloadSourceMode.Json
                            ? parseModPreloadJsonEntry(await invoke<ProjectFileEntry>('read_json_file', { path: entry.path }))
                            : await parseModPreloadFromEntries(
                                  entry.path,
                                  await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: entry.path })
                              )
                    for (const mod of loaded.mods) {
                        preloadRootPaths[mod.id] = entry.path
                    }
                    mergedProject = mergeProjectData(mergedProject, loaded)
                } catch (error) {
                    recordError(`mod-preload ${entry.path}`, error)
                }
            }

            if (cancelled) return
            setMetaDatasets(loadedMeta)
            setModRootPaths(preloadRootPaths)
            setPreloadProject(mergedProject)
            const firstMod = mergedProject?.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelection(firstMod && firstGroup ? { kind: 'preload', modId: firstMod.id, groupKey: firstGroup.key } : null)
            setSelectedRecordKey(firstGroup?.records[0]?.key ?? null)
            setBootPhase('ready')
        }

        void runBootPreload()
        return () => {
            cancelled = true
        }
    }, [reloadToken])

    async function handleOpenProject(): Promise<void> {
        try {
            const selected = await open({
                directory: true,
                recursive: true,
                multiple: false,
                title: '\u9009\u62e9\u9879\u76ee\u76ee\u5f55',
            })
            if (typeof selected !== 'string' || !selected) return
            const entries = await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: selected })
            const parsedProject = await parseProjectFromEntries(selected, entries)
            setProject(parsedProject)
            setProjectRootPath(selected)
            setModRootPaths(Object.fromEntries(parsedProject.mods.map(mod => [mod.id, selected])))
            setDirty(false)
            const firstMod = parsedProject.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelection(firstMod && firstGroup ? { kind: 'project', modId: firstMod.id, groupKey: firstGroup.key } : null)
            setSelectedRecordKey(firstGroup?.records[0]?.key ?? null)
        } catch (error) {
            recordError('open-project', error)
        }
    }

    function handleSelectGroup(kind: 'preload' | 'project', modId: string, groupKey: ProjectModGroupKey): void {
        const mod = (kind === 'preload' ? preloadProject : project)?.mods.find(item => item.id === modId)
        const group = mod?.groups.find(item => item.key === groupKey)
        setSelection({ kind, modId, groupKey })
        setSelectedRecordKey(group?.records[0]?.key ?? null)
    }

    function handleCreateMod(name: string): void {
        const modName = name.trim()
        if (!modName) return
        setDirty(true)
        setProject(prev => {
            const base = prev ?? { id: createDatasetId('project'), name: '未命名项目', mods: [] }
            return { ...base, mods: [...base.mods, createEmptyMod(modName)] }
        })
    }

    function handleRenameMod(modId: string, name: string): void {
        const modName = name.trim()
        if (!modName) return
        setDirty(true)
        setProject(prev => (prev ? { ...prev, mods: prev.mods.map(mod => (mod.id === modId ? { ...mod, name: modName } : mod)) } : prev))
    }

    function handleDeleteMod(modId: string): void {
        const remaining = project?.mods.filter(mod => mod.id !== modId) ?? []
        setDirty(true)
        setProject(prev => (prev ? { ...prev, mods: prev.mods.filter(mod => mod.id !== modId) } : prev))
        if (selection?.kind === 'project' && selection.modId === modId) {
            const nextMod = remaining[0] ?? null
            const nextGroup = nextMod?.groups[0] ?? null
            setSelection(nextMod && nextGroup ? { kind: 'project', modId: nextMod.id, groupKey: nextGroup.key } : null)
            setSelectedRecordKey(nextGroup?.records[0]?.key ?? null)
        }
    }

    function handleUpdateRecord(recordKey: string, field: string, value: JsonValue): void {
        if (selection?.kind === 'preload') {
            const { modId, groupKey } = selection
            setPreloadProject(prev =>
                prev
                    ? {
                          ...prev,
                          mods: prev.mods.map(mod =>
                              mod.id === modId
                                  ? {
                                        ...mod,
                                        groups: mod.groups.map(group =>
                                            group.key === groupKey
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
            return
        }
        if (selection?.kind !== 'project') return
        const { modId, groupKey } = selection
        setDirty(true)
        setProject(prev =>
            prev
                ? {
                      ...prev,
                      mods: prev.mods.map(mod =>
                          mod.id === modId
                              ? {
                                    ...mod,
                                    groups: mod.groups.map(group =>
                                        group.key === groupKey
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

    function handleUpdateSeidData(dataKey: SeidDataKey, seidId: string, targetKey: string, value: Record<string, JsonValue> | null): void {
        if (selection?.kind === 'preload') {
            setPreloadProject(prev => updateProjectSeidData(prev, selection.modId, dataKey, seidId, targetKey, value))
            return
        }
        if (selection?.kind !== 'project') return
        setDirty(true)
        setProject(prev => updateProjectSeidData(prev, selection.modId, dataKey, seidId, targetKey, value))
    }

    async function handleSaveProject(): Promise<void> {
        if (!project || !projectRootPath) return
        try {
            const writes = serializeProjectFiles(project)
            if (writes.length === 0) {
                recordError('save-project', new Error('没有可保存的项目数据'))
                return
            }
            for (const write of writes) {
                await invoke('write_project_file', {
                    rootPath: projectRootPath,
                    relativePath: write.relativePath,
                    content: write.content,
                })
            }
            setDirty(false)
            setTip({ message: `${SAVED_TEXT}（${writes.length} 个文件）`, tone: 'success' })
        } catch (error) {
            recordError('save-project', error)
            setTip({ message: SAVE_FAILED_TEXT, tone: 'error' })
        }
    }

    async function handleOpenSettings(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel('settings')
            if (existing) return
            new WebviewWindow('settings', {
                url: 'index.html?window=settings',
                title: '\u8bbe\u7f6e',
                width: 560,
                height: 520,
                minWidth: 420,
                minHeight: 320,
                center: true,
                decorations: false,
            })
        } catch {
            // Non-Tauri preview ignores the new window.
        }
    }

    async function handleOpenErrorLog(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel('error-log')
            if (existing) return
            new WebviewWindow('error-log', {
                url: 'index.html?window=error-log',
                title: '\u9519\u8bef\u65e5\u5fd7',
                width: 560,
                height: 460,
                minWidth: 420,
                minHeight: 320,
                center: true,
                decorations: false,
            })
        } catch {
            // Non-Tauri preview ignores the new window.
        }
    }

    if (bootPhase === 'loading' || bootPhase === 'error') {
        return (
            <StartupLoading
                status={bootPhase}
                path={bootPath}
                modeLabel={PRELOAD_MODE_OPTIONS.find(option => option.value === bootMode)?.label ?? ''}
                message={bootError}
                onRetry={() => setReloadToken(token => token + 1)}
                onContinue={bootPhase === 'error' ? () => setBootPhase('ready') : undefined}
                onOpenSettings={() => void handleOpenSettings()}
            />
        )
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink" onContextMenu={event => event.preventDefault()}>
            <TitleBar
                canSaveProject={project !== null && projectRootPath !== null}
                projectDirty={dirty}
                onOpenProject={() => void handleOpenProject()}
                onSaveProject={() => void handleSaveProject()}
                onOpenSettings={() => void handleOpenSettings()}
                onOpenErrorLog={() => void handleOpenErrorLog()}
            />
            <main className="flex min-h-0 flex-1">
                <LeftPanel
                    preloadProject={preloadProject}
                    project={project}
                    selection={selection}
                    onCreateMod={handleCreateMod}
                    onDeleteMod={handleDeleteMod}
                    onRenameMod={handleRenameMod}
                    onSelectPreloadGroup={(modId, groupKey) => handleSelectGroup('preload', modId, groupKey)}
                    onSelectGroup={(modId, groupKey) => handleSelectGroup('project', modId, groupKey)}
                />
                <DataTable
                    groupKey={groupKey}
                    records={records}
                    selectedKey={selectedRecordKey}
                    onSelect={setSelectedRecordKey}
                    metaDatasets={metaDatasets}
                    modDirectory={selectedMod ? (selectedMod.directory ?? selectedMod.name) : null}
                    readAsset={readAsset}
                />
                <JsonEditor
                    groupKey={groupKey}
                    record={selectedRecord}
                    metaDatasets={metaDatasets}
                    affixRecords={affixRecords}
                    modDirectory={selectedMod ? (selectedMod.directory ?? selectedMod.name) : null}
                    readAsset={readAsset}
                    seidData={selectedMod?.seidData ?? {}}
                    seidRecords={seidDrawerRecords}
                    onUpdate={handleUpdateRecord}
                    onUpdateSeidData={handleUpdateSeidData}
                />
            </main>
            {bootError ? (
                <div className="flex shrink-0 items-center gap-2 border-t border-danger/30 bg-danger/10 px-3 py-1 text-xs text-danger">
                    <span>
                        {PRELOAD_FAILED_LABEL}: {bootError}
                    </span>
                </div>
            ) : null}
            <Tip open={tip !== null} message={tip?.message ?? ''} tone={tip?.tone} onHide={() => setTip(null)} />
        </div>
    )
}
