import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'

import { getSettingsStorageItem, setSettingsStorageItem } from './settingsStorage'

/** 单个大模型 API 配置。 */
export interface AiModelConfig {
    /** 唯一标识。 */
    id: string
    /** 显示名称，如「GPT-4o」。 */
    name: string
    /** API 基础地址，如 https://api.openai.com/v1（末尾斜杠会被规范化）。 */
    baseURL: string
    /** API Key。 */
    apiKey: string
    /** 模型标识，如 gpt-4o。 */
    model: string
}

const STORAGE_KEY = 'baize-next.ai-models'
const MODELS_EVENT = 'baize-next:ai-models-changed'

/** 生成唯一模型 id。 */
export function createAiModelId(): string {
    return `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 规范化 Base URL：去除首尾空白与末尾斜杠；缺少协议时自动补 https://。
 * 例如 "api.moonshot.cn/v1/" -> "https://api.moonshot.cn/v1"
 */
export function normalizeModelBaseUrl(baseURL: string): string {
    let normalized = baseURL.trim().replace(/\/+$/, '')
    if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`
    }
    return normalized
}

/** 创建一份空模型配置。 */
export function createAiModel(): AiModelConfig {
    return {
        id: createAiModelId(),
        name: '',
        baseURL: '',
        apiKey: '',
        model: '',
    }
}

function isAiModelConfig(value: unknown): value is AiModelConfig {
    if (!value || typeof value !== 'object') return false
    const entry = value as Partial<AiModelConfig>
    return (
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.baseURL === 'string' &&
        typeof entry.apiKey === 'string' &&
        typeof entry.model === 'string'
    )
}

function normalizeModels(value: unknown): AiModelConfig[] | null {
    if (!Array.isArray(value)) return null
    const models = value.filter(isAiModelConfig)
    return models.length > 0 ? models : null
}

/** 读取已保存的大模型配置列表，未保存或异常时返回空数组。 */
export function getSavedAiModels(): AiModelConfig[] {
    try {
        const raw = getSettingsStorageItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as unknown
            const models = normalizeModels(parsed)
            if (models) return models
        }
    } catch {
        // Ignore storage failures.
    }
    return []
}

/** 持久化大模型配置列表。 */
export function saveAiModels(models: AiModelConfig[]): void {
    try {
        setSettingsStorageItem(STORAGE_KEY, JSON.stringify(models))
    } catch {
        // Ignore storage failures.
    }
    void broadcastAiModels(models)
}

/** 通过 Tauri 事件向所有窗口广播模型变更（非 Tauri 环境安全忽略）。 */
async function broadcastAiModels(models: AiModelConfig[]): Promise<void> {
    try {
        await emit(MODELS_EVENT, models)
    } catch {
        // 浏览器预览等非 Tauri 环境忽略。
    }
}

/** 订阅跨窗口大模型配置变更；返回取消函数。 */
export function subscribeAiModels(onChange: (models: AiModelConfig[]) => void): () => void {
    const cleanup: Array<() => void> = []

    // 浏览器预览兜底：监听 localStorage 的 storage 事件。
    const handleStorage = (event: StorageEvent): void => {
        if (event.key !== STORAGE_KEY) return
        try {
            const parsed = JSON.parse(event.newValue ?? '[]') as unknown
            const models = normalizeModels(parsed)
            onChange(models ?? [])
        } catch {
            onChange([])
        }
    }
    window.addEventListener('storage', handleStorage)
    cleanup.push(() => window.removeEventListener('storage', handleStorage))

    // Tauri 多窗口同步。
    let unlisten: UnlistenFn | undefined
    try {
        void listen<unknown>(MODELS_EVENT, event => {
            const models = normalizeModels(event.payload)
            onChange(models ?? [])
        }).then(fn => {
            unlisten = fn
        })
    } catch {
        // 非 Tauri 环境忽略。
    }
    cleanup.push(() => unlisten?.())

    return () => cleanup.forEach(fn => fn())
}
