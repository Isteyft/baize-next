import { AppLanguage, ThemeColor } from '@baize-next/types'
import { emit, listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyLanguage, getSavedLanguage, setLanguage } from './language'
import { applyTheme, getSavedTheme, setTheme } from './theme'

vi.mock('@tauri-apps/api/event', () => ({
    emit: vi.fn(async () => undefined),
    listen: vi.fn(async () => () => undefined),
}))

describe('theme settings', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
        vi.mocked(emit).mockClear()
        vi.mocked(listen).mockClear()
    })

    it('falls back to cyan-black unless a supported theme is saved', () => {
        localStorage.setItem('baize-next.theme', ThemeColor.Light)
        expect(getSavedTheme()).toBe(ThemeColor.Light)
        localStorage.setItem('baize-next.theme', 'unsupported')
        expect(getSavedTheme()).toBe(ThemeColor.CyanBlack)
    })

    it('applies and persists themes', () => {
        setTheme(ThemeColor.Dark)
        expect(document.documentElement.dataset.theme).toBe('dark')
        expect(localStorage.getItem('baize-next.theme')).toBe(ThemeColor.Dark)
        expect(emit).toHaveBeenCalledWith('baize-next:theme-changed', ThemeColor.Dark)
    })

    it('applies theme directly', () => {
        applyTheme(ThemeColor.Light)
        expect(document.documentElement.dataset.theme).toBe('light')
    })
})

describe('language settings', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.lang = ''
        vi.mocked(emit).mockClear()
    })

    it('falls back to simplified Chinese unless a supported language is saved', () => {
        localStorage.setItem('baize-next.language', AppLanguage.En)
        expect(getSavedLanguage()).toBe(AppLanguage.En)
        localStorage.setItem('baize-next.language', 'unsupported')
        expect(getSavedLanguage()).toBe(AppLanguage.ZhCN)
    })

    it('applies and persists languages', () => {
        setLanguage(AppLanguage.En)
        expect(document.documentElement.lang).toBe('en')
        expect(localStorage.getItem('baize-next.language')).toBe(AppLanguage.En)
        expect(emit).toHaveBeenCalledWith('baize-next:language-changed', AppLanguage.En)
    })

    it('applies language directly', () => {
        applyLanguage(AppLanguage.ZhCN)
        expect(document.documentElement.lang).toBe('zh-CN')
    })
})
