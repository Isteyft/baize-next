/**
 * 设置窗口独立页面。
 * 当前仅保留占位内容，设置项待后续版本实现。
 */
export function SettingsWindow() {
    return (
        <div className="flex h-full select-none flex-col bg-gray-950 text-gray-100">
            <header className="flex h-10 shrink-0 items-center border-b border-gray-800 bg-gray-900 px-4">
                <h1 className="text-sm font-medium text-gray-200">设置</h1>
            </header>
            <main className="flex min-h-0 flex-1 items-center justify-center">
                <p className="px-6 text-center text-sm text-gray-500">设置功能 TODO，待后续版本实现</p>
            </main>
        </div>
    )
}
