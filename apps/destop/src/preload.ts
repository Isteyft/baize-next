import { PreloadSourceMode } from '@baize-next/types'

import { getSettingsStorageItem, setSettingsStorageItem } from './settingsStorage'

export interface PreloadSourceEntry {
    id: string
    mode: PreloadSourceMode
    path: string
}

export interface PreloadSettings {
    meta: PreloadSourceEntry[]
    mods: PreloadSourceEntry[]
}

const STORAGE_KEY = 'baize-next.preload-settings'

export const DEFAULT_PRELOAD_MODE = PreloadSourceMode.Directory
export const DEFAULT_META_PRELOAD_PATH = './Editor'
export const DEFAULT_MOD_PRELOAD_PATH = './Editor'

export const PRELOAD_MODE_OPTIONS: { value: PreloadSourceMode; label: string }[] = [
    { value: PreloadSourceMode.Directory, label: '加载目录' },
    { value: PreloadSourceMode.Json, label: '加载 JSON' },
]

function isPreloadMode(value: string | null): value is PreloadSourceMode {
    return value === PreloadSourceMode.Json || value === PreloadSourceMode.Directory
}

export function createPreloadEntry(mode: PreloadSourceMode = DEFAULT_PRELOAD_MODE, path = ''): PreloadSourceEntry {
    return {
        id: `preload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode,
        path,
    }
}

function normalizeEntry(value: unknown): PreloadSourceEntry | null {
    if (!value || typeof value !== 'object') return null
    const entry = value as Partial<PreloadSourceEntry>
    const mode = entry.mode ?? null
    if (typeof entry.id !== 'string' || !isPreloadMode(mode) || typeof entry.path !== 'string') return null
    return { id: entry.id, mode, path: entry.path }
}

function normalizeEntries(value: unknown): PreloadSourceEntry[] | null {
    if (!Array.isArray(value)) return null
    const entries = value.map(normalizeEntry).filter((entry): entry is PreloadSourceEntry => entry !== null)
    return entries.length > 0 ? entries : null
}

export function getSavedPreloadSettings(): PreloadSettings {
    try {
        const raw = getSettingsStorageItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as unknown
            if (parsed && typeof parsed === 'object') {
                const data = parsed as Record<string, unknown>
                const meta = normalizeEntries(data.meta)
                const mods = normalizeEntries(data.mods)
                if (meta || mods) {
                    return {
                        meta: meta ?? [createPreloadEntry(DEFAULT_PRELOAD_MODE, DEFAULT_META_PRELOAD_PATH)],
                        mods: mods ?? [],
                    }
                }
                const oldMode = data.mode
                const oldPath = data.path
                if (typeof oldMode === 'string' && typeof oldPath === 'string') {
                    return {
                        meta: [createPreloadEntry(isPreloadMode(oldMode) ? oldMode : DEFAULT_PRELOAD_MODE, oldPath)],
                        mods: [],
                    }
                }
            }
        }
    } catch {
        // Ignore storage failures.
    }
    return {
        meta: [createPreloadEntry(DEFAULT_PRELOAD_MODE, DEFAULT_META_PRELOAD_PATH)],
        mods: [],
    }
}

export function savePreloadSettings(settings: PreloadSettings): void {
    try {
        setSettingsStorageItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // Ignore storage failures.
    }
}
