import type { JsonDataset } from '@baize-next/types'
import { useEffect, useMemo, useRef, useState } from 'react'

import { chatCompletionStream, type ChatMessage } from '../ai'
import { AI_COMMANDS, type AiCommand, buildCommandContext, filterAiCommands } from '../aiCommands'
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
import type { SeidDrawerRecords } from '../utils/seid'
import { ChatSidebar } from './ChatSidebar'
import { Select, type SelectOption } from './Select'

const MODEL_PLACEHOLDER = '请选择模型'
const EMPTY_MODEL_TEXT = '尚未配置模型，请先在「设置 → 大模型配置」中添加'
const INPUT_PLACEHOLDER = '输入消息，输入 / 使用指令…'
const SEND_TEXT = '发送'
const STOP_TEXT = '停止'
const RETRY_TEXT = '重试'
const EMPTY_HISTORY_TEXT = '开始一段新的对话吧'
const COLLAPSE_TITLE = '收起侧边栏'
const SYSTEM_PROMPT = '你是一个乐于助人的助手。'
const COMMAND_TRIGGER = '/'
const COMMAND_NO_MATCH_TEXT = '没有匹配的指令'

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

interface ChatPanelProps {
    /** 面板宽度（逻辑像素），缺省使用默认宽度 360。 */
    width?: number
    /** 关闭（收起）聊天侧边栏，由父组件控制窗口宽度与显隐。 */
    onClose: () => void
    /** 已预加载的 meta 数据集，供指令注入字段枚举与 SeidMeta 上下文。 */
    metaDatasets?: JsonDataset[]
    /** Seid 属性引用解析用的记录抽屉。 */
    seidRecords?: SeidDrawerRecords
}

/** 内嵌在主窗口右侧的 AI 对话面板。 */
export function ChatPanel({ width = 360, onClose, metaDatasets = [], seidRecords }: ChatPanelProps) {
    const [models] = useState<AiModelConfig[]>(getSavedAiModels)
    const [modelId, setModelId] = useState<string>('')
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [currentId, setCurrentId] = useState<string | null>(null)
    const [messages, setMessages] = useState<DisplayMessage[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [commandOpen, setCommandOpen] = useState(false)
    const [commandQuery, setCommandQuery] = useState('')
    const [commandIndex, setCommandIndex] = useState(0)
    const [activeCommand, setActiveCommand] = useState<AiCommand | null>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const chatDirRef = useRef<string>('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const footerRef = useRef<HTMLElement>(null)

    const commandCandidates = useMemo(() => filterAiCommands(AI_COMMANDS, commandQuery), [commandQuery])

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

    // 订阅主题变更，跨窗口切换主题时实时生效。
    useEffect(() => {
        return subscribeTheme(() => {
            // 主题色由 data-theme + CSS 变量驱动。
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

    // 点击 footer 外部时关闭指令弹窗。
    useEffect(() => {
        if (!commandOpen) return
        const handlePointerDown = (event: MouseEvent): void => {
            if (footerRef.current && !footerRef.current.contains(event.target as Node)) {
                setCommandOpen(false)
            }
        }
        document.addEventListener('mousedown', handlePointerDown)
        return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [commandOpen])

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

    /** 组装发送给模型的 system 消息：基础提示 + 选中指令的 meta 上下文。 */
    function buildSystemMessages(): ChatMessage[] {
        const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
        if (activeCommand) {
            const context = buildCommandContext(activeCommand, metaDatasets, seidRecords)
            if (context) messages.push({ role: 'system', content: context })
        }
        return messages
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

        // 捕获并消费当前指令上下文，随后清除，回到普通对话。
        const systemMessages = buildSystemMessages()
        setActiveCommand(null)

        const history = messages.filter(item => item.role === 'user' || item.role === 'assistant')
        const abort = new AbortController()
        abortRef.current = abort

        let accumulated = ''
        try {
            await chatCompletionStream(currentModel, [...systemMessages, ...history, userMessage], {
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

    /** 选中一条指令：记录为 activeCommand 并关闭弹窗，指令以 chip 展示、不写入输入框文本。 */
    function handleSelectCommand(command: AiCommand): void {
        setActiveCommand(command)
        setCommandOpen(false)
        setCommandQuery('')
        setCommandIndex(0)
        // 若输入框内残留以 / 开头的指令标记，移除它，仅保留自然语言需求。
        const slashIndex = input.lastIndexOf(COMMAND_TRIGGER)
        if (slashIndex >= 0) {
            setInput(input.slice(0, slashIndex).trimEnd())
        }
        textareaRef.current?.focus()
    }

    /** 清除当前选中的指令。 */
    function handleClearCommand(): void {
        setActiveCommand(null)
    }

    /** 点击「选择指令」按钮打开指令弹窗（不带 / 前缀，展示全部指令）。 */
    function handleOpenCommandPicker(): void {
        setCommandQuery('')
        setCommandIndex(0)
        setCommandOpen(true)
    }

    /** 输入变化时更新内容，并判断是否触发 / 打开指令弹窗。 */
    function handleInputChange(value: string): void {
        setInput(value)
        const slashIndex = value.lastIndexOf(COMMAND_TRIGGER)
        if (slashIndex >= 0) {
            setCommandQuery(value.slice(slashIndex + 1))
            setCommandOpen(true)
            setCommandIndex(0)
        } else {
            setCommandOpen(false)
        }
    }

    /** 处理输入框键盘事件：指令弹窗打开时拦截上下键与 Enter/Esc。 */
    function handleInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
        if (commandOpen) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCommandIndex(index => Math.min(index + 1, commandCandidates.length - 1))
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCommandIndex(index => Math.max(index - 1, 0))
                return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
                const command = commandCandidates[commandIndex]
                if (command) {
                    event.preventDefault()
                    handleSelectCommand(command)
                }
                return
            }
            if (event.key === 'Escape') {
                setCommandOpen(false)
                return
            }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
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
        <div style={{ width }} className="flex h-full shrink-0 flex-col border-l border-line bg-base text-ink">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel pl-2 pr-1">
                <ChatSidebar
                    sessions={sessions}
                    currentId={currentId}
                    onSelect={handleSelectSession}
                    onNew={handleNewSession}
                    onDelete={id => void handleDeleteSession(id)}
                    onRename={handleRenameSession}
                />
                <button
                    type="button"
                    onClick={onClose}
                    title={COLLAPSE_TITLE}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 2L4 7l5 5" />
                    </svg>
                </button>
            </div>

            <main ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                {models.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-ink-subtle">{EMPTY_MODEL_TEXT}</p>
                ) : messages.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-ink-subtle">{EMPTY_HISTORY_TEXT}</p>
                ) : (
                    <div className="flex flex-col gap-3">
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

            <footer ref={footerRef} className="relative flex shrink-0 flex-col gap-2 border-t border-line bg-panel p-3">
                {commandOpen ? (
                    <div className="absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-lg border border-line-strong bg-raised shadow-xl">
                        <div className="max-h-64 overflow-y-auto py-1">
                            {commandCandidates.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-ink-subtle">{COMMAND_NO_MATCH_TEXT}</p>
                            ) : (
                                commandCandidates.map((command, index) => (
                                    <button
                                        key={command.id}
                                        type="button"
                                        onMouseEnter={() => setCommandIndex(index)}
                                        onClick={() => handleSelectCommand(command)}
                                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
                                            index === commandIndex ? 'bg-accent-soft' : 'hover:bg-hover'
                                        }`}
                                    >
                                        <span className="text-sm text-ink">/{command.keyword}</span>
                                        <span className="text-xs text-ink-subtle">{command.description}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : null}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={event => handleInputChange(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={INPUT_PLACEHOLDER}
                    disabled={!currentModel}
                    rows={4}
                    className="min-h-24 w-full resize-none rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        {activeCommand ? (
                            <span className="flex max-w-[220px] items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent">
                                <span className="font-medium">/{activeCommand.keyword}</span>
                                <button
                                    type="button"
                                    onClick={handleClearCommand}
                                    aria-label="移除指令"
                                    className="flex h-4 w-4 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent hover:text-accent-ink"
                                >
                                    ×
                                </button>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleOpenCommandPicker}
                                className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                            >
                                <span className="text-xs leading-none">/</span>
                                选择指令
                            </button>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="w-36 shrink-0">
                            {models.length > 0 ? (
                                <Select
                                    value={modelId}
                                    options={modelOptions}
                                    onChange={setModelId}
                                    placeholder={MODEL_PLACEHOLDER}
                                    aria-label="选择模型"
                                    direction="up"
                                    compact
                                />
                            ) : null}
                        </div>
                        {streaming ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="h-7 rounded-md bg-danger px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                            >
                                {STOP_TEXT}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={!currentModel || !input.trim()}
                                className="h-7 rounded-md bg-accent px-3 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {SEND_TEXT}
                            </button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    )
}
