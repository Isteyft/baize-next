import { useEffect, useRef, useState } from 'react'

import { chatCompletionStream, type ChatMessage } from '../ai'
import { type AiModelConfig, getSavedAiModels } from '../aiModels'
import { appendErrorLog } from '../errorLog'
import { Select, type SelectOption } from './Select'
import { WindowControls } from './WindowControls'

const CHAT_TITLE = 'AI 对话'
const MODEL_PLACEHOLDER = '请选择模型'
const EMPTY_MODEL_TEXT = '尚未配置模型，请先在「设置 → 大模型配置」中添加'
const INPUT_PLACEHOLDER = '输入消息…'
const SEND_TEXT = '发送'
const STOP_TEXT = '停止'
const RETRY_TEXT = '重试'
const EMPTY_HISTORY_TEXT = '开始一段新的对话吧'
const SYSTEM_PROMPT = '你是一个乐于助人的助手。'

interface DisplayMessage extends ChatMessage {
    id: string
    pending?: boolean
    error?: string
}

function createMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatWindow() {
    const [models] = useState<AiModelConfig[]>(getSavedAiModels)
    const [modelId, setModelId] = useState<string>('')
    const [messages, setMessages] = useState<DisplayMessage[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    const currentModel = models.find(item => item.id === modelId) ?? null
    const modelOptions: SelectOption<string>[] = models.map(item => ({ value: item.id, label: item.name }))

    // 默认选中第一个模型。
    useEffect(() => {
        if (!modelId && models.length > 0) {
            setModelId(models[0].id)
        }
    }, [modelId, models])

    // 新消息时滚动到底部。
    useEffect(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages])

    function replaceMessage(id: string, patch: Partial<DisplayMessage>): void {
        setMessages(previous => previous.map(item => (item.id === id ? { ...item, ...patch } : item)))
    }

    async function handleSend(): Promise<void> {
        const text = input.trim()
        if (!text || !currentModel || streaming) return

        const userMessage: DisplayMessage = { id: createMessageId(), role: 'user', content: text }
        const assistantId = createMessageId()
        setMessages(previous => [...previous, userMessage, { id: assistantId, role: 'assistant', content: '', pending: true }])
        setInput('')
        setStreaming(true)

        const history = [...messages, userMessage]
        const abort = new AbortController()
        abortRef.current = abort

        let accumulated = ''
        try {
            await chatCompletionStream(currentModel, [{ role: 'system', content: SYSTEM_PROMPT }, ...history.filter(item => !item.error)], {
                onDelta: delta => {
                    accumulated += delta
                    replaceMessage(assistantId, { content: accumulated, pending: false })
                },
                onDone: full => {
                    replaceMessage(assistantId, { content: full, pending: false })
                },
            })
            if (!accumulated) {
                replaceMessage(assistantId, { content: '（无回复）', pending: false })
            }
        } catch (error) {
            replaceMessage(assistantId, {
                pending: false,
                error: error instanceof Error ? error.message : '请求失败',
            })
            void appendErrorLog(`AI 对话（${currentModel.name}）`, error)
        } finally {
            setStreaming(false)
            abortRef.current = null
        }
    }

    function handleStop(): void {
        abortRef.current?.abort()
        setStreaming(false)
    }

    async function handleRetry(messageId: string): Promise<void> {
        const index = messages.findIndex(item => item.id === messageId)
        if (index < 0 || !currentModel) return
        const before = messages.slice(0, index).filter(item => item.role === 'user' || item.role === 'assistant')
        setMessages(previous => previous.slice(0, index).concat({ id: messageId, role: 'assistant', content: '', pending: true }))
        setStreaming(true)

        let accumulated = ''
        try {
            await chatCompletionStream(currentModel, [{ role: 'system', content: SYSTEM_PROMPT }, ...before.filter(item => !item.error)], {
                onDelta: delta => {
                    accumulated += delta
                    replaceMessage(messageId, { content: accumulated, pending: false })
                },
                onDone: full => {
                    replaceMessage(messageId, { content: full, pending: false })
                },
            })
            if (!accumulated) {
                replaceMessage(messageId, { content: '（无回复）', pending: false })
            }
        } catch (error) {
            replaceMessage(messageId, {
                pending: false,
                error: error instanceof Error ? error.message : '请求失败',
            })
            void appendErrorLog(`AI 对话（${currentModel.name}）`, error)
        } finally {
            setStreaming(false)
        }
    }

    return (
        <div className="flex h-full select-none flex-col bg-base text-ink">
            <header data-tauri-drag-region="true" className="flex h-10 shrink-0 items-center justify-between bg-panel text-ink-soft">
                <div className="flex h-full items-center">
                    <span className="px-4 text-sm font-medium text-ink-soft">{CHAT_TITLE}</span>
                    {models.length > 0 ? (
                        <div className="w-48">
                            <Select
                                value={modelId}
                                options={modelOptions}
                                onChange={setModelId}
                                placeholder={MODEL_PLACEHOLDER}
                                aria-label="选择模型"
                            />
                        </div>
                    ) : null}
                </div>
                <div className="flex h-full pr-1">
                    <WindowControls />
                </div>
            </header>

            <main ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                {models.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-ink-subtle">{EMPTY_MODEL_TEXT}</p>
                ) : messages.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-ink-subtle">{EMPTY_HISTORY_TEXT}</p>
                ) : (
                    <div className="mx-auto flex max-w-2xl flex-col gap-3">
                        {messages.map(message =>
                            message.role === 'user' ? (
                                <div key={message.id} className="flex justify-end">
                                    <div className="max-w-[80%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-ink">
                                        {message.content}
                                    </div>
                                </div>
                            ) : (
                                <div key={message.id} className="flex justify-start">
                                    <div className="max-w-[80%] rounded-lg bg-raised px-3 py-2 text-sm text-ink-soft">
                                        {message.pending && !message.content ? (
                                            <span className="text-ink-subtle">思考中…</span>
                                        ) : (
                                            <>
                                                {message.content ? (
                                                    <span className="whitespace-pre-wrap break-words">{message.content}</span>
                                                ) : null}
                                                {message.pending ? <span className="text-ink-subtle">…</span> : null}
                                            </>
                                        )}
                                        {message.error ? (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-danger">{message.error}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleRetry(message.id)}
                                                    className="rounded-md px-2 py-0.5 text-xs text-accent hover:bg-hover"
                                                >
                                                    {RETRY_TEXT}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </main>

            <footer className="flex shrink-0 items-end gap-2 border-t border-line bg-panel p-3">
                <textarea
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void handleSend()
                        }
                    }}
                    placeholder={INPUT_PLACEHOLDER}
                    disabled={!currentModel}
                    rows={2}
                    className="min-h-10 flex-1 resize-none rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none disabled:opacity-50"
                />
                {streaming ? (
                    <button
                        type="button"
                        onClick={handleStop}
                        className="h-10 rounded-md bg-danger px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
                    >
                        {STOP_TEXT}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!currentModel || !input.trim()}
                        className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {SEND_TEXT}
                    </button>
                )}
            </footer>
        </div>
    )
}
