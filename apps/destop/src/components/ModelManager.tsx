import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { type AiModelConfig, createAiModel, normalizeModelBaseUrl } from '../aiModels'

const SECTION_TITLE = '大模型配置'
const ADD_TEXT = '+'
const NAME_HEADER = '名称'
const BASE_URL_HEADER = 'Base URL'
const MODEL_HEADER = '模型'
const ACTION_HEADER = '操作'
const EDIT_TEXT = '编辑'
const DELETE_TEXT = '删除'
const EMPTY_TEXT = '暂无模型，点击右上角 + 添加'
const EDITOR_TITLE_ADD = '新增模型'
const EDITOR_TITLE_EDIT = '编辑模型'
const NAME_LABEL = '名称'
const NAME_PLACEHOLDER = '如 GPT-4o'
const BASE_URL_LABEL = 'Base URL'
const BASE_URL_PLACEHOLDER = 'https://api.openai.com/v1'
const API_KEY_LABEL = 'API Key'
const API_KEY_PLACEHOLDER = 'sk-...'
const MODEL_LABEL = '模型'
const MODEL_PLACEHOLDER = '如 gpt-4o'
const SAVE_TEXT = '保存'
const CANCEL_TEXT = '取消'

interface ModelManagerProps {
    models: AiModelConfig[]
    onChange: (models: AiModelConfig[]) => void
}

/** 模型编辑弹窗：新增或编辑单个模型配置。 */
function ModelEditorModal({
    initial,
    onSave,
    onClose,
}: {
    initial: AiModelConfig
    onSave: (model: AiModelConfig) => void
    onClose: () => void
}) {
    const isEditing = initial.name !== '' || initial.baseURL !== '' || initial.apiKey !== '' || initial.model !== ''
    const [name, setName] = useState(initial.name)
    const [baseURL, setBaseURL] = useState(initial.baseURL)
    const [apiKey, setApiKey] = useState(initial.apiKey)
    const [model, setModel] = useState(initial.model)

    useEffect(() => {
        function handleKeydown(event: KeyboardEvent): void {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeydown)
        return () => document.removeEventListener('keydown', handleKeydown)
    }, [onClose])

    function handleSave(): void {
        if (!name.trim() || !baseURL.trim() || !model.trim()) return
        onSave({
            id: initial.id,
            name: name.trim(),
            baseURL: normalizeModelBaseUrl(baseURL),
            apiKey: apiKey.trim(),
            model: model.trim(),
        })
    }

    const fieldClass =
        'w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none'

    return createPortal(
        <>
            <div className="fixed inset-0 z-[99] bg-black/40" onMouseDown={onClose} />
            <div className="fixed left-1/2 top-1/2 z-[100] w-[420px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-line-strong bg-panel shadow-2xl">
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                    <span className="text-sm font-medium text-ink">{isEditing ? EDITOR_TITLE_EDIT : EDITOR_TITLE_ADD}</span>
                </header>
                <div className="space-y-3 p-4">
                    <label className="block">
                        <span className="mb-1 block text-xs text-ink-muted">{NAME_LABEL}</span>
                        <input
                            type="text"
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder={NAME_PLACEHOLDER}
                            className={fieldClass}
                            autoFocus
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-ink-muted">{BASE_URL_LABEL}</span>
                        <input
                            type="text"
                            value={baseURL}
                            onChange={event => setBaseURL(event.target.value)}
                            placeholder={BASE_URL_PLACEHOLDER}
                            className={fieldClass}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-ink-muted">{API_KEY_LABEL}</span>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={event => setApiKey(event.target.value)}
                            placeholder={API_KEY_PLACEHOLDER}
                            className={fieldClass}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-ink-muted">{MODEL_LABEL}</span>
                        <input
                            type="text"
                            value={model}
                            onChange={event => setModel(event.target.value)}
                            placeholder={MODEL_PLACEHOLDER}
                            className={fieldClass}
                        />
                    </label>
                </div>
                <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-hover"
                    >
                        {CANCEL_TEXT}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!name.trim() || !baseURL.trim() || !model.trim()}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {SAVE_TEXT}
                    </button>
                </footer>
            </div>
        </>,
        document.body
    )
}

/** 模型管理区块：模型列表 + 新增/编辑/删除。 */
export function ModelManager({ models, onChange }: ModelManagerProps) {
    const [editing, setEditing] = useState<AiModelConfig | null>(null)

    function handleAdd(): void {
        setEditing(createAiModel())
    }

    function handleSave(model: AiModelConfig): void {
        const exists = models.some(item => item.id === model.id)
        onChange(exists ? models.map(item => (item.id === model.id ? model : item)) : [...models, model])
        setEditing(null)
    }

    function handleDelete(id: string): void {
        onChange(models.filter(item => item.id !== id))
    }

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-ink-muted">{SECTION_TITLE}</h2>
                <button
                    type="button"
                    onClick={handleAdd}
                    title={ADD_TEXT}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-base font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                    {ADD_TEXT}
                </button>
            </div>
            {models.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-xs text-ink-subtle">{EMPTY_TEXT}</p>
            ) : (
                <table className="w-full min-w-0 border-collapse text-left text-xs">
                    <thead>
                        <tr className="border-b border-line-strong text-ink-subtle">
                            <th className="pb-2 pr-2 font-medium">{NAME_HEADER}</th>
                            <th className="pb-2 pr-2 font-medium">{BASE_URL_HEADER}</th>
                            <th className="pb-2 pr-2 font-medium">{MODEL_HEADER}</th>
                            <th className="w-24 pb-2 text-right font-medium">{ACTION_HEADER}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map(item => (
                            <tr key={item.id} className="border-b border-line">
                                <td className="max-w-[120px] truncate py-1.5 pr-2 text-ink-soft">{item.name}</td>
                                <td className="max-w-[180px] truncate py-1.5 pr-2 text-ink-muted">{item.baseURL}</td>
                                <td className="max-w-[100px] truncate py-1.5 pr-2 text-ink-muted">{item.model}</td>
                                <td className="py-1.5 text-right">
                                    <button
                                        type="button"
                                        onClick={() => setEditing(item)}
                                        className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                                    >
                                        {EDIT_TEXT}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id)}
                                        className="ml-1 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger hover:text-white"
                                    >
                                        {DELETE_TEXT}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {editing ? <ModelEditorModal initial={editing} onSave={handleSave} onClose={() => setEditing(null)} /> : null}
        </section>
    )
}
