import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'

/**
 * 自绘任务栏右侧的窗口控制按钮：最小化、最大化/还原、关闭。
 * 在非 Tauri 环境中调用会被安全忽略，避免纯 Web 预览时崩溃。
 */
export function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false)

    useEffect(() => {
        void checkMaximized()
        const unlistenPromise = getWindowApi()?.onResized?.(() => {
            void checkMaximized()
        })
        return () => {
            void unlistenPromise?.then(unlisten => unlisten())
        }
    }, [])

    /** 获取当前 Tauri 窗口实例，非 Tauri 环境返回 null。 */
    function getWindowApi() {
        try {
            return getCurrentWindow()
        } catch {
            return null
        }
    }

    /** 刷新当前窗口最大化状态。 */
    async function checkMaximized(): Promise<void> {
        const api = getWindowApi()
        if (!api) return
        try {
            setIsMaximized(await api.isMaximized())
        } catch {
            setIsMaximized(false)
        }
    }

    /** 最小化窗口。 */
    function handleMinimize(): void {
        void getWindowApi()?.minimize()
    }

    /** 最大化/还原窗口并刷新状态。 */
    function handleMaximize(): void {
        const api = getWindowApi()
        if (!api) return
        void api.toggleMaximize().then(() => checkMaximized())
    }

    /** 关闭窗口。 */
    function handleClose(): void {
        void getWindowApi()?.close()
    }

    return (
        <div className="flex h-full items-stretch">
            <button
                type="button"
                title="最小化"
                onClick={handleMinimize}
                className="w-11 text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
                    <rect x="0" y="5" width="12" height="1" />
                </svg>
            </button>
            <button
                type="button"
                title={isMaximized ? '还原' : '最大化'}
                onClick={handleMaximize}
                className="w-11 text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none"
            >
                {isMaximized ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect x="1.5" y="1.5" width="7" height="7" />
                        <path d="M3.5 3.5V1.5h7v7h-2" />
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect x="1.5" y="1.5" width="9" height="9" />
                    </svg>
                )}
            </button>
            <button
                type="button"
                title="关闭"
                onClick={handleClose}
                className="w-11 text-gray-300 transition-colors hover:bg-red-600 hover:text-white focus:outline-none"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
            </button>
        </div>
    )
}
