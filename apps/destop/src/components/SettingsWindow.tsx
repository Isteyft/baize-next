import type { AppLanguage, ThemeColor } from '@baize-next/types'
import { useEffect, useState } from 'react'

import { getSavedLanguage, LANGUAGE_OPTIONS, setLanguage as persistLanguage, subscribeLanguage } from '../language'
import { getSavedTheme, setTheme as persistTheme, subscribeTheme, THEME_OPTIONS } from '../theme'
import { Select, type SelectOption } from './Select'
import { WindowControls } from './WindowControls'

/** 主题下拉框选项。 */
const THEME_SELECT_OPTIONS: SelectOption<ThemeColor>[] = THEME_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
}))

const LANGUAGE_SELECT_OPTIONS: SelectOption<AppLanguage>[] = LANGUAGE_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
}))

/**
 * 设置窗口独立页面。
 * 提供主题外观设置：通过下拉框选择后点击“保存”生效并同步到主窗口。
 * 顶部为自绘拖拽栏，提供最小化/最大化/关闭按钮（与主窗口一致）。
 */
export function SettingsWindow() {
    const [theme, setTheme] = useState<ThemeColor>(getSavedTheme)
    const [language, setLanguage] = useState<AppLanguage>(getSavedLanguage)

    // 跨窗口同步主题：主窗口切换主题时，设置窗口实时跟随并保持选中态。
    useEffect(() => {
        return subscribeTheme(next => {
            setTheme(next)
        })
    }, [])

    // 跨窗口同步语言：主窗口切换语言时，设置窗口实时跟随并保持选中态。
    useEffect(() => {
        return subscribeLanguage(next => {
            setLanguage(next)
        })
    }, [])

    /** 保存当前选择：应用、持久化并向主窗口广播。 */
    function handleSave(): void {
        persistTheme(theme)
        persistLanguage(language)
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink">
            <header
                data-tauri-drag-region="true"
                className="flex h-10 shrink-0 select-none items-center justify-between bg-panel text-ink-soft"
            >
                <span className="px-4 text-sm font-medium text-ink-soft">设置</span>
                <div className="flex h-full pr-1">
                    <WindowControls />
                </div>
            </header>
            <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus:outline-none"
                    >
                        保存
                    </button>
                </div>
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-ink-muted">主题外观</h2>
                    <div className="max-w-xs">
                        <Select value={theme} options={THEME_SELECT_OPTIONS} onChange={setTheme} aria-label="主题外观" />
                    </div>
                </section>
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-ink-muted">界面语言</h2>
                    <div className="max-w-xs">
                        <Select value={language} options={LANGUAGE_SELECT_OPTIONS} onChange={setLanguage} aria-label="界面语言" />
                    </div>
                </section>
            </main>
        </div>
    )
}
