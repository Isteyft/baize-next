import { invoke, isTauri } from '@tauri-apps/api/core'

const SETTING_KEYS = ['baize-next.theme', 'baize-next.language', 'baize-next.preload-settings', 'baize-next.ai-models'] as const

type SettingKey = (typeof SETTING_KEYS)[number]
type SettingsMap = Partial<Record<SettingKey, string>>

let settings: SettingsMap = {}
let useFileStorage = false
let initialized = false
let saveQueue: Promise<void> = Promise.resolve()

function isSettingsKey(key: string): key is SettingKey {
    return (SETTING_KEYS as readonly string[]).includes(key)
}

function normalizeSettings(value: unknown): SettingsMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const normalized: SettingsMap = {}
    for (const [key, rawValue] of Object.entries(value)) {
        if (isSettingsKey(key) && typeof rawValue === 'string') {
            normalized[key] = rawValue
        }
    }
    return normalized
}

function readBrowserSettings(): SettingsMap {
    const saved: SettingsMap = {}
    try {
        for (const key of SETTING_KEYS) {
            const value = localStorage.getItem(key)
            if (value !== null) saved[key] = value
        }
    } catch {
        // Browser storage can be unavailable in restricted previews.
    }
    return saved
}

function clearBrowserSettings(): void {
    try {
        for (const key of SETTING_KEYS) localStorage.removeItem(key)
    } catch {
        // Ignore browser storage failures.
    }
}

function persistFileSettings(): void {
    if (!useFileStorage) return
    const snapshot = { ...settings }
    saveQueue = saveQueue
        .catch(() => undefined)
        .then(async () => {
            await invoke('write_app_settings', { settings: snapshot })
        })
        .catch(() => undefined)
}

/** Initializes settings storage. Tauri uses appDataDir/settings.json; browser previews use localStorage. */
export async function initializeSettingsStorage(): Promise<void> {
    if (initialized) return
    initialized = true

    try {
        useFileStorage = isTauri()
    } catch {
        useFileStorage = false
    }

    if (!useFileStorage) return

    try {
        const stored = await invoke<unknown>('read_app_settings')
        const fileSettings = normalizeSettings(stored)
        if (Object.keys(fileSettings).length > 0) {
            settings = fileSettings
            return
        }

        const browserSettings = readBrowserSettings()
        settings = browserSettings
        if (Object.keys(browserSettings).length > 0) {
            persistFileSettings()
            await saveQueue
            clearBrowserSettings()
        }
    } catch {
        settings = {}
    }
}

/** Reads a setting after initializeSettingsStorage has completed. */
export function getSettingsStorageItem(key: SettingKey): string | null {
    if (useFileStorage) return settings[key] ?? null
    return readBrowserSettings()[key] ?? null
}

/** Writes a setting to settings.json in Tauri, or localStorage in browser previews. */
export function setSettingsStorageItem(key: SettingKey, value: string): void {
    if (useFileStorage) {
        settings = { ...settings, [key]: value }
        persistFileSettings()
        return
    }

    try {
        localStorage.setItem(key, value)
    } catch {
        // Ignore browser storage failures.
    }
}
