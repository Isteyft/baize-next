import { useCallback, useRef } from 'react'

interface ResizerProps {
    /** 拖动时回调 pointer 位移增量（逻辑像素，向右为正）。由调用方决定如何应用到目标栏宽度。 */
    onResize: (delta: number) => void
}

/**
 * 可拖拽的纵向分隔条：夹在左右两栏之间，拖动时回调水平位移增量。
 * 位移增量（向右为正）由父组件自行累加到目标栏宽度上，边界限制也由父组件负责，
 * 避免在组件内捕获旧宽度导致 stale closure。
 */
export function Resizer({ onResize }: ResizerProps) {
    const startXRef = useRef<number | null>(null)

    const handlePointerMove = useCallback(
        (event: PointerEvent) => {
            if (startXRef.current === null) return
            const delta = event.clientX - startXRef.current
            startXRef.current = event.clientX
            onResize(delta)
        },
        [onResize]
    )

    const handlePointerUp = useCallback(() => {
        startXRef.current = null
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [handlePointerMove])

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
        event.preventDefault()
        startXRef.current = event.clientX
        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整栏宽"
            className="relative z-10 flex w-1 shrink-0 cursor-col-resize items-stretch bg-line transition-colors hover:bg-accent"
            onPointerDown={handlePointerDown}
        >
            {/* 增大可点击热区 */}
            <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
    )
}
