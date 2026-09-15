import { useEffect, useRef, useState } from 'react'

export interface SelectOption<Value extends string> {
    /** 选项值。 */
    value: Value
    /** 选项显示文本。 */
    label: string
}

interface SelectProps<Value extends string> {
    /** 当前选中值。 */
    value: Value
    /** 可选项列表。 */
    options: SelectOption<Value>[]
    /** 选中变化回调。 */
    onChange: (value: Value) => void
    /** 未选择时占位文本。 */
    placeholder?: string
    /** 无障碍标签。 */
    'aria-label'?: string
    /** 宽度类等附加样式。 */
    className?: string
}

/**
 * 通用受控下拉框组件。
 * 提供单选下拉交互，点击外部或按 Esc 关闭。
 */
export function Select<Value extends string>({
    value,
    options,
    onChange,
    placeholder = '请选择',
    'aria-label': ariaLabel,
    className = '',
}: SelectProps<Value>) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const selected = options.find(option => option.value === value)

    // 点击外部或 Esc 关闭。
    useEffect(() => {
        if (!open) return
        function handleDocumentClick(event: MouseEvent): void {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        function handleDocumentKeydown(event: KeyboardEvent): void {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', handleDocumentClick)
        document.addEventListener('keydown', handleDocumentKeydown)
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick)
            document.removeEventListener('keydown', handleDocumentKeydown)
        }
    }, [open])

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                aria-label={ariaLabel}
                onClick={() => setOpen(value => !value)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hover focus:outline-none"
            >
                <span className={selected ? 'text-ink' : 'text-ink-subtle'}>{selected ? selected.label : placeholder}</span>
                <span aria-hidden="true" className={`origin-center text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>
            {open && (
                <ul className="absolute left-0 z-50 mt-1 w-full overflow-hidden rounded-md border border-line-strong bg-raised py-1 shadow-lg">
                    {options.map(option => {
                        const active = option.value === value
                        return (
                            <li key={option.value}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value)
                                        setOpen(false)
                                    }}
                                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                                        active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-hover'
                                    }`}
                                >
                                    {active && <span aria-hidden="true">✓</span>}
                                    {option.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
