interface StartupLoadingProps {
    status: 'loading' | 'error'
    path: string
    modeLabel: string
    message?: string
    onRetry?: () => void
    onContinue?: () => void
    onOpenSettings?: () => void
}

const LOADING_TEXT = '正在加载位于预设路径的 JSON'
const FAILED_TEXT = '预加载 JSON 失败'
const RETRY_TEXT = '重试'
const CONTINUE_TEXT = '继续进入'
const SETTINGS_TEXT = '设置'

export function StartupLoading({ status, path, modeLabel, message, onRetry, onContinue, onOpenSettings }: StartupLoadingProps) {
    const isError = status === 'error'
    return (
        <div className="flex h-full select-none items-center justify-center bg-base text-ink">
            <div className="w-full max-w-md rounded-md border border-line bg-panel p-6 text-center">
                <div
                    className={`mx-auto mb-4 h-12 w-12 rounded-full border-2 ${isError ? 'border-danger' : 'border-accent border-t-transparent'} ${isError ? '' : 'animate-spin'}`}
                />
                <p className="text-sm font-medium text-ink-soft">{isError ? FAILED_TEXT : LOADING_TEXT}</p>
                <p className="mt-2 truncate font-mono text-xs text-ink-muted">{modeLabel}</p>
                <p className="mt-1 truncate font-mono text-xs text-ink-subtle">{path}</p>
                {isError && message ? <p className="mt-3 whitespace-pre-line break-words text-xs text-danger">{message}</p> : null}
                <div className="mt-5 flex items-center justify-center gap-2">
                    {isError && onContinue ? (
                        <button
                            type="button"
                            onClick={onContinue}
                            className="rounded-md bg-panel px-3 py-1.5 text-xs text-ink-soft hover:bg-raised"
                        >
                            {CONTINUE_TEXT}
                        </button>
                    ) : null}
                    {onRetry ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-hover"
                        >
                            {RETRY_TEXT}
                        </button>
                    ) : null}
                    {onOpenSettings ? (
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="rounded-md px-3 py-1.5 text-xs text-ink-soft hover:bg-raised"
                        >
                            {SETTINGS_TEXT}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
