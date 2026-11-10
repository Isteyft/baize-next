import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('chatSettings', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.resetModules()
    })

    it('getSavedChatSettings 无数据时返回空 dir', async () => {
        const { getSavedChatSettings } = await import('./chatSettings')
        expect(getSavedChatSettings()).toEqual({ dir: '' })
    })

    it('saveChatSettings 后可读回', async () => {
        const { getSavedChatSettings, saveChatSettings } = await import('./chatSettings')
        saveChatSettings({ dir: '/tmp/chat' })
        expect(getSavedChatSettings()).toEqual({ dir: '/tmp/chat' })
    })

    it('getDefaultChatDir 返回后端默认目录', async () => {
        const invokeMock = vi.fn().mockResolvedValue('/exe/.bz-chat')
        vi.doMock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }))
        const { getDefaultChatDir } = await import('./chatSettings')
        expect(await getDefaultChatDir()).toBe('/exe/.bz-chat')
    })

    it('resolveChatDir 优先用户配置', async () => {
        const { getSavedChatSettings, saveChatSettings } = await import('./chatSettings')
        saveChatSettings({ dir: '/custom' })
        const { resolveChatDir } = await import('./chatSettings')
        expect(await resolveChatDir()).toBe('/custom')
        expect(getSavedChatSettings().dir).toBe('/custom')
    })
})
