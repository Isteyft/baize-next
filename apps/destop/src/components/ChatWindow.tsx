import { useEffect, useRef, useState } from 'react'

import { chatCompletionStream, type ChatMessage } from '../ai'
import { type AiModelConfig, getSavedAiModels } from '../aiModels'
import {
    type ChatSession,
    type ChatSessionMessage,
    createChatSession,
    DEFAULT_SESSION_TITLE,
    deleteChatSession,
    deriveSessionTitle,
    readChatSessions,
    writeChatSession,
} from '../chatSession'
import { resolveChatDir } from '../chatSettings'
import { appendErrorLog } from '../errorLog'
import { subscribeTheme } from '../theme'
import { ChatSidebar } from './ChatSidebar'
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

/** 将持久化的会话消息转换为展示消息（补齐 id）。 */
function toDisplayMessages(session: ChatSession | null): DisplayMessage[] {
    if (!session) return []
    return session.messages.map(message => ({ ...message, id: createMessageId() }))
}

export function ChatWindow() {
    const [models] = useState<AiModelConfig[]>(getSavedAiModels)
    const [modelId, setModelId] = useState<string>('')
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentId, setCurrentId] = useState<string | null>(null)
    const [messages, setMessages] = useState<DisplayMessage[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const chatDirRef = useRef<string>('')

    const currentModel = models.find(item => item.id === modelId) ?? null
    const modelOptions: SelectOption<string>[] = models.map(item => ({ value: item.id, label: item.name }))
    const currentSession = sessions.find(item => item.id === currentId) ?? null

    // 启动时加载会话目录与历史会话。
    useEffect(() => {
        void (async () => {
            const dir = await resolveChatDir()
            chatDirRef.current = dir
            const loaded = await readChatSessions(dir)
            setSessions(loaded)
            if (loaded.length > 0) {
                setCurrentId(loaded[0].id)
                setMessages(toDisplayMessages(loaded[0]))
            }
        })()
    }, [])

    // 订阅主题变更，跨窗口切换主题时实时生效（applyTheme 在 subscribeTheme 内部更新 data-theme）。
    useEffect(() => {
        return subscribeTheme(() => {
            // 主题色由 data-theme + CSS 变量驱动，applyTheme 已更新 DOM，此处无需额外状态。
        })
    }, [])

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

    /** 将当前展示消息落盘到当前会话，并同步更新侧边栏标题。 */
    function persistCurrentSession(nextMessages: DisplayMessage[]): void {
        if (!currentId) return
        const persisted: ChatSessionMessage[] = nextMessages
            .filter((item): item is DisplayMessage => item.role === 'user' || item.role === 'assistant')
            .map(item => ({ role: item.role as 'user' | 'assistant', content: item.content }))
        const now = Date.now()
        const title =
            nextMessages.length > 0 && (currentSession?.messages.length ?? 0) === 0
                ? deriveSessionTitle(persisted)
                : currentSession?.title || DEFAULT_SESSION_TITLE
        const updated: ChatSession = {
            id: currentId,
            title,
            createdAt: currentSession?.createdAt ?? now,
            updatedAt: now,
            messages: persisted,
        }
        setSessions(previous => {
            const next = previous.map(item => (item.id === currentId ? updated : item))
            next.sort((a, b) => b.updatedAt - a.updatedAt)
            return next
        })
        void writeChatSession(chatDirRef.current, updated)
    }

    async function handleSend(): Promise<void> {
        const text = input.trim()
        if (!text || !currentModel || streaming) return

        if (!currentId) {
            const fresh = createChatSession()
            setCurrentId(fresh.id)
            setSessions(previous => [fresh, ...previous])
        }

        const userMessage: DisplayMessage = { id: createMessageId(), role: 'user', content: text }
        const assistantId = createMessageId()
        const next: DisplayMessage[] = [...messages, userMessage, { id: assistantId, role: 'assistant', content: '', pending: true }]
        setMessages(next)
        setInput('')
        setStreaming(true)
        persistCurrentSession(next)

        const history = messages.filter(item => item.role === 'user' || item.role === 'assistant')
        const abort = new AbortController()
        abortRef.current = abort

        let accumulated = ''
        try {
            await chatCompletionStream(currentModel, [{ role: 'system', content: SYSTEM_PROMPT }, ...history, userMessage], {
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

        // 流式结束后，用最终内容落盘一次。
        setMessages(previous => {
            const finalMessages = previous.map(item =>
                item.id === assistantId && !item.error ? { ...item, content: accumulated || '（无回复）', pending: false } : item
            )
            persistCurrentSession(finalMessages)
            return finalMessages
        })
    }

    function handleStop(): void {
        abortRef.current?.abort()
        setStreaming(false)
    }

    async function handleRetry(messageId: string): Promise<void> {
        const index = messages.findIndex(item => item.id === messageId)
        if (index < 0 || !currentModel) return
        const before = messages.slice(0, index).filter(item => item.role === 'user' || item.role === 'assistant')
        const next: DisplayMessage[] = messages
            .slice(0, index)
            .concat({ id: messageId, role: 'assistant', content: '', pending: true } as DisplayMessage)
        setMessages(next)
        setStreaming(true)

        let accumulated = ''
        try {
            await chatCompletionStream(currentModel, [{ role: 'system', content: SYSTEM_PROMPT }, ...before], {
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

        setMessages(previous => {
            const finalMessages = previous.map(item =>
                item.id === messageId && !item.error ? { ...item, content: accumulated || '（无回复）', pending: false } : item
            )
            persistCurrentSession(finalMessages)
            return finalMessages
        })
    }

    function handleSelectSession(id: string): void {
        const session = sessions.find(item => item.id === id)
        if (!session) return
        setCurrentId(id)
        setMessages(toDisplayMessages(session))
    }

    function handleNewSession(): void {
        const fresh = createChatSession()
        setSessions(previous => [fresh, ...previous])
        setCurrentId(fresh.id)
        setMessages([])
        setInput('')
    }

    async function handleDeleteSession(id: string): Promise<void> {
        const isCurrent = id === currentId
        const remaining = sessions.filter(item => item.id !== id)
        setSessions(remaining)
        void deleteChatSession(chatDirRef.current, id)
        if (isCurrent) {
            if (remaining.length > 0) {
                setCurrentId(remaining[0].id)
                setMessages(toDisplayMessages(remaining[0]))
            } else {
                setCurrentId(null)
                setMessages([])
            }
        }
    }

    function handleRenameSession(id: string, title: string): void {
        setSessions(previous => previous.map(item => (item.id === id ? { ...item, title, updatedAt: Date.now() } : item)))
        const session = sessions.find(item => item.id === id)
        if (session) {
            void writeChatSession(chatDirRef.current, { ...session, title, updatedAt: Date.now() })
        }
    }

    return (
        <div className="flex h-full select-none bg-base text-ink">
            <ChatSidebar
                sessions={sessions}
                currentId={currentId}
                collapsed={collapsed}
                onSelect={handleSelectSession}
                onNew={handleNewSession}
                onDelete={id => void handleDeleteSession(id)}
                onRename={handleRenameSession}
                onToggle={() => setCollapsed(value => !value)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
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
        </div>
    )
}
