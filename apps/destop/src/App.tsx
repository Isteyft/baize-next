import { validateConsultBookGeneration } from '@baize-next/core'
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
import { getCurrentWindow, LogicalSize, type Window } from '@tauri-apps/api/window'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ChatPanel } from './components/ChatPanel'
import { DataTable } from './components/DataTable'
import { ErrorDetailModal } from './components/ErrorDetailModal'
import { JsonEditor } from './components/JsonEditor'
import { LeftPanel } from './components/LeftPanel'
import { Resizer } from './components/Resizer'
import { StartupLoading } from './components/StartupLoading'
import { Tip, type TipTone } from './components/Tip'
import { TitleBar } from './components/TitleBar'
import { appendErrorLog, resetErrorLog } from './errorLog'
import { DEFAULT_META_PRELOAD_PATH, getSavedPreloadSettings, PRELOAD_MODE_OPTIONS } from './preload'
import { subscribeTheme } from './theme'
import type { BatchIdChange } from './utils/batchId'
import { withDefaultRecordData } from './utils/defaultRecordTemplates'
import {
    createDatasetId,
    mergeMetaDatasets,
    parseMetaEntriesFromEntries,
    parseModPreloadFromEntries,
    parseModPreloadJsonEntry,
    parseProjectFromEntries,
    PROJECT_GROUP_DEFS,
    type ProjectFileEntry,
    resolveProjectRecordRelativePath,
    serializeProjectFiles,
} from './utils/json'
import {
    collectGroupRecordsFromProjects,
    getFirstProjectSelection,
    insertRecordSorted,
    removeProjectModRoots,
    type SelectionSource,
} from './utils/projectSession'
import type { SeidDrawerRecords } from './utils/seid'
import { appendSkillBookToMod, isSkillBookSourceGroup } from './utils/skillBook'

const LOAD_FAILED_HINT = '\u9879\u76ee\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6'
const SAVED_TEXT = '\u5df2\u4fdd\u5b58'
const SAVE_FAILED_TEXT = '\u4fdd\u5b58\u5931\u8d25'

/** 聊天侧边栏展开时窗口增加的宽度（逻辑像素）。 */
const CHAT_PANEL_WIDTH = 360
/** 关闭聊天侧边栏时窗口允许的最小宽度，避免缩得过窄。 */
const CHAT_MIN_RESTORE_WIDTH = 900

interface ConsultBookConfirmState {
    recordKey: string
    sourceId: number
    targetId: number
    sourceName: string
    record: JsonRecord
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

function updateProjectGroupRecords(
    project: ProjectData | null,
    modId: string,
    groupKey: ProjectModGroupKey,
    updateRecords: (records: JsonRecord[]) => JsonRecord[]
): ProjectData | null {
    if (!project) return project
    return {
        ...project,
        mods: project.mods.map(mod =>
            mod.id === modId
                ? {
                      ...mod,
                      groups: mod.groups.map(group =>
                          group.key === groupKey ? { ...group, records: updateRecords(group.records) } : group
                      ),
                  }
                : mod
        ),
    }
}

export default function App() {
    const [preloadProjects, setPreloadProjects] = useState<ProjectData[]>([])
    const [activePreloadProjectId, setActivePreloadProjectId] = useState<string | null>(null)
    const [metaDatasets, setMetaDatasets] = useState<JsonDataset[]>([])
    const [projects, setProjects] = useState<ProjectData[]>([])
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
    const [selection, setSelection] = useState<SelectionSource>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)
    const [selectedRecordKeys, setSelectedRecordKeys] = useState<string[]>([])
    const [bootPhase, setBootPhase] = useState<'loading' | 'ready' | 'error'>('loading')
    const [bootError, setBootError] = useState<string>('')
    const [errorModalOpen, setErrorModalOpen] = useState(false)
    const [bootPath, setBootPath] = useState<string>(DEFAULT_META_PRELOAD_PATH)
    const [bootMode, setBootMode] = useState<PreloadSourceMode>(PreloadSourceMode.Directory)
    const [reloadToken, setReloadToken] = useState(0)
    const [projectRootPaths, setProjectRootPaths] = useState<Record<string, string>>({})
    const [pendingDeletedFilesByProject, setPendingDeletedFilesByProject] = useState<Record<string, string[]>>({})
    /** 各 mod 的来源根目录，用于解析 Assets 下的图标等资源。 */
    const [modRootPaths, setModRootPaths] = useState<Record<string, string>>({})
    const [dirtyProjectIds, setDirtyProjectIds] = useState<string[]>([])
    const [tip, setTip] = useState<{ message: string; tone: TipTone } | null>(null)
    const [consultBookConfirm, setConsultBookConfirm] = useState<ConsultBookConfirmState | null>(null)
    const [consultBookWarning, setConsultBookWarning] = useState<string | null>(null)
    const [chatOpen, setChatOpen] = useState(false)
    const chatPrevWidthRef = useRef<number | null>(null)
    const chatPanelWidthRef = useRef(CHAT_PANEL_WIDTH)
    const [leftPanelWidth, setLeftPanelWidth] = useState(288)
    const [jsonEditorWidth, setJsonEditorWidth] = useState(384)
    const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_WIDTH)

    function handleChatPanelWidth(next: number): void {
        setChatPanelWidth(next)
        chatPanelWidthRef.current = next
    }

    const preloadProject = preloadProjects.find(project => project.id === activePreloadProjectId) ?? preloadProjects[0] ?? null
    const project = projects.find(item => item.id === activeProjectId) ?? projects[0] ?? null
    const selectedProject =
        selection?.kind === 'preload'
            ? (preloadProjects.find(item => item.id === selection.projectId) ?? null)
            : selection?.kind === 'project'
              ? (projects.find(item => item.id === selection.projectId) ?? null)
              : null
    const selectedMod = selectedProject?.mods.find(mod => mod.id === selection?.modId) ?? null
    const selectedGroup = selectedMod?.groups.find(group => group.key === selection?.groupKey) ?? null

    const records: JsonRecord[] = selectedGroup?.records ?? []
    const groupKey: ProjectModGroupKey | null = selection?.groupKey ?? null
    const selectedRecord = records.find(record => record.key === selectedRecordKey) ?? null
    const referenceProjects = [...preloadProjects, ...(project ? [project] : [])]
    const affixRecords = collectGroupRecordsFromProjects(referenceProjects, 'tuJianChunWenBen')
    const shenTongRecords = collectGroupRecordsFromProjects(referenceProjects, 'shenTong')
    const skillRecords = collectGroupRecordsFromProjects(referenceProjects, 'skill')
    const wuDaoTypeRecords = collectGroupRecordsFromProjects(referenceProjects, 'wuDaoAllType')
    const wuDaoRecords = collectGroupRecordsFromProjects(referenceProjects, 'wuDao')
    const seidDrawerRecords: SeidDrawerRecords = {
        buff: collectGroupRecordsFromProjects(referenceProjects, 'buff'),
        skill: collectGroupRecordsFromProjects(referenceProjects, 'shenTong'),
        staticSkill: collectGroupRecordsFromProjects(referenceProjects, 'skill'),
        item: collectGroupRecordsFromProjects(referenceProjects, 'item'),
    }
    /** 当前选中 mod 的名称与根目录，用于定位 mod 内的资源文件。 */
    const currentRootPath =
        selection?.kind === 'project'
            ? (projectRootPaths[selection.projectId] ?? null)
            : selectedMod
              ? (modRootPaths[selectedMod.id] ?? null)
              : null
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
        setErrorModalOpen(true)
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
            setErrorModalOpen(false)
            setSelection(null)
            setSelectedRecordKey(null)
            setSelectedRecordKeys([])

            setPreloadProjects([])
            setActivePreloadProjectId(null)
            setMetaDatasets([])
            setProjects([])
            setActiveProjectId(null)
            setProjectRootPaths({})
            setPendingDeletedFilesByProject({})
            setModRootPaths({})
            setDirtyProjectIds([])

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

            const loadedProjects: ProjectData[] = []
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
                    loadedProjects.push(loaded)
                } catch (error) {
                    recordError(`mod-preload ${entry.path}`, error)
                }
            }

            if (cancelled) return
            const firstProject = loadedProjects[0] ?? null
            const firstSelection = getFirstProjectSelection('preload', firstProject)
            const firstGroup = firstSelection
                ? (firstProject?.mods
                      .find(mod => mod.id === firstSelection.modId)
                      ?.groups.find(group => group.key === firstSelection.groupKey) ?? null)
                : null
            setMetaDatasets(mergeMetaDatasets(loadedMeta))
            setModRootPaths(preloadRootPaths)
            setPreloadProjects(loadedProjects)
            setActivePreloadProjectId(firstProject?.id ?? null)
            setSelection(firstSelection)
            const firstRecordKey = firstGroup?.records[0]?.key ?? null
            setSelectedRecordKey(firstRecordKey)
            setSelectedRecordKeys(firstRecordKey ? [firstRecordKey] : [])
            setBootPhase('ready')
        }

        void runBootPreload()
        return () => {
            cancelled = true
        }
    }, [reloadToken])

    function markProjectDirty(projectId: string): void {
        setDirtyProjectIds(previous => (previous.includes(projectId) ? previous : [...previous, projectId]))
    }

    function setRecordSelection(records: JsonRecord[]): void {
        const firstRecordKey = records[0]?.key ?? null
        setSelectedRecordKey(firstRecordKey)
        setSelectedRecordKeys(firstRecordKey ? [firstRecordKey] : [])
    }

    function applyProjectSelection(kind: 'preload' | 'project', target: ProjectData | null): void {
        const nextSelection = getFirstProjectSelection(kind, target)
        setSelection(nextSelection)
        if (!nextSelection) {
            setRecordSelection([])
            return
        }
        const group =
            target?.mods.find(mod => mod.id === nextSelection.modId)?.groups.find(group => group.key === nextSelection.groupKey) ?? null
        setRecordSelection(group?.records ?? [])
    }

    async function handleOpenProject(): Promise<void> {
        try {
            const selected = await open({
                directory: true,
                recursive: true,
                multiple: true,
                title: '选择项目目录',
            })
            const selectedPaths = typeof selected === 'string' ? [selected] : Array.isArray(selected) ? selected : []
            if (selectedPaths.length === 0) return

            const nextProjects: ProjectData[] = []
            const nextProjectRoots: Record<string, string> = {}
            const nextModRoots: Record<string, string> = {}
            let nextActiveProject: ProjectData | null = null

            for (const selectedPath of selectedPaths) {
                const existingProject = projects.find(item => projectRootPaths[item.id] === selectedPath) ?? null
                if (existingProject) {
                    nextActiveProject = existingProject
                    continue
                }

                try {
                    const entries = await invoke<ProjectFileEntry[]>('read_project_files', { rootPath: selectedPath })
                    const parsedProject = await parseProjectFromEntries(selectedPath, entries)
                    nextProjects.push(parsedProject)
                    nextProjectRoots[parsedProject.id] = selectedPath
                    for (const mod of parsedProject.mods) {
                        nextModRoots[mod.id] = selectedPath
                    }
                    nextActiveProject = parsedProject
                } catch (error) {
                    recordError(`open-project ${selectedPath}`, error)
                }
            }

            if (nextProjects.length > 0) {
                setProjects(previous => [...previous, ...nextProjects])
                setProjectRootPaths(previous => ({ ...previous, ...nextProjectRoots }))
                setModRootPaths(previous => ({ ...previous, ...nextModRoots }))
            }

            if (nextActiveProject) {
                setActiveProjectId(nextActiveProject.id)
                applyProjectSelection('project', nextActiveProject)
            }
        } catch (error) {
            recordError('open-project', error)
        }
    }

    function handleSelectGroup(kind: 'preload' | 'project', projectId: string, modId: string, groupKey: ProjectModGroupKey): void {
        const targetProject = (kind === 'preload' ? preloadProjects : projects).find(item => item.id === projectId) ?? null
        const group = targetProject?.mods.find(mod => mod.id === modId)?.groups.find(item => item.key === groupKey) ?? null
        if (!group) return
        if (kind === 'preload') {
            setActivePreloadProjectId(projectId)
        } else {
            setActiveProjectId(projectId)
        }
        setSelection({ kind, projectId, modId, groupKey })
        setRecordSelection(group.records)
    }

    function handleCreateMod(projectId: string, name: string): void {
        const modName = name.trim()
        if (!modName) return
        const target = projects.find(item => item.id === projectId)
        if (!target) return

        const newMod = createEmptyMod(modName)
        markProjectDirty(projectId)
        setProjects(previous => previous.map(item => (item.id === projectId ? { ...item, mods: [...item.mods, newMod] } : item)))
        setActiveProjectId(projectId)
        const firstGroup = newMod.groups[0] ?? null
        if (firstGroup) {
            setSelection({ kind: 'project', projectId, modId: newMod.id, groupKey: firstGroup.key })
            setRecordSelection(firstGroup.records)
        } else {
            setSelection(null)
            setRecordSelection([])
        }
    }

    function handleRenameMod(projectId: string, modId: string, name: string): void {
        const modName = name.trim()
        if (!modName) return
        markProjectDirty(projectId)
        setProjects(previous =>
            previous.map(project =>
                project.id === projectId
                    ? { ...project, mods: project.mods.map(mod => (mod.id === modId ? { ...mod, name: modName } : mod)) }
                    : project
            )
        )
    }

    function handleClosePreloadProject(projectId: string): void {
        const closingProject = preloadProjects.find(item => item.id === projectId) ?? null
        if (!closingProject) return
        const remainingProjects = preloadProjects.filter(item => item.id !== projectId)
        const closingActiveProject = activePreloadProjectId === projectId || preloadProject?.id === projectId
        const nextActiveProject = closingActiveProject ? (remainingProjects[0] ?? null) : preloadProject

        setPreloadProjects(remainingProjects)
        setActivePreloadProjectId(nextActiveProject?.id ?? null)
        setModRootPaths(previous => removeProjectModRoots(previous, closingProject))

        if (selection?.kind === 'preload' && selection.projectId === projectId) {
            applyProjectSelection('preload', nextActiveProject)
        }
    }

    function handleDeletePreloadMod(projectId: string, modId: string): void {
        const target = preloadProjects.find(item => item.id === projectId)
        if (!target) return
        const remainingMods = target.mods.filter(mod => mod.id !== modId)
        const deletedMod = target.mods.find(mod => mod.id === modId) ?? null
        setPreloadProjects(previous => previous.map(project => (project.id === projectId ? { ...project, mods: remainingMods } : project)))
        if (deletedMod) {
            setModRootPaths(previous => removeProjectModRoots(previous, { ...target, mods: [deletedMod] }))
        }
        if (selection?.kind === 'preload' && selection.projectId === projectId && selection.modId === modId) {
            const nextSelection = getFirstProjectSelection('preload', { ...target, mods: remainingMods })
            setSelection(nextSelection)
            const nextGroup = nextSelection
                ? (remainingMods.find(mod => mod.id === nextSelection.modId)?.groups.find(group => group.key === nextSelection.groupKey) ??
                  null)
                : null
            setRecordSelection(nextGroup?.records ?? [])
        }
    }

    function handleDeleteMod(projectId: string, modId: string): void {
        const target = projects.find(item => item.id === projectId)
        if (!target) return
        const remainingMods = target.mods.filter(mod => mod.id !== modId)
        const deletedMod = target.mods.find(mod => mod.id === modId) ?? null
        markProjectDirty(projectId)
        setProjects(previous => previous.map(project => (project.id === projectId ? { ...project, mods: remainingMods } : project)))
        if (deletedMod) {
            const deletedFiles = serializeProjectFiles({ ...target, mods: [deletedMod] }).map(write => write.relativePath)
            if (deletedFiles.length > 0) {
                setPendingDeletedFilesByProject(previous => ({
                    ...previous,
                    [projectId]: [...new Set([...(previous[projectId] ?? []), ...deletedFiles])],
                }))
            }
            setModRootPaths(previous => removeProjectModRoots(previous, { ...target, mods: [deletedMod] }))
        }
        if (selection?.kind === 'project' && selection.projectId === projectId && selection.modId === modId) {
            const nextSelection = getFirstProjectSelection('project', { ...target, mods: remainingMods })
            setSelection(nextSelection)
            const nextGroup = nextSelection
                ? (remainingMods.find(mod => mod.id === nextSelection.modId)?.groups.find(group => group.key === nextSelection.groupKey) ??
                  null)
                : null
            setRecordSelection(nextGroup?.records ?? [])
        }
    }

    function handleCloseProject(projectId: string): void {
        const closingProject = projects.find(item => item.id === projectId) ?? null
        if (!closingProject) return
        const remainingProjects = projects.filter(item => item.id !== projectId)
        const nextActiveProject = activeProjectId === projectId ? (remainingProjects[0] ?? null) : (project ?? null)

        setProjects(remainingProjects)
        setActiveProjectId(nextActiveProject?.id ?? null)
        setProjectRootPaths(previous => {
            const next = { ...previous }
            delete next[projectId]
            return next
        })
        setPendingDeletedFilesByProject(previous => {
            const next = { ...previous }
            delete next[projectId]
            return next
        })
        setDirtyProjectIds(previous => previous.filter(id => id !== projectId))
        setModRootPaths(previous => removeProjectModRoots(previous, closingProject))

        if (selection?.kind === 'project' && selection.projectId === projectId) {
            if (nextActiveProject) {
                applyProjectSelection('project', nextActiveProject)
            } else if (preloadProject) {
                applyProjectSelection('preload', preloadProject)
            } else {
                setSelection(null)
                setRecordSelection([])
            }
        }
    }

    function handleUpdateRecord(recordKey: string, field: string, value: JsonValue): void {
        if (!selection) return

        const updateProjectRecord = (item: ProjectData): ProjectData =>
            updateProjectGroupRecords(item, selection.modId, selection.groupKey, groupRecords =>
                groupRecords.map(record => (record.key === recordKey ? { ...record, data: { ...record.data, [field]: value } } : record))
            ) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? updateProjectRecord(item) : item)))
            return
        }

        markProjectDirty(selection.projectId)
        setProjects(previous => previous.map(item => (item.id === selection.projectId ? updateProjectRecord(item) : item)))
    }

    function handleCreateRecord(recordKey: string, data: Record<string, JsonValue>): void {
        if (!selection) return
        const nextRecord: JsonRecord = { key: recordKey, data: withDefaultRecordData(selection.groupKey, data) }

        const createRecordInProject = (item: ProjectData): ProjectData =>
            updateProjectGroupRecords(item, selection.modId, selection.groupKey, groupRecords =>
                groupRecords.some(record => record.key === recordKey)
                    ? groupRecords
                    : insertRecordSorted(selection.groupKey, groupRecords, nextRecord)
            ) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? createRecordInProject(item) : item)))
        } else {
            markProjectDirty(selection.projectId)
            setProjects(previous => previous.map(item => (item.id === selection.projectId ? createRecordInProject(item) : item)))
        }
        setSelectedRecordKey(recordKey)
        setSelectedRecordKeys([recordKey])
    }

    function handleGenerateSkillBook(recordKey: string): void {
        if (!selection || !isSkillBookSourceGroup(selection.groupKey) || !selectedMod) return

        const result = appendSkillBookToMod(selectedMod, selection.groupKey, recordKey)
        if (!result.ok) {
            const message =
                result.reason === 'missing-skill-id'
                    ? '当前记录缺少 Skill_ID，无法生成技能书'
                    : result.reason === 'item-id-exists'
                      ? `物品 ID ${result.skillId ?? ''} 已存在，未覆盖`
                      : '未找到可生成技能书的功法或神通记录'
            setTip({ message: message.trim(), tone: 'error' })
            return
        }

        const replaceMod = (item: ProjectData): ProjectData => ({
            ...item,
            mods: item.mods.map(mod => (mod.id === selection.modId ? result.mod : mod)),
        })

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? replaceMod(item) : item)))
        } else {
            markProjectDirty(selection.projectId)
            setProjects(previous => previous.map(item => (item.id === selection.projectId ? replaceMod(item) : item)))
        }
        setTip({ message: `已生成技能书：${String(result.item.data.name ?? result.skillId)}`, tone: 'success' })
    }

    function handleGenerateConsultBook(recordKey: string): void {
        if (!selection || selection.groupKey !== 'item' || !selectedMod) return
        const sourceRecord = records.find(record => record.key === recordKey)
        if (!sourceRecord) return

        const result = validateConsultBookGeneration(sourceRecord, records)
        if (!result.ok) {
            setConsultBookWarning(result.message)
            return
        }

        setConsultBookConfirm({
            recordKey,
            sourceId: result.sourceId,
            targetId: result.targetId,
            sourceName: result.sourceName,
            record: result.record,
        })
    }

    function confirmGenerateConsultBook(): void {
        if (!selection || !consultBookConfirm || selection.groupKey !== 'item') return
        const nextRecord = consultBookConfirm.record

        const addRecordToProject = (item: ProjectData): ProjectData =>
            updateProjectGroupRecords(item, selection.modId, selection.groupKey, groupRecords =>
                groupRecords.some(record => record.key === nextRecord.key)
                    ? groupRecords
                    : insertRecordSorted(selection.groupKey, groupRecords, nextRecord)
            ) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? addRecordToProject(item) : item)))
        } else {
            markProjectDirty(selection.projectId)
            setProjects(previous => previous.map(item => (item.id === selection.projectId ? addRecordToProject(item) : item)))
        }
        setSelectedRecordKey(nextRecord.key)
        setSelectedRecordKeys([nextRecord.key])
        const displayName = consultBookConfirm.sourceName || String(nextRecord.data.name ?? nextRecord.key)
        setTip({ message: '已生成请教书籍：' + displayName, tone: 'success' })
        setConsultBookConfirm(null)
    }
    function handleDeleteRecords(recordKeys: string[]): void {
        if (!selection || recordKeys.length === 0) return
        const keySet = new Set(recordKeys)
        const remainingRecords = records.filter(record => !keySet.has(record.key))
        const nextSelectedRecord =
            selectedRecordKey && !keySet.has(selectedRecordKey) ? selectedRecordKey : (remainingRecords[0]?.key ?? null)

        const deleteRecordsFromProject = (item: ProjectData): ProjectData =>
            updateProjectGroupRecords(item, selection.modId, selection.groupKey, groupRecords =>
                groupRecords.filter(record => !keySet.has(record.key))
            ) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? deleteRecordsFromProject(item) : item)))
        } else {
            const modName = selectedMod?.name
            if (modName) {
                const deletedFiles = recordKeys
                    .map(recordKey => resolveProjectRecordRelativePath(modName, selection.groupKey, recordKey))
                    .filter((relativePath): relativePath is string => relativePath !== null)
                if (deletedFiles.length > 0) {
                    setPendingDeletedFilesByProject(previous => ({
                        ...previous,
                        [selection.projectId]: [...new Set([...(previous[selection.projectId] ?? []), ...deletedFiles])],
                    }))
                }
            }
            markProjectDirty(selection.projectId)
            setProjects(previous => previous.map(item => (item.id === selection.projectId ? deleteRecordsFromProject(item) : item)))
        }
        setSelectedRecordKey(nextSelectedRecord)
        setSelectedRecordKeys(nextSelectedRecord ? [nextSelectedRecord] : [])
    }

    function handleBatchUpdateIds(changes: BatchIdChange[]): void {
        if (!selection || changes.length === 0) return

        const changeMap = new Map(changes.map(change => [change.oldKey, change]))
        const replaceIdsInProject = (item: ProjectData): ProjectData =>
            updateProjectGroupRecords(item, selection.modId, selection.groupKey, groupRecords =>
                groupRecords.map(record => {
                    const change = changeMap.get(record.key)
                    if (!change) return record
                    return { key: change.newKey, data: { ...record.data, [change.field]: change.value } }
                })
            ) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? replaceIdsInProject(item) : item)))
            setSelectedRecordKey(changes[0]?.newKey ?? selectedRecordKey)
            setSelectedRecordKeys(changes.map(change => change.newKey))
            return
        }

        // Directory-style groups persist one file per record; rename writes new files, so old files must be deleted on save.
        const modName = selectedMod?.name
        if (modName) {
            const deletedFiles = changes
                .map(change => resolveProjectRecordRelativePath(modName, selection.groupKey, change.oldKey))
                .filter((relativePath): relativePath is string => relativePath !== null)
            if (deletedFiles.length > 0) {
                setPendingDeletedFilesByProject(previous => ({
                    ...previous,
                    [selection.projectId]: [...new Set([...(previous[selection.projectId] ?? []), ...deletedFiles])],
                }))
            }
        }

        markProjectDirty(selection.projectId)
        setProjects(previous => previous.map(item => (item.id === selection.projectId ? replaceIdsInProject(item) : item)))
        setSelectedRecordKey(changes[0]?.newKey ?? selectedRecordKey)
        setSelectedRecordKeys(changes.map(change => change.newKey))
    }

    function handleUpdateSeidData(dataKey: SeidDataKey, seidId: string, targetKey: string, value: Record<string, JsonValue> | null): void {
        if (!selection) return
        const updateProjectSeid = (item: ProjectData): ProjectData =>
            updateProjectSeidData(item, selection.modId, dataKey, seidId, targetKey, value) ?? item

        if (selection.kind === 'preload') {
            setPreloadProjects(previous => previous.map(item => (item.id === selection.projectId ? updateProjectSeid(item) : item)))
            return
        }

        markProjectDirty(selection.projectId)
        setProjects(previous => previous.map(item => (item.id === selection.projectId ? updateProjectSeid(item) : item)))
    }

    async function saveProjectToDisk(target: ProjectData): Promise<number> {
        const rootPath = projectRootPaths[target.id]
        if (!rootPath) throw new Error(`项目 ${target.name} 没有可写入的根目录`)

        const writes = serializeProjectFiles(target)
        const pendingDeletedFiles = pendingDeletedFilesByProject[target.id] ?? []
        if (writes.length === 0 && pendingDeletedFiles.length === 0) return 0

        for (const relativePath of pendingDeletedFiles) {
            await invoke('delete_project_file', { rootPath, relativePath })
        }
        for (const write of writes) {
            await invoke('write_project_file', {
                rootPath,
                relativePath: write.relativePath,
                content: write.content,
            })
        }

        setPendingDeletedFilesByProject(previous => ({ ...previous, [target.id]: [] }))
        setDirtyProjectIds(previous => previous.filter(id => id !== target.id))
        return writes.length + pendingDeletedFiles.length
    }

    async function handleSaveProject(projectId: string): Promise<void> {
        const target = projects.find(item => item.id === projectId) ?? null
        if (!target) return
        try {
            const savedFileCount = await saveProjectToDisk(target)
            setTip({ message: `${SAVED_TEXT}（${target.name}：${savedFileCount} 个文件）`, tone: 'success' })
        } catch (error) {
            recordError('save-project', error)
            setTip({ message: SAVE_FAILED_TEXT, tone: 'error' })
        }
    }

    async function handleSaveAllProjects(): Promise<void> {
        if (projects.length === 0) return
        try {
            let savedFileCount = 0
            for (const target of projects) {
                savedFileCount += await saveProjectToDisk(target)
            }
            setTip({ message: `${SAVED_TEXT}（${projects.length} 个项目，${savedFileCount} 个文件）`, tone: 'success' })
        } catch (error) {
            recordError('save-all-projects', error)
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
                height: 680,
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

    /**
     * 根据聊天面板显隐调整主窗口宽度：打开时加宽 CHAT_PANEL_WIDTH，关闭时缩回打开前的宽度。
     * 全程使用逻辑像素（LogicalSize），通过 scaleFactor 把 outerSize 的物理像素换算为逻辑值，
     * 避免 DPI 缩放（125%/150% 等）下的尺寸偏差。非 Tauri 环境（纯 Web 预览）安全忽略。
     */
    async function syncChatWindowWidth(open: boolean): Promise<void> {
        let api: Window
        try {
            api = getCurrentWindow()
        } catch {
            return
        }
        try {
            // 最大化状态下 setSize 会被忽略，需先还原再调整。
            if (await api.isMaximized()) {
                await api.unmaximize()
            }
            const [size, scaleFactor] = await Promise.all([api.outerSize(), api.scaleFactor()])
            const logicalWidth = size.toLogical(scaleFactor).width
            const logicalHeight = size.toLogical(scaleFactor).height
            const panelWidth = chatPanelWidthRef.current
            if (open) {
                if (chatPrevWidthRef.current === null) {
                    chatPrevWidthRef.current = logicalWidth
                }
                await api.setSize(new LogicalSize(logicalWidth + panelWidth, logicalHeight))
            } else {
                const prev = chatPrevWidthRef.current ?? logicalWidth - panelWidth
                chatPrevWidthRef.current = null
                await api.setSize(new LogicalSize(Math.max(prev, CHAT_MIN_RESTORE_WIDTH), logicalHeight))
            }
        } catch {
            // 忽略窗口尺寸调整失败。
        }
    }

    async function handleOpenChat(): Promise<void> {
        const next = !chatOpen
        setChatOpen(next)
        void syncChatWindowWidth(next)
    }

    if (bootPhase === 'loading' || bootPhase === 'error') {
        return (
            <>
                <StartupLoading
                    status={bootPhase}
                    path={bootPath}
                    modeLabel={PRELOAD_MODE_OPTIONS.find(option => option.value === bootMode)?.label ?? ''}
                    message={bootError ? LOAD_FAILED_HINT : ''}
                    onRetry={() => setReloadToken(token => token + 1)}
                    onContinue={bootPhase === 'error' ? () => setBootPhase('ready') : undefined}
                    onOpenSettings={() => void handleOpenSettings()}
                />
                <ErrorDetailModal open={errorModalOpen} message={bootError} onClose={() => setErrorModalOpen(false)} />
            </>
        )
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink" onContextMenu={event => event.preventDefault()}>
            <TitleBar
                canSaveProject={projects.length > 0}
                projectDirty={dirtyProjectIds.length > 0}
                onOpenProject={() => void handleOpenProject()}
                onSaveProject={() => void handleSaveAllProjects()}
                onOpenChat={() => void handleOpenChat()}
                onOpenSettings={() => void handleOpenSettings()}
                onOpenErrorLog={() => void handleOpenErrorLog()}
            />
            <main className="flex min-h-0 flex-1">
                <LeftPanel
                    width={leftPanelWidth}
                    preloadProjects={preloadProjects}
                    projects={projects}
                    selection={selection}
                    onCreateMod={handleCreateMod}
                    onDeleteMod={handleDeleteMod}
                    onDeletePreloadMod={handleDeletePreloadMod}
                    onClosePreloadProject={handleClosePreloadProject}
                    onSaveProject={projectId => void handleSaveProject(projectId)}
                    onRenameMod={handleRenameMod}
                    onCloseProject={handleCloseProject}
                    onSelectPreloadGroup={(projectId, modId, groupKey) => handleSelectGroup('preload', projectId, modId, groupKey)}
                    onSelectGroup={(projectId, modId, groupKey) => handleSelectGroup('project', projectId, modId, groupKey)}
                />
                <Resizer onResize={delta => setLeftPanelWidth(previous => Math.max(160, previous + delta))} />
                <DataTable
                    groupKey={groupKey}
                    records={records}
                    selectedKey={selectedRecordKey}
                    selectedKeys={selectedRecordKeys}
                    onSelect={setSelectedRecordKey}
                    onSelectionChange={setSelectedRecordKeys}
                    onCreateRecord={handleCreateRecord}
                    onGenerateSkillBook={handleGenerateSkillBook}
                    onGenerateConsultBook={handleGenerateConsultBook}
                    onDeleteRecords={handleDeleteRecords}
                    onBatchUpdateIds={handleBatchUpdateIds}
                    metaDatasets={metaDatasets}
                    wuDaoTypeRecords={wuDaoTypeRecords}
                    modDirectory={selectedMod ? (selectedMod.directory ?? selectedMod.name) : null}
                    readAsset={readAsset}
                />
                <Resizer onResize={delta => setJsonEditorWidth(previous => Math.max(160, previous - delta))} />
                <JsonEditor
                    width={jsonEditorWidth}
                    groupKey={groupKey}
                    record={selectedRecord}
                    metaDatasets={metaDatasets}
                    affixRecords={affixRecords}
                    shenTongRecords={shenTongRecords}
                    skillRecords={skillRecords}
                    wuDaoTypeRecords={wuDaoTypeRecords}
                    wuDaoRecords={wuDaoRecords}
                    modDirectory={selectedMod ? (selectedMod.directory ?? selectedMod.name) : null}
                    readAsset={readAsset}
                    seidData={selectedMod?.seidData ?? {}}
                    seidRecords={seidDrawerRecords}
                    onUpdate={handleUpdateRecord}
                    onUpdateSeidData={handleUpdateSeidData}
                />
                {chatOpen ? (
                    <>
                        <Resizer onResize={delta => handleChatPanelWidth(Math.max(160, chatPanelWidthRef.current + delta))} />
                        <ChatPanel width={chatPanelWidth} onClose={() => void handleOpenChat()} />
                    </>
                ) : null}
            </main>
            {bootError ? (
                <div className="flex shrink-0 items-center border-t border-danger/30 bg-danger/10 px-3 py-1 text-xs text-danger">
                    <span className="truncate">{LOAD_FAILED_HINT}</span>
                </div>
            ) : null}
            <ErrorDetailModal open={errorModalOpen} message={bootError} onClose={() => setErrorModalOpen(false)} />

            {consultBookWarning ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setConsultBookWarning(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="生成请教书籍"
                        className="w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">生成请教书籍</h3>
                        </header>
                        <p className="px-5 py-5 text-sm text-ink-soft">{consultBookWarning}</p>
                        <footer className="flex justify-end border-t border-line px-5 py-3">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConsultBookWarning(null)}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                知道了
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}

            {consultBookConfirm ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setConsultBookConfirm(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="确认生成请教书籍"
                        className="w-[min(460px,calc(100vw-48px))] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-ink">生成请教书籍</h3>
                        </header>
                        <p className="px-5 py-5 text-sm text-ink-soft">
                            {'是否创建 ID 为 [(' +
                                consultBookConfirm.sourceId +
                                ')' +
                                (consultBookConfirm.sourceName || '') +
                                '] 的请教书籍？'}
                        </p>
                        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
                            <button
                                type="button"
                                onClick={() => setConsultBookConfirm(null)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={confirmGenerateConsultBook}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                确定
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}
            <Tip open={tip !== null} message={tip?.message ?? ''} tone={tip?.tone} onHide={() => setTip(null)} />
        </div>
    )
}
