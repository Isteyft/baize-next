import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

/**
 通用滚动区域组件。
 轨道常驻并预留独立空间，滑块尺寸与位移通过 requestAnimationFrame
 直接驱动 DOM 更新，滚动时不触发每帧 React 重渲染，保持丝滑。
 */
interface ScrollAreaProps {
    /** 滚动区域内的内容。 */
    children: ReactNode
    /** 外容器 className。 */
    className?: string
    /** 视口 className。 */
    viewportClassName?: string
}

const TRACK_CLASS = 'shrink-0 border-line-strong transition-colors'
const HANDLE_CLASS =
    'will-change-transform rounded-full bg-accent shadow-md ring-1 ring-accent-ring transition-colors hover:bg-accent-hover active:bg-accent-active cursor-pointer'

interface ThumbGeometry {
    vSize: number
    hSize: number
    vScrollable: boolean
    hScrollable: boolean
}

export function ScrollArea({ children, className = '', viewportClassName = '' }: ScrollAreaProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const vTrackRef = useRef<HTMLDivElement>(null)
    const hTrackRef = useRef<HTMLDivElement>(null)
    const vThumbRef = useRef<HTMLDivElement>(null)
    const hThumbRef = useRef<HTMLDivElement>(null)
    const geometryRef = useRef({ vTrackH: 0, hTrackW: 0, vMax: 0, hMax: 0, vSize: 0, hSize: 0 })
    const rafRef = useRef<number | null>(null)
    const [thumbs, setThumbs] = useState<ThumbGeometry>({ vSize: 0, hSize: 0, vScrollable: false, hScrollable: false })

    /** 将当前滚动位置映射为两个滑块的 translate，直接刷新滑块 DOM，避免逐帧重渲染。 */
    const applyOffsets = useCallback(() => {
        const viewport = viewportRef.current
        const vThumbEl = vThumbRef.current
        const hThumbEl = hThumbRef.current
        const g = geometryRef.current
        if (!viewport || !vThumbEl || !hThumbEl) return

        if (g.vMax > 0 && g.vSize > 0) {
            const offset = (viewport.scrollTop / g.vMax) * (g.vTrackH - g.vSize)
            vThumbEl.style.transform = `translateY(${Math.max(0, offset)}px)`
        }
        if (g.hMax > 0 && g.hSize > 0) {
            const offset = (viewport.scrollLeft / g.hMax) * (g.hTrackW - g.hSize)
            hThumbEl.style.transform = `translateX(${Math.max(0, offset)}px)`
        }
    }, [])

    /** 测量视口与轨道，刷新滑块尺寸/可见性，并立即对齐滑块位置。 */
    const refreshScrollUI = useCallback(() => {
        const viewport = viewportRef.current
        const vTrack = vTrackRef.current
        const hTrack = hTrackRef.current
        if (!viewport || !vTrack || !hTrack) return

        const vMax = viewport.scrollHeight - viewport.clientHeight
        const hMax = viewport.scrollWidth - viewport.clientWidth
        const vTrackH = vTrack.clientHeight
        const hTrackW = hTrack.clientWidth
        const vSize = vMax > 0 ? Math.max(24, Math.min(vTrackH, vTrackH * (viewport.clientHeight / viewport.scrollHeight))) : 0
        const hSize = hMax > 0 ? Math.max(24, Math.min(hTrackW, hTrackW * (viewport.clientWidth / viewport.scrollWidth))) : 0

        geometryRef.current = { vTrackH, hTrackW, vMax, hMax, vSize, hSize }

        setThumbs(prev => {
            const next = { vSize: Math.round(vSize), hSize: Math.round(hSize), vScrollable: vMax > 0, hScrollable: hMax > 0 }
            if (
                prev.vSize === next.vSize &&
                prev.hSize === next.hSize &&
                prev.vScrollable === next.vScrollable &&
                prev.hScrollable === next.hScrollable
            ) {
                return prev
            }
            return next
        })

        applyOffsets()
    }, [applyOffsets])

    /** 将滚动/尺寸变化合并到同一帧再测量与对齐。 */
    const scheduleRefresh = useCallback(() => {
        if (rafRef.current != null) return
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            refreshScrollUI()
        })
    }, [refreshScrollUI])

    useEffect(() => {
        scheduleRefresh()
        const viewport = viewportRef.current
        if (!viewport) return
        const observer = new ResizeObserver(() => scheduleRefresh())
        observer.observe(viewport)
        const child = viewport.firstElementChild
        if (child) observer.observe(child)
        window.addEventListener('resize', scheduleRefresh)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', scheduleRefresh)
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
        }
    }, [scheduleRefresh, children])

    /** 记录纵向拖动起始位置，拖动时实时刷新滚动与滑块。 */
    function startVDrag(event: ReactPointerEvent<HTMLDivElement>): void {
        event.preventDefault()
        const viewport = viewportRef.current
        const track = vTrackRef.current
        const thumb = vThumbRef.current
        if (!viewport || !track || !thumb) return
        const startY = event.clientY
        const startTop = viewport.scrollTop
        const max = viewport.scrollHeight - viewport.clientHeight
        const maxTravel = track.clientHeight - thumb.offsetHeight
        const move = (moveEvent: PointerEvent) => {
            const delta = moveEvent.clientY - startY
            const next = startTop + (maxTravel > 0 ? (delta * max) / maxTravel : 0)
            viewport.scrollTop = Math.min(max, Math.max(0, next))
            applyOffsets()
        }
        const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
    }

    /** 记录横向拖动起始位置，拖动时实时刷新滚动与滑块。 */
    function startHDrag(event: ReactPointerEvent<HTMLDivElement>): void {
        event.preventDefault()
        const viewport = viewportRef.current
        const track = hTrackRef.current
        const thumb = hThumbRef.current
        if (!viewport || !track || !thumb) return
        const startX = event.clientX
        const startLeft = viewport.scrollLeft
        const max = viewport.scrollWidth - viewport.clientWidth
        const maxTravel = track.clientWidth - thumb.offsetWidth
        const move = (moveEvent: PointerEvent) => {
            const delta = moveEvent.clientX - startX
            const next = startLeft + (maxTravel > 0 ? (delta * max) / maxTravel : 0)
            viewport.scrollLeft = Math.min(max, Math.max(0, next))
            applyOffsets()
        }
        const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
    }

    return (
        <div className={`flex h-full min-h-0 ${className}`}>
            {/* 内容区 + 横向轨道 */}
            <div className="flex min-w-0 flex-1 flex-col">
                <div
                    ref={viewportRef}
                    onScroll={scheduleRefresh}
                    className={`min-h-0 flex-1 overflow-scroll scrollbar-none ${viewportClassName}`}
                >
                    {children}
                </div>
                <div
                    ref={hTrackRef}
                    className={`${TRACK_CLASS} flex h-2.5 items-center border-t px-1 ${thumbs.hScrollable ? 'bg-raised' : 'bg-panel'}`}
                >
                    <div
                        ref={hThumbRef}
                        onPointerDown={startHDrag}
                        style={{ width: `${thumbs.hSize}px` }}
                        className={`${HANDLE_CLASS} h-1.5 ${thumbs.hScrollable ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    />
                </div>
            </div>
            {/* 纵向轨道 */}
            <div
                ref={vTrackRef}
                className={`${TRACK_CLASS} flex w-2.5 flex-col items-center border-l py-1 ${thumbs.vScrollable ? 'bg-raised' : 'bg-panel'}`}
            >
                <div
                    ref={vThumbRef}
                    onPointerDown={startVDrag}
                    style={{ height: `${thumbs.vSize}px` }}
                    className={`${HANDLE_CLASS} w-1.5 ${thumbs.vScrollable ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                />
            </div>
        </div>
    )
}
