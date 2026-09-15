import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

import { WindowControls } from './WindowControls'

const ERROR_LOG_TITLE = '错误日志'
const REFRESH_TEXT = '刷新'
const EMPTY_TEXT = '暂无记录'

export function ErrorLogWindow() {
    const [log, setLog] = useState('')

    async function refresh(): Promise<void> {
        try {
            setLog(await invoke<string>('read_error_log'))
        } catch {
            setLog('')
        }
    }

    useEffect(() => {
        void refresh()
        const timer = window.setInterval(() => void refresh(), 2000)
        return () => window.clearInterval(timer)
    }, [])

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink">
            <header data-tauri-drag-region="true" className="flex h-10 shrink-0 items-center justify-between bg-panel text-ink-soft">
                <span className="px-4 text-sm font-medium text-ink-soft">{ERROR_LOG_TITLE}</span>
                <div className="flex items-center pr-1">
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        className="mr-1 rounded-md px-3 py-1 text-xs text-ink-soft hover:bg-raised"
                    >
                        {REFRESH_TEXT}
                    </button>
                    <WindowControls />
                </div>
            </header>
            <main className="min-h-0 flex-1 overflow-hidden">
                {log ? (
                    <pre className="h-full overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-ink-muted">{log}</pre>
                ) : (
                    <p className="p-4 text-sm text-ink-subtle">{EMPTY_TEXT}</p>
                )}
            </main>
        </div>
    )
}
