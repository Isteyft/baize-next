import { PreloadSourceMode } from '@baize-next/types'

export interface PreloadSourceEntry {
    id: string
    mode: PreloadSourceMode
    path: string
}

export interface PreloadSettings {
    entries: PreloadSourceEntry[]
}

const STORAGE_KEY = 'baize-next.preload-settings'

export const DEFAULT_PRELOAD_MODE = PreloadSourceMode.Directory
export const DEFAULT_PRELOAD_PATH = './Editor'

export const PRELOAD_MODE_OPTIONS: { value: PreloadSourceMode; label: string }[] = [
    { value: PreloadSourceMode.Directory, label: '\u52a0\u8f7d\u76ee\u5f55' },
    { value: PreloadSourceMode.Json, label: '\u52a0\u8f7d JSON' },
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

export function getSavedPreloadSettings(): PreloadSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as unknown
            if (parsed && typeof parsed === 'object') {
                const data = parsed as Record<string, unknown>
                if (Array.isArray(data.entries)) {
                    const entries = data.entries.map(normalizeEntry).filter((entry): entry is PreloadSourceEntry => entry !== null)
                    if (entries.length > 0) return { entries }
                }
                const oldMode = data.mode
                const oldPath = data.path
                if (typeof oldMode === 'string' && typeof oldPath === 'string') {
                    return {
                        entries: [createPreloadEntry(isPreloadMode(oldMode) ? oldMode : DEFAULT_PRELOAD_MODE, oldPath)],
                    }
                }
            }
        }
    } catch {
        // Ignore storage failures.
    }
    return { entries: [createPreloadEntry(DEFAULT_PRELOAD_MODE, DEFAULT_PRELOAD_PATH)] }
}

export function savePreloadSettings(settings: PreloadSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // Ignore storage failures.
    }
}
