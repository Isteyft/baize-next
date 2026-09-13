import { useEffect, useState } from 'react'

import type { JsonRecord, JsonValue } from '../types/json'
import { formatRecordJson, isRecordObject } from '../utils/json'

/**
 * 右侧编辑面板：展示并允许编辑当前选中的 JSON 记录。
 * 输入合法时实时更新数据，非法时展示错误信息。
 */
interface JsonEditorProps {
    /** 当前选中的记录，未选中时为 null。 */
    record: JsonRecord | null
    /** 编辑结果回调：当 JSON 合法时传入更新后的数据。 */
    onUpdate: (key: string, data: Record<string, JsonValue>) => void
}

export function JsonEditor({ record, onUpdate }: JsonEditorProps) {
    const [text, setText] = useState('')
    const [error, setError] = useState<string | null>(null)

    // 当切换选中记录时同步编辑器内容。
    useEffect(() => {
        if (record) {
            setText(formatRecordJson(record.data))
            setError(null)
        } else {
            setText('')
            setError(null)
        }
    }, [record])

    /**
     * 处理编辑器内容变化：尝试解析并校验对象，随后回调更新。
     */
    function handleChange(value: string): void {
        setText(value)
        if (!record) return

        try {
            const parsed: unknown = JSON.parse(value)
            if (!isRecordObject(parsed)) {
                throw new Error('期望 JSON 顶层为对象')
            }
            setError(null)
            onUpdate(record.key, parsed)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'JSON 格式错误')
        }
    }

    return (
        <section className="flex w-96 shrink-0 flex-col overflow-hidden border-l border-gray-800 bg-gray-900">
            <div className="shrink-0 border-b border-gray-800 px-3 py-2">
                <h2 className="text-sm font-medium text-gray-300">JSON 编辑器</h2>
                {record && <p className="mt-0.5 truncate text-xs text-gray-500">当前记录：{record.key}</p>}
            </div>
            {record ? (
                <>
                    <textarea
                        value={text}
                        onChange={event => handleChange(event.target.value)}
                        spellCheck={false}
                        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-gray-200 focus:outline-none"
                    />
                    {error && <div className="shrink-0 border-t border-red-800 bg-red-950/60 p-2 text-xs text-red-300">{error}</div>}
                </>
            ) : (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-500">
                    在左侧选择 JSON，并在表格中选择一条记录后在此编辑
                </div>
            )}
        </section>
    )
}
