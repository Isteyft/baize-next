import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const CONTEXT_MENU_PADDING = 8

export interface ContextMenuPlacementInput {
    x: number
    y: number
    menuWidth: number
    menuHeight: number
    viewportWidth: number
    viewportHeight: number
    padding?: number
}

export interface ContextMenuPosition {
    left: number
    top: number
    maxHeight?: number
}

/** Calculate context menu placement, flip upward and cap height when it would overflow viewport edges. */
export function resolveContextMenuPlacement({
    x,
    y,
    menuWidth,
    menuHeight,
    viewportWidth,
    viewportHeight,
    padding = CONTEXT_MENU_PADDING,
}: ContextMenuPlacementInput): ContextMenuPosition {
    const safe = Math.max(0, padding)
    const maxAllowedHeight = Math.max(safe * 2, viewportHeight - safe * 2)
    const maxHeight = menuHeight > maxAllowedHeight ? Math.floor(maxAllowedHeight) : undefined
    const effectiveHeight = maxHeight ?? menuHeight

    const left = x + menuWidth + safe <= viewportWidth ? x : Math.max(safe, viewportWidth - menuWidth - safe)
    const maxBottom = Math.min(y, viewportHeight - safe)
    const top = y + effectiveHeight + safe <= viewportHeight ? y : Math.max(safe, maxBottom - effectiveHeight)

    return { left, top, maxHeight }
}

interface ContextMenuProps {
    x: number
    y: number
    onClose: () => void
    children: ReactNode
    className?: string
}

/** Reusable context menu: measures its height, flips upward near viewport edges, and closes on resize/scroll. */
export function ContextMenu({ x, y, onClose, children, className }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<ContextMenuPosition>({ left: x, top: y })

    useLayoutEffect(() => {
        const menu = menuRef.current
        if (!menu) return
        const rect = menu.getBoundingClientRect()
        setPosition(
            resolveContextMenuPlacement({
                x,
                y,
                menuWidth: rect.width,
                menuHeight: rect.height,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            })
        )
    }, [x, y])

    useEffect(() => {
        function handleScroll(event: Event): void {
            if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return
            onClose()
        }
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('resize', onClose)
        window.addEventListener('scroll', handleScroll, true)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('resize', onClose)
            window.removeEventListener('scroll', handleScroll, true)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    const menuStyle: CSSProperties = { left: position.left, top: position.top }
    if (position.maxHeight !== undefined) menuStyle.maxHeight = position.maxHeight

    return (
        <>
            <div
                className="fixed inset-0 z-[90]"
                onMouseDown={onClose}
                onContextMenu={event => {
                    event.preventDefault()
                    onClose()
                }}
            />
            <div
                ref={menuRef}
                role="menu"
                style={menuStyle}
                className={`fixed z-[91] min-w-32 overflow-y-auto rounded-md border border-line-strong bg-raised py-1 shadow-xl ${className ?? ''}`}
                onContextMenu={event => event.preventDefault()}
            >
                {children}
            </div>
        </>
    )
}
