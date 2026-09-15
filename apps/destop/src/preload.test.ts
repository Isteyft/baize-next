import { PreloadSourceMode } from '@baize-next/types'
import { beforeEach, describe, expect, it } from 'vitest'

import {
    createPreloadEntry,
    DEFAULT_META_PRELOAD_PATH,
    DEFAULT_MOD_PRELOAD_PATH,
    getSavedPreloadSettings,
    savePreloadSettings,
} from './preload'

describe('preload settings', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns safe defaults when nothing is saved', () => {
        const settings = getSavedPreloadSettings()

        expect(settings.mods).toEqual([])
        expect(settings.meta).toHaveLength(1)
        expect(settings.meta[0]?.mode).toBe(PreloadSourceMode.Directory)
        expect(settings.meta[0]?.path).toBe(DEFAULT_META_PRELOAD_PATH)
        expect(DEFAULT_MOD_PRELOAD_PATH).toBe('./Editor')
    })

    it('migrates the old single source settings shape', () => {
        localStorage.setItem('baize-next.preload-settings', JSON.stringify({ mode: PreloadSourceMode.Json, path: './meta.json' }))

        const settings = getSavedPreloadSettings()

        expect(settings.meta).toHaveLength(1)
        expect(settings.meta[0]?.mode).toBe(PreloadSourceMode.Json)
        expect(settings.meta[0]?.path).toBe('./meta.json')
        expect(settings.mods).toEqual([])
    })

    it('keeps only valid entries and saves them back intact', () => {
        savePreloadSettings({
            meta: [
                createPreloadEntry(PreloadSourceMode.Json, './a.json'),
                { id: 'broken', mode: 'bad-mode' as PreloadSourceMode, path: './broken.json' },
            ],
            mods: [createPreloadEntry(PreloadSourceMode.Directory, './mods')],
        })

        const settings = getSavedPreloadSettings()

        expect(settings.meta).toHaveLength(1)
        expect(settings.meta[0]?.mode).toBe(PreloadSourceMode.Json)
        expect(settings.meta[0]?.path).toBe('./a.json')
        expect(settings.mods).toHaveLength(1)
    })
})
