import { type JsonValue, PreloadSourceMode, type ProjectData, type ProjectModGroupKey } from '@baize-next/types'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'

import { DataTable } from './components/DataTable'
import { JsonEditor } from './components/JsonEditor'
import { LeftPanel } from './components/LeftPanel'
import { StartupLoading } from './components/StartupLoading'
import { TitleBar } from './components/TitleBar'
import { appendErrorLog, resetErrorLog } from './errorLog'
import { DEFAULT_PRELOAD_PATH, getSavedPreloadSettings, PRELOAD_MODE_OPTIONS } from './preload'
import { subscribeTheme } from './theme'
import { parsePreloadJsonEntry, parsePreloadProjectFromEntries, parseProjectFromEntries, type ProjectFileEntry } from './utils/json'

const PRELOAD_FAILED_LABEL = '\u9884\u52a0\u8f7d\u5931\u8d25'

function mergeProjectData(base: ProjectData | null, next: ProjectData): ProjectData {
    if (!base) return next
    return { ...base, mods: [...base.mods, ...next.mods] }
}

export default function App() {
    const [project, setProject] = useState<ProjectData | null>(null)
    const [selectedModId, setSelectedModId] = useState<string | null>(null)
    const [selectedGroupKey, setSelectedGroupKey] = useState<ProjectModGroupKey | null>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)
    const [bootPhase, setBootPhase] = useState<'loading' | 'ready' | 'error'>('loading')
    const [bootError, setBootError] = useState<string>('')
    const [bootPath, setBootPath] = useState<string>(DEFAULT_PRELOAD_PATH)
    const [bootMode, setBootMode] = useState<PreloadSourceMode>(PreloadSourceMode.Directory)
    const [reloadToken, setReloadToken] = useState(0)

    const selectedMod = project?.mods.find(mod => mod.id === selectedModId) ?? null
    const selectedGroup = selectedMod?.groups.find(group => group.key === selectedGroupKey) ?? null
    const selectedRecord = selectedGroup?.records.find(record => record.key === selectedRecordKey) ?? null

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
            const firstEntry = preload.entries[0]
            if (firstEntry) {
                setBootPath(firstEntry.path)
                setBootMode(firstEntry.mode)
            }
            setBootPhase('loading')
            setBootError('')
            let mergedProject: ProjectData | null = null
            for (const entry of preload.entries) {
                try {
                    let loaded: ProjectData
                    if (entry.mode === PreloadSourceMode.Json) {
                        const fileEntry = await invoke<ProjectFileEntry>('read_json_file', { path: entry.path })
                        loaded = parsePreloadJsonEntry(fileEntry)
                    } else {
                        const entries = await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: entry.path })
                        loaded = await parsePreloadProjectFromEntries(entry.path, entries)
                    }
                    mergedProject = mergeProjectData(mergedProject, loaded)
                } catch (error) {
                    recordError(`meta-preload ${entry.path}`, error)
                }
            }
            if (cancelled) return
            setProject(mergedProject)
            const firstMod = mergedProject?.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelectedModId(firstMod?.id ?? null)
            setSelectedGroupKey(firstGroup?.key ?? null)
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
            const firstMod = parsedProject.mods[0] ?? null
            const firstGroup = firstMod?.groups[0] ?? null
            setSelectedModId(firstMod?.id ?? null)
            setSelectedGroupKey(firstGroup?.key ?? null)
            setSelectedRecordKey(firstGroup?.records[0]?.key ?? null)
        } catch (error) {
            recordError('open-project', error)
        }
    }

    function handleSelectGroup(modId: string, groupKey: ProjectModGroupKey): void {
        const mod = project?.mods.find(item => item.id === modId)
        const group = mod?.groups.find(item => item.key === groupKey)
        setSelectedModId(modId)
        setSelectedGroupKey(groupKey)
        setSelectedRecordKey(group?.records[0]?.key ?? null)
    }

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

    async function handleOpenSettings(): Promise<void> {
        try {
            const existing = await WebviewWindow.getByLabel('settings')
            if (existing) return
            new WebviewWindow('settings', {
                url: 'index.html?window=settings',
                title: '\u8bbe\u7f6e',
                width: 560,
                height: 420,
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
                onOpenProject={() => void handleOpenProject()}
                onOpenSettings={() => void handleOpenSettings()}
                onOpenErrorLog={() => void handleOpenErrorLog()}
            />
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
            {bootError ? (
                <div className="flex shrink-0 items-center gap-2 border-t border-danger/30 bg-danger/10 px-3 py-1 text-xs text-danger">
                    <span>
                        {PRELOAD_FAILED_LABEL}: {bootError}
                    </span>
                </div>
            ) : null}
        </div>
    )
}
