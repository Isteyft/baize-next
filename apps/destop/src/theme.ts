import { ThemeColor } from '@baize-next/types'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'

import { getSettingsStorageItem, setSettingsStorageItem } from './settingsStorage'

const STORAGE_KEY = 'baize-next.theme'
const THEME_EVENT = 'baize-next:theme-changed'

const THEME_ATTR: Record<ThemeColor, string> = {
    [ThemeColor.CyanBlack]: 'cyan-black',
    [ThemeColor.Dark]: 'dark',
    [ThemeColor.Light]: 'light',
}

export const THEME_OPTIONS: { value: ThemeColor; label: string }[] = [
    { value: ThemeColor.CyanBlack, label: '青黑色' },
    { value: ThemeColor.Dark, label: '暗色（黑）' },
    { value: ThemeColor.Light, label: '亮色（白）' },
]

function isThemeColor(value: string | null): value is ThemeColor {
    return value === ThemeColor.CyanBlack || value === ThemeColor.Dark || value === ThemeColor.Light
}

/** 读取已保存的主题，未保存或异常时回退到青黑色。 */
export function getSavedTheme(): ThemeColor {
    try {
        const raw = getSettingsStorageItem(STORAGE_KEY)
        if (isThemeColor(raw)) return raw
    } catch {
        // 非 Tauri / 存储受限环境忽略。
    }
    return ThemeColor.CyanBlack
}

/** 将主题写入 data-theme，让 CSS Token 生效。 */
export function applyTheme(theme: ThemeColor): void {
    document.documentElement.dataset.theme = THEME_ATTR[theme]
}

function persistTheme(theme: ThemeColor): void {
    try {
        setSettingsStorageItem(STORAGE_KEY, theme)
    } catch {
        // 忽略存储写入异常。
    }
}

/** 应用主题并持久化。 */
export function setTheme(theme: ThemeColor): void {
    applyTheme(theme)
    persistTheme(theme)
    void broadcastTheme(theme)
}

/** 通过 Tauri 事件向所有窗口广播主题变更（非 Tauri 环境安全忽略）。 */
async function broadcastTheme(theme: ThemeColor): Promise<void> {
    try {
        await emit(THEME_EVENT, theme)
    } catch {
        // 浏览器预览等非 Tauri 环境忽略。
    }
}

/** 订阅跨窗口主题变更；返回取消函数。 */
export function subscribeTheme(onChange: (theme: ThemeColor) => void): () => void {
    const cleanup: Array<() => void> = []

    // 浏览器预览兜底：监听 localStorage 的 storage 事件，并同步应用到本窗口。
    const handleStorage = (event: StorageEvent): void => {
        if (event.key === STORAGE_KEY && isThemeColor(event.newValue)) {
            applyTheme(event.newValue)
            onChange(event.newValue)
        }
    }
    window.addEventListener('storage', handleStorage)
    cleanup.push(() => window.removeEventListener('storage', handleStorage))

    // Tauri 多窗口同步。
    let unlisten: UnlistenFn | undefined
    try {
        void listen<string>(THEME_EVENT, event => {
            if (isThemeColor(event.payload)) {
                applyTheme(event.payload)
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
