import { useEffect } from 'react'

export type TipTone = 'success' | 'error' | 'info'

interface TipProps {
    open: boolean
    message: string
    tone?: TipTone
    duration?: number
    onHide?: () => void
}

const TONE_CLASSES: Record<TipTone, string> = {
    success: 'border-accent bg-accent-soft text-ink-soft',
    error: 'border-danger bg-danger/10 text-danger',
    info: 'border-line-strong bg-panel text-ink-soft',
}

export function Tip({ open, message, tone = 'success', duration = 2400, onHide }: TipProps) {
    useEffect(() => {
        if (!open) return
        const timer = window.setTimeout(() => onHide?.(), duration)
        return () => window.clearTimeout(timer)
    }, [open, message, tone, duration, onHide])

    if (!open) return null

    return (
        <div role="status" aria-live="polite" className="pointer-events-none fixed left-1/2 top-14 z-50 -translate-x-1/2">
            <div className={`max-w-xs rounded-md border px-4 py-2 text-xs shadow-xl ${TONE_CLASSES[tone]}`}>{message}</div>
        </div>
    )
}
