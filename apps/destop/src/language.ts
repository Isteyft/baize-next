import { AppLanguage } from '@baize-next/types'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'

const STORAGE_KEY = 'baize-next.language'
const LANGUAGE_EVENT = 'baize-next:language-changed'

export const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
    { value: AppLanguage.ZhCN, label: '简体中文' },
    { value: AppLanguage.En, label: 'English' },
]

function isAppLanguage(value: string | null): value is AppLanguage {
    return value === AppLanguage.ZhCN || value === AppLanguage.En
}

/** 读取已保存的界面语言，未保存或异常时回退到简体中文。 */
export function getSavedLanguage(): AppLanguage {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (isAppLanguage(raw)) return raw
    } catch {
        // 非 Tauri / 存储受限环境忽略。
    }
    return AppLanguage.ZhCN
}

/** 将语言写入 document.documentElement.lang。 */
export function applyLanguage(language: AppLanguage): void {
    document.documentElement.lang = language
}

function persistLanguage(language: AppLanguage): void {
    try {
        localStorage.setItem(STORAGE_KEY, language)
    } catch {
        // 忽略存储写入异常。
    }
}

/** 应用语言并持久化。 */
export function setLanguage(language: AppLanguage): void {
    applyLanguage(language)
    persistLanguage(language)
    void broadcastLanguage(language)
}

/** 通过 Tauri 事件向所有窗口广播语言变更（非 Tauri 环境安全忽略）。 */
async function broadcastLanguage(language: AppLanguage): Promise<void> {
    try {
        await emit(LANGUAGE_EVENT, language)
    } catch {
        // 浏览器预览等非 Tauri 环境忽略。
    }
}

/** 订阅跨窗口语言变更；返回取消函数。 */
export function subscribeLanguage(onChange: (language: AppLanguage) => void): () => void {
    const cleanup: Array<() => void> = []

    // 浏览器预览兜底：监听 localStorage 的 storage 事件，并同步应用到本窗口。
    const handleStorage = (event: StorageEvent): void => {
        if (event.key === STORAGE_KEY && isAppLanguage(event.newValue)) {
            applyLanguage(event.newValue)
            onChange(event.newValue)
        }
    }
    window.addEventListener('storage', handleStorage)
    cleanup.push(() => window.removeEventListener('storage', handleStorage))

    // Tauri 多窗口同步。
    let unlisten: UnlistenFn | undefined
    try {
        void listen<string>(LANGUAGE_EVENT, event => {
            if (isAppLanguage(event.payload)) {
                applyLanguage(event.payload)
                onChange(event.payload)
            }
        }).then(fn => {
            unlisten = fn
        })
    } catch {
        // 非 Tauri 环境忽略。
    }
    cleanup.push(() => unlisten?.())

    return () => cleanup.forEach(fn => fn())
}
