import { type ChangeEvent, useRef, useState } from 'react'

import { DataTable } from './components/DataTable'
import { JsonEditor } from './components/JsonEditor'
import { LeftPanel } from './components/LeftPanel'
import { TitleBar } from './components/TitleBar'
import type { JsonDataset, JsonValue } from './types/json'
import { parseFolderFiles, parseJsonContent, readFileAsText } from './utils/json'

/** 单文件输入允许的 JSON 扩展名过滤。 */
const JSON_EXT = '.json,application/json'

/**
 * 桌面端根组件。
 * 负责 JSON 文件导入、数据集与记录选择、以及编辑回写状态管理。
 */
export default function App() {
    const [datasets, setDatasets] = useState<JsonDataset[]>([])
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)
    const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)

    const selectedDataset = datasets.find(dataset => dataset.id === selectedDatasetId) ?? null
    const selectedRecord = selectedDataset?.records.find(record => record.key === selectedRecordKey) ?? null

    /** 在标题栏“文件 > 打开文件”点击时触发单文件多选。 */
    function handleOpenFile(): void {
        fileInputRef.current?.click()
    }

    /** 在标题栏“文件 > 打开文件夹”点击时触发文件夹目录选择。 */
    function handleOpenFolder(): void {
        folderInputRef.current?.click()
    }

    /** 处理单文件/多文件 JSON 导入。 */
    async function handleFilesChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const files = event.target.files
        if (!files || files.length === 0) return
        try {
            const imported: JsonDataset[] = []
            for (const file of Array.from(files)) {
                const content = await readFileAsText(file)
                imported.push(parseJsonContent(file.name.replace(/\.json$/i, ''), content))
            }
            mergeDatasets(imported)
        } catch (error) {
            window.alert(error instanceof Error ? `导入失败：${error.message}` : '导入失败')
        } finally {
            event.target.value = ''
        }
    }

    /** 处理文件夹 JSON 批导入。 */
    async function handleFolderChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const files = event.target.files
        if (!files || files.length === 0) return
        try {
            const jsonFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.json'))
            if (jsonFiles.length === 0) {
                window.alert('所选目录中没有 .json 文件')
                return
            }
            const folderName = jsonFiles[0]?.webkitRelativePath.split('/')[0] || '未命名目录'
            const imported = await parseFolderFiles(folderName, jsonFiles)
            mergeDatasets([imported])
        } catch (error) {
            window.alert(error instanceof Error ? `导入失败：${error.message}` : '导入失败')
        } finally {
            event.target.value = ''
        }
    }

    /** 合并新数据集并自动选中第一个。 */
    function mergeDatasets(newDatasets: JsonDataset[]): void {
        const nextId = newDatasets[0]?.id ?? null
        const nextKey = newDatasets[0]?.records[0]?.key ?? null
        setDatasets(prev => [...prev, ...newDatasets])
        if (nextId) {
            setSelectedDatasetId(nextId)
            setSelectedRecordKey(nextKey)
        }
    }

    /** 切换当前数据集并重置记录选择。 */
    function handleDatasetSelect(id: string): void {
        setSelectedDatasetId(id)
        const dataset = datasets.find(item => item.id === id)
        setSelectedRecordKey(dataset?.records[0]?.key ?? null)
    }

    /** 更新当前数据集内指定记录的 JSON 数据。 */
    function handleRecordUpdate(key: string, data: Record<string, JsonValue>): void {
        if (!selectedDatasetId) return
        setDatasets(prev =>
            prev.map(dataset =>
                dataset.id === selectedDatasetId
                    ? {
                          ...dataset,
                          records: dataset.records.map(record => (record.key === key ? { ...record, data } : record)),
                      }
                    : dataset
            )
        )
    }

    return (
        <div className="flex h-full flex-col bg-gray-950 text-gray-100">
            <TitleBar onOpenFile={handleOpenFile} onOpenFolder={handleOpenFolder} onOpenSettings={() => setSettingsOpen(true)} />
            <main className="flex min-h-0 flex-1">
                <LeftPanel datasets={datasets} selectedId={selectedDatasetId} onSelect={handleDatasetSelect} />
                <DataTable records={selectedDataset?.records ?? []} selectedKey={selectedRecordKey} onSelect={setSelectedRecordKey} />
                <JsonEditor record={selectedRecord} onUpdate={handleRecordUpdate} />
            </main>

            {/* 隐藏的原生文件选择控件 */}
            <input
                ref={fileInputRef}
                type="file"
                accept={JSON_EXT}
                multiple
                className="hidden"
                onChange={event => void handleFilesChange(event)}
            />
            {/* webkitdirectory 允许选择整个目录 */}
            <input
                ref={node => {
                    folderInputRef.current = node
                    node?.setAttribute('webkitdirectory', '')
                }}
                type="file"
                className="hidden"
                onChange={event => void handleFolderChange(event)}
            />

            {/* 设置占位弹窗（TODO） */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettingsOpen(false)}>
                    <div
                        className="w-80 rounded-lg border border-gray-700 bg-gray-800 p-5 shadow-xl"
                        onClick={event => event.stopPropagation()}
                    >
                        <h3 className="text-base font-medium text-gray-100">设置</h3>
                        <p className="mt-2 text-sm text-gray-400">设置功能 TODO，待后续版本实现。</p>
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(false)}
                            className="mt-4 rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-500"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
