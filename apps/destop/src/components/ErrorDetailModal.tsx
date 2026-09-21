interface ErrorDetailModalProps {
    open: boolean
    message: string
    onClose: () => void
}

/** 项目加载失败详情弹窗：完整展示出错文件名、所属项目与行列号错误原因，超长内容区域纵向滚动。 */
export function ErrorDetailModal({ open, message, onClose }: ErrorDetailModalProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"
            onMouseDown={event => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="加载失败"
                className="flex max-h-[78vh] w-[min(640px,calc(100vw-32px))] flex-col overflow-hidden rounded-md border border-line-strong bg-base shadow-2xl"
            >
                <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3">
                    <h2 className="min-w-0 truncate text-sm font-medium text-ink-soft">加载失败</h2>
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={onClose}
                        className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                    >
                        X
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-4">
                    <p className="whitespace-pre-line break-words font-mono text-xs leading-relaxed text-ink">{message}</p>
                </div>
            </div>
        </div>
    )
}
