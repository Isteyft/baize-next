import { type ReactNode, useEffect, useRef, useState } from 'react'

/**
 * 菜单按钮 + 下拉菜单组件。
 * 用于文件、关于等左侧任务栏按钮；点击后在下方位弹出菜单。
 */
interface MenuDropdownProps {
    /** 菜单按钮显示文本。 */
    label: string
    /** 下拉菜单内容。 */
    children: ReactNode
}

export function MenuDropdown({ label, children }: MenuDropdownProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    // 点击外部时关闭菜单。
    useEffect(() => {
        if (!open) return
        function handleDocumentClick(event: MouseEvent): void {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleDocumentClick)
        return () => document.removeEventListener('mousedown', handleDocumentClick)
    }, [open])

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="h-full px-3 text-sm text-ink-soft transition-colors hover:bg-hover focus:outline-none"
            >
                {label}
            </button>
            {open && (
                <div
                    className="absolute left-0 top-full z-50 min-w-40 rounded-md border border-line-strong bg-raised py-1 shadow-lg"
                    onClick={() => setOpen(false)}
                >
                    {children}
                </div>
            )}
        </div>
    )
}
