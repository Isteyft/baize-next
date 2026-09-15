import { PreloadSourceMode, type AppLanguage, type ThemeColor } from '@baize-next/types'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'

import { getSavedLanguage, LANGUAGE_OPTIONS, setLanguage as persistLanguage, subscribeLanguage } from '../language'
import {
    createPreloadEntry,
    DEFAULT_PRELOAD_PATH,
    getSavedPreloadSettings,
    PRELOAD_MODE_OPTIONS,
    savePreloadSettings,
    type PreloadSourceEntry,
} from '../preload'
import { getSavedTheme, setTheme as persistTheme, subscribeTheme, THEME_OPTIONS } from '../theme'
import { Select, type SelectOption } from './Select'
import { WindowControls } from './WindowControls'
import { Tip, type TipTone } from './Tip'

const THEME_SELECT_OPTIONS: SelectOption<ThemeColor>[] = THEME_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
}))

const LANGUAGE_SELECT_OPTIONS: SelectOption<AppLanguage>[] = LANGUAGE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
}))

const PRELOAD_MODE_SELECT_OPTIONS: SelectOption<PreloadSourceMode>[] = PRELOAD_MODE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
}))

const SETTINGS_TITLE = '设置'
const SAVE_TEXT = '保存'
const SAVED_TEXT = '已保存'
const THEME_SECTION_TITLE = '主题外观'
const LANGUAGE_SECTION_TITLE = '界面语言'
const PRELOAD_SECTION_TITLE = 'Meta 预加载'
const CHOOSE_PATH_TEXT = '选择'
const REMOVE_TEXT = '移除'
const MODE_HEADER = '模式'
const PATH_HEADER = '路径'
const ACTION_HEADER = '操作'
const ADD_TEXT = '+'

export function SettingsWindow() {
    const [theme, setTheme] = useState<ThemeColor>(getSavedTheme)
    const [language, setLanguage] = useState<AppLanguage>(getSavedLanguage)
    const initialPreload = getSavedPreloadSettings()
    const [preloadEntries, setPreloadEntries] = useState<PreloadSourceEntry[]>(initialPreload.entries)
    const [tip, setTip] = useState<{ message: string; tone: TipTone } | null>(null)

    useEffect(() => {
        return subscribeTheme(next => {
            setTheme(next)
        })
    }, [])

    useEffect(() => {
        return subscribeLanguage(next => {
            setLanguage(next)
        })
    }, [])

    function handleSave(): void {
        persistTheme(theme)
        persistLanguage(language)
        savePreloadSettings({ entries: preloadEntries })
        setTip({ message: SAVED_TEXT, tone: 'success' })
    }

    function handleAddEntry(): void {
        setPreloadEntries(prev => [...prev, createPreloadEntry(PreloadSourceMode.Directory)])
    }

    function handleRemoveEntry(entryId: string): void {
        setPreloadEntries(prev => prev.filter(entry => entry.id !== entryId))
    }

    function handleUpdateEntry(entryId: string, patch: Partial<PreloadSourceEntry>): void {
        setPreloadEntries(prev => prev.map(entry => (entry.id === entryId ? { ...entry, ...patch } : entry)))
    }

    async function handleChooseEntryPath(entryId: string): Promise<void> {
        const entry = preloadEntries.find(item => item.id === entryId)
        if (!entry) return
        const isDirectory = entry.mode === PreloadSourceMode.Directory
        const selected = await open({
            directory: isDirectory,
            multiple: false,
            title: isDirectory ? '选择 Meta 预加载目录' : '选择 Meta 预加载 JSON',
            filters: isDirectory ? undefined : [{ name: 'JSON', extensions: ['json'] }],
        })
        if (typeof selected === 'string' && selected) {
            handleUpdateEntry(entryId, { path: selected })
        }
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink">
            <header data-tauri-drag-region="true" className="flex h-10 shrink-0 items-center justify-between bg-panel text-ink-soft">
                <span className="px-4 text-sm font-medium text-ink-soft">{SETTINGS_TITLE}</span>
                <div className="flex h-full pr-1">
                    <WindowControls />
                </div>
            </header>
            <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-ink-muted">{THEME_SECTION_TITLE}</h2>
                    <div className="max-w-xs">
                        <Select value={theme} options={THEME_SELECT_OPTIONS} onChange={setTheme} aria-label={THEME_SECTION_TITLE} />
                    </div>
                </section>
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-ink-muted">{LANGUAGE_SECTION_TITLE}</h2>
                    <div className="max-w-xs">
                        <Select value={language} options={LANGUAGE_SELECT_OPTIONS} onChange={setLanguage} aria-label={LANGUAGE_SECTION_TITLE} />
                    </div>
                </section>
                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-ink-muted">{PRELOAD_SECTION_TITLE}</h2>
                        <button
                            type="button"
                            onClick={handleAddEntry}
                            title={ADD_TEXT}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-base font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                        >
                            {ADD_TEXT}
                        </button>
                    </div>
                    <table className="w-full min-w-0 border-collapse text-left text-xs">
                        <thead>
                            <tr className="border-b border-line-strong text-ink-subtle">
                                <th className="w-32 pb-2 pr-2 font-medium">{MODE_HEADER}</th>
                                <th className="pb-2 pr-2 font-medium">{PATH_HEADER}</th>
                                <th className="w-32 pb-2 text-right font-medium">{ACTION_HEADER}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preloadEntries.map(entry => (
                                <tr key={entry.id} className="border-b border-line">
                                    <td className="py-1.5 pr-2">
                                        <Select
                                            value={entry.mode}
                                            options={PRELOAD_MODE_SELECT_OPTIONS}
                                            onChange={mode => handleUpdateEntry(entry.id, { mode })}
                                            aria-label={MODE_HEADER}
                                        />
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        <input
                                            type="text"
                                            value={entry.path}
                                            onChange={event => handleUpdateEntry(entry.id, { path: event.target.value })}
                                            placeholder={DEFAULT_PRELOAD_PATH}
                                            className="w-full min-w-0 rounded-md border border-line bg-raised px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                                        />
                                    </td>
                                    <td className="py-1.5 text-right">
                                        <button
                                            type="button"
                                            onClick={() => void handleChooseEntryPath(entry.id)}
                                            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                                        >
                                            {CHOOSE_PATH_TEXT}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEntry(entry.id)}
                                            className="ml-1 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-danger hover:text-white"
                                        >
                                            {REMOVE_TEXT}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </main>
            <footer className="flex shrink-0 items-center justify-end border-t border-line bg-panel p-3">
                <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus:outline-none"
                >
                    {SAVE_TEXT}
                </button>
            </footer>
            <Tip open={tip !== null} message={tip?.message ?? ''} tone={tip?.tone} onHide={() => setTip(null)} />
        </div>
    )
}
