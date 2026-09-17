import { invoke, isTauri } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
    isTauri: vi.fn(),
}))

describe('settings storage', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.resetModules()
        vi.mocked(invoke).mockReset()
        vi.mocked(isTauri).mockReset()
        delete (globalThis as { isTauri?: boolean }).isTauri
    })

    it('uses localStorage in browser previews', async () => {
        vi.mocked(isTauri).mockReturnValue(false)
        const storage = await import('./settingsStorage')

        await storage.initializeSettingsStorage()
        storage.setSettingsStorageItem('baize-next.theme', 'dark')

        expect(storage.getSettingsStorageItem('baize-next.theme')).toBe('dark')
        expect(localStorage.getItem('baize-next.theme')).toBe('dark')
        expect(invoke).not.toHaveBeenCalled()
    })

    it('migrates browser settings to the Tauri settings file', async () => {
        vi.mocked(isTauri).mockReturnValue(true)
        const writes: unknown[] = []
        vi.mocked(invoke).mockImplementation(async (command, args) => {
            if (command === 'read_app_settings') return null
            if (command === 'write_app_settings') {
                writes.push(args)
                return undefined
            }
            throw new Error(`Unexpected command: ${command}`)
        })
        localStorage.setItem('baize-next.theme', 'light')
        localStorage.setItem('baize-next.language', 'en')

        const storage = await import('./settingsStorage')
        await storage.initializeSettingsStorage()

        expect(writes).toEqual([
            {
                settings: {
                    'baize-next.theme': 'light',
                    'baize-next.language': 'en',
                },
            },
        ])
        expect(storage.getSettingsStorageItem('baize-next.theme')).toBe('light')
        expect(storage.getSettingsStorageItem('baize-next.language')).toBe('en')
        expect(localStorage.getItem('baize-next.theme')).toBeNull()
        expect(localStorage.getItem('baize-next.language')).toBeNull()
    })
})
