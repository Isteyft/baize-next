import type { JsonDataset } from '@baize-next/types'
import { useEffect, useMemo, useRef, useState } from 'react'

import { chatCompletionStream, chatCompletionWithTools, type ChatMessage } from '../ai'
import { createDefaultToolExecutor, type ExistingRecordIndex, runToolCalls } from '../aiAgent'
import { AI_COMMANDS, type AiCommand, buildCommandContext, filterAiCommands, findCommandByGroupKey } from '../aiCommands'
import { type GeneratedResult, parseGeneratedResult, serializeGeneratedResult } from '../aiGeneration'
import { type AiModelConfig, getSavedAiModels, subscribeAiModels } from '../aiModels'
import {
    type AgentAccumulator,
    type AskUserArgs,
    buildToolDefinitions,
    createAgentAccumulator,
    type DelegateRecordArgs,
    GLOBAL_SYSTEM_PROMPT,
    mergeAccumulator,
    parseDelegateRecordArgs,
    parseToolArguments,
} from '../aiTools'
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
const APPLY_TEXT = '应用到 mod'
const APPLY_PREVIEW_TITLE = '确认应用到 mod'
const APPLY_CONFIRM_TEXT = '确认应用'
const APPLY_CANCEL_TEXT = '取消'
const REFERENCE_TEXT = '引用'
const REFERENCED_TEXT = '已引用'
const AGENT_MAX_ROUNDS = 12
const DELEGATE_MAX_DEPTH = 3

interface DisplayMessage extends ChatMessage {
    id: string
    pending?: boolean
    error?: string
    /** 该消息若为指令生成结果，缓存解析出的可应用结果。 */
    generated?: GeneratedResult | null
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
    /** 已有记录索引（预加载数据 + 当前项目），供 search_record 工具查询复用。 */
    existingRecords?: ExistingRecordIndex
    /** 将 AI 生成结果应用到当前 mod；无选中 mod 时返回 false。 */
    onApplyGenerated?: (result: GeneratedResult) => boolean
}

/** 内嵌在主窗口右侧的 AI 对话面板。 */
export function ChatPanel({
    width = 360,
    onClose,
    metaDatasets = [],
    seidRecords,
    existingRecords = {},
    onApplyGenerated,
}: ChatPanelProps) {
    const [models, setModels] = useState<AiModelConfig[]>(getSavedAiModels)
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
    const [applyTarget, setApplyTarget] = useState<GeneratedResult | null>(null)
    /** 被「引用」的消息 id；后续发送时把该消息的生成结果注入上下文，保持上下文连续。 */
    const [referencedId, setReferencedId] = useState<string | null>(null)
    const [askTarget, setAskTarget] = useState<AskUserArgs | null>(null)
    const [askAnswer, setAskAnswer] = useState('')
    const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null)
    const [, setThinkingTick] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const chatDirRef = useRef<string>('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const footerRef = useRef<HTMLElement>(null)
    const askResolverRef = useRef<((answer: string | null) => void) | null>(null)

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

    // 订阅大模型配置变更，设置窗口保存后侧边栏模型列表与选中项实时同步。
    useEffect(() => {
        return subscribeAiModels(next => {
            setModels(next)
        })
    }, [])

    // 默认选中第一个模型。
    useEffect(() => {
        if (!modelId && models.length > 0) {
            setModelId(models[0].id)
        }
    }, [modelId, models])

    // 当前选中的模型被删除后，回退到第一个可用模型，避免发送按钮一直禁用。
    useEffect(() => {
        if (models.length === 0) return
        if (modelId && models.some(item => item.id === modelId)) return
        setModelId(models[0].id)
    }, [models, modelId])

    // 新消息时滚动到底部。
    useEffect(() => {
        const el = listRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages])

    // 思考状态计时：streaming 期间每秒刷新一次，驱动「思考中…x 秒」显示。
    useEffect(() => {
        if (!streaming) return
        const timer = window.setInterval(() => setThinkingTick(tick => tick + 1), 1000)
        return () => window.clearInterval(timer)
    }, [streaming])

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
            .map(item => ({
                role: item.role as 'user' | 'assistant',
                content: item.content,
                generated: item.generated ?? undefined,
            }))
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

    /** 组装发送给模型的 system 消息：全局提示词 + 基础提示 + 选中指令的 meta 上下文。 */
    function buildSystemMessages(): ChatMessage[] {
        const messages: ChatMessage[] = []
        if (GLOBAL_SYSTEM_PROMPT.trim()) messages.push({ role: 'system', content: GLOBAL_SYSTEM_PROMPT })
        messages.push({ role: 'system', content: SYSTEM_PROMPT })
        if (activeCommand) {
            const context = buildCommandContext(activeCommand, metaDatasets, seidRecords)
            if (context) messages.push({ role: 'system', content: context })
        }
        return messages
    }

    /** 等待用户通过 ask_user 弹窗回答问题；返回回答文本，取消返回 null。 */
    function waitForAskAnswer(args: AskUserArgs): Promise<string | null> {
        return new Promise(resolve => {
            askResolverRef.current = resolve
            setAskAnswer('')
            setAskTarget(args)
        })
    }

    /** 弹窗提交回答：把答案回传给等待中的 agent 循环。留空时回传空串，由 AI 自行决定。 */
    function handleAskSubmit(): void {
        const resolver = askResolverRef.current
        askResolverRef.current = null
        setAskTarget(null)
        resolver?.(askAnswer)
    }

    /** 弹窗取消：中断 agent 循环（回传 null 表示用户不回答）。 */
    function handleAskCancel(): void {
        const resolver = askResolverRef.current
        askResolverRef.current = null
        setAskTarget(null)
        resolver?.(null)
    }

    /** 委托子会话生成一条依赖记录（如功法配套的 buff），复用「写 X」指令的完整上下文。返回子会话累积器。 */
    async function runDelegation(model: AiModelConfig, args: DelegateRecordArgs, depth: number): Promise<AgentAccumulator | null> {
        const groupKey = args.group as AiCommand['groupKey']
        const command = findCommandByGroupKey(AI_COMMANDS, groupKey)
        if (!command) return null

        // 构建子会话上下文：该指令的完整字段 schema + 枚举 + SeidMeta，外加需求描述。
        const context = buildCommandContext(command, metaDatasets, seidRecords)
        const subMessages: ChatMessage[] = [
            { role: 'system', content: context },
            { role: 'user', content: args.requirement },
        ]

        // 子循环独立累积器，结果由调用方合并回主累积器。
        return runAgentLoop(model, subMessages, undefined, undefined, depth)
    }

    /** 执行一轮 agent 循环：带工具能力地调用模型，处理工具调用直到模型结束或问用户。返回累积的生成结果。 */
    async function runAgentLoop(
        model: AiModelConfig,
        baseMessages: ChatMessage[],
        onFinal?: (content: string, generated: GeneratedResult | null) => void,
        initialAcc?: AgentAccumulator,
        depth = 0
    ): Promise<AgentAccumulator> {
        const tools = buildToolDefinitions()
        const executor = createDefaultToolExecutor(existingRecords)
        let acc = initialAcc ?? createAgentAccumulator()
        // 完整消息序列（含 tool 消息），随循环增长。
        let loopMessages: ChatMessage[] = [...baseMessages]
        let finalText = ''

        for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
            const result = await chatCompletionWithTools(model, loopMessages, tools)
            finalText = result.content

            if (result.toolCalls.length === 0) {
                // 无工具调用，循环结束。
                break
            }

            // 分离 delegate_record 调用，其余交给同步执行器。
            const delegateCalls = result.toolCalls.filter(call => call.function?.name === 'delegate_record')
            const otherCalls = result.toolCalls.filter(call => call.function?.name !== 'delegate_record')

            // 先处理普通工具调用。
            const { next, askUser, feedbacks } = runToolCalls(acc, otherCalls, executor)
            acc = next

            // 逐条处理 delegate_record：异步起子会话，把子会话结果合并回主累积器。
            const delegateFeedbacks = new Map<string, string>()
            for (const call of delegateCalls) {
                const parsed = parseToolArguments(call.function?.arguments ?? '{}')
                if (!parsed) {
                    delegateFeedbacks.set(call.id, 'delegate_record 参数非法：工具参数不是合法 JSON')
                    continue
                }
                const raw = parseDelegateRecordArgs(parsed)
                if (!raw) {
                    delegateFeedbacks.set(call.id, 'delegate_record 参数非法：缺少 group 或 requirement')
                    continue
                }
                if (depth >= DELEGATE_MAX_DEPTH) {
                    delegateFeedbacks.set(call.id, `delegate_record 已达最大嵌套深度 ${DELEGATE_MAX_DEPTH}，请改用 create_record 直接生成`)
                    continue
                }
                const subAcc = await runDelegation(model, raw, depth + 1)
                if (!subAcc) {
                    delegateFeedbacks.set(call.id, `delegate_record 失败：分组 ${raw.group} 没有对应的生成指令`)
                    continue
                }
                acc = mergeAccumulator(acc, subAcc)
                delegateFeedbacks.set(call.id, `已委托子会话生成 ${raw.group} 分组 ${subAcc.records.length} 条记录`)
            }

            // 若本轮请求向用户提问，弹窗并等待，把回答作为 tool 结果回传。
            let askAnswer: string | null = null
            if (askUser) {
                askAnswer = await waitForAskAnswer(askUser)
                if (askAnswer === null) {
                    // 用户取消提问，终止循环。
                    break
                }
            }

            // 组装 assistant 消息（带 tool_calls）回传。
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: result.content,
                toolCalls: result.toolCalls,
            }
            const toolMessages: ChatMessage[] = result.toolCalls.map(call => {
                let content: string
                const feedback = feedbacks.find(item => item.callId === call.id)
                if (call.function?.name === 'delegate_record') {
                    content = delegateFeedbacks.get(call.id) ?? ''
                } else if (call.function?.name === 'ask_user') {
                    content = askAnswer && askAnswer.trim() !== '' ? askAnswer : '用户未填写，请自行决定'
                } else {
                    content = feedback?.content ?? ''
                }
                return { role: 'tool', content, toolCallId: call.id }
            })

            loopMessages = [...loopMessages, assistantMessage, ...toolMessages]
        }

        const generated = acc.records.length > 0 ? ({ records: acc.records, seidData: acc.seidData } as GeneratedResult) : null
        onFinal?.(finalText, generated)
        return acc
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
        setThinkingStartedAt(Date.now())
        persistCurrentSession(next)

        // 捕获并消费当前指令，随后清除，回到普通对话。
        const commandForSend = activeCommand
        const systemMessages = buildSystemMessages()
        setActiveCommand(null)

        // 若存在被引用的生成结果，序列化后作为 system 上下文注入，保持跨轮上下文连续。
        const referenced = referencedId ? messages.find(item => item.id === referencedId) : undefined
        if (referenced?.generated) {
            systemMessages.push({ role: 'system', content: serializeGeneratedResult(referenced.generated) })
        }

        const history = messages.filter(item => item.role === 'user' || item.role === 'assistant')
        const abort = new AbortController()
        abortRef.current = abort

        let accumulated = ''
        let finalGenerated: GeneratedResult | null = null

        const finish = (): void => {
            // 流式/循环结束后，用最终内容落盘一次，并尝试解析指令生成结果。
            setMessages(previous => {
                const finalMessages = previous.map(item => {
                    if (item.id !== assistantId || item.error) return item
                    const content = accumulated || '（无回复）'
                    const generated = commandForSend
                        ? (finalGenerated ?? parseGeneratedResult(content, commandForSend.groupKey ?? undefined))
                        : null
                    return { ...item, content, pending: false, generated }
                })
                persistCurrentSession(finalMessages)
                return finalMessages
            })
        }

        try {
            if (commandForSend) {
                // 指令模式：走 agent 多轮循环，AI 可自主补依赖并主动问 id。
                await runAgentLoop(currentModel, [...systemMessages, ...history, userMessage], (content, generated) => {
                    accumulated = content
                    finalGenerated = generated
                    replaceMessage(assistantId, { content: content || '（无回复）', pending: false })
                })
                if (!accumulated) {
                    replaceMessage(assistantId, { content: '（无回复）', pending: false })
                }
            } else {
                // 普通对话：保持原有流式。
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
            }
        } catch (error) {
            replaceMessage(assistantId, {
                pending: false,
                error: error instanceof Error ? error.message : '请求失败',
            })
            void appendErrorLog(`AI 对话（${currentModel.name}）`, error)
        } finally {
            setStreaming(false)
            setThinkingStartedAt(null)
            abortRef.current = null
            finish()
        }
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

    /** 打开应用预览弹窗。 */
    function handleOpenApply(result: GeneratedResult): void {
        setApplyTarget(result)
    }

    /** 引用/取消引用一条生成结果消息：引用后后续对话会带上该结果作为上下文。 */
    function handleToggleReference(messageId: string): void {
        setReferencedId(previous => (previous === messageId ? null : messageId))
    }

    /** 确认应用：调用父组件写回，成功后关闭弹窗；无 mod 时提示。 */
    function handleConfirmApply(): void {
        if (!applyTarget || !onApplyGenerated) return
        const applied = onApplyGenerated(applyTarget)
        setApplyTarget(null)
        if (!applied) {
            void appendErrorLog('AI 应用到 mod', new Error('未选中任何 mod，请先在左侧选择一个 mod 后再应用'))
        }
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
        setThinkingStartedAt(Date.now())

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
            setThinkingStartedAt(null)
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
                                    <div className="max-w-[80%] select-text rounded-lg bg-accent px-3 py-2 text-sm text-accent-ink">
                                        {message.content}
                                    </div>
                                </div>
                            ) : (
                                <div key={message.id} className="flex justify-start">
                                    <div
                                        className={`max-w-[80%] select-text rounded-lg bg-raised px-3 py-2 text-sm text-ink-soft ${
                                            referencedId === message.id ? 'ring-2 ring-accent' : ''
                                        }`}
                                    >
                                        {message.pending && !message.content ? (
                                            <span className="text-ink-subtle">
                                                思考中…
                                                {thinkingStartedAt
                                                    ? `${Math.max(1, Math.floor((Date.now() - thinkingStartedAt) / 1000))} 秒`
                                                    : ''}
                                            </span>
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
                                        {message.generated ? (
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenApply(message.generated!)}
                                                    className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                                                >
                                                    {APPLY_TEXT}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleReference(message.id)}
                                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                                        referencedId === message.id
                                                            ? 'border-accent bg-accent-soft text-accent'
                                                            : 'border-line text-ink-soft hover:border-accent hover:text-accent'
                                                    }`}
                                                >
                                                    {referencedId === message.id ? REFERENCED_TEXT : REFERENCE_TEXT}
                                                </button>
                                                <span className="text-xs text-ink-subtle">{message.generated.records.length} 条记录</span>
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

            {applyTarget ? (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-6"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) setApplyTarget(null)
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={APPLY_PREVIEW_TITLE}
                        className="flex max-h-[min(640px,calc(100vh-48px))] w-[min(560px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
                            <h3 className="text-base font-semibold text-ink">{APPLY_PREVIEW_TITLE}</h3>
                            <button
                                type="button"
                                onClick={() => setApplyTarget(null)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                {APPLY_CANCEL_TEXT}
                            </button>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            <p className="mb-3 text-sm text-ink-subtle">将写入 {applyTarget.records.length} 条记录到当前 mod，请确认：</p>
                            <ul className="space-y-2">
                                {applyTarget.records.map((record, index) => (
                                    <li
                                        key={`${record.group}-${record.key}-${index}`}
                                        className="rounded-md border border-line bg-raised px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">{record.group}</span>
                                            <span className="text-sm font-medium text-ink">{record.key}</span>
                                            <span className="text-sm text-ink-soft">
                                                {typeof record.data.name === 'string' ? record.data.name : ''}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setApplyTarget(null)}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                {APPLY_CANCEL_TEXT}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmApply}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                {APPLY_CONFIRM_TEXT}
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}

            {askTarget ? (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-6" role="presentation">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="AI 提问"
                        className="flex w-[min(480px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
                    >
                        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
                            <h3 className="text-base font-semibold text-ink">AI 需要补充信息</h3>
                        </header>
                        <div className="flex flex-col gap-2 p-4">
                            <p className="text-sm text-ink">{askTarget.question}</p>
                            {askTarget.kind === 'options' && askTarget.options ? (
                                <div className="flex flex-wrap gap-2">
                                    {askTarget.options.map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setAskAnswer(option)}
                                            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                                                askAnswer === option
                                                    ? 'border-accent bg-accent-soft text-accent'
                                                    : 'border-line text-ink-soft hover:border-accent hover:text-accent'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    inputMode={askTarget.kind === 'number' ? 'numeric' : undefined}
                                    value={askAnswer}
                                    onChange={event => setAskAnswer(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            handleAskSubmit()
                                        }
                                    }}
                                    autoFocus
                                    placeholder="请输入，留空则自行决定"
                                    className="w-full rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                                />
                            )}
                            <p className="text-xs text-ink-subtle">留空直接确认，AI 将自行决定该信息。</p>
                        </div>
                        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
                            <button
                                type="button"
                                onClick={handleAskCancel}
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-hover"
                            >
                                {APPLY_CANCEL_TEXT}
                            </button>
                            <button
                                type="button"
                                onClick={handleAskSubmit}
                                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                            >
                                {APPLY_CONFIRM_TEXT}
                            </button>
                        </footer>
                    </section>
                </div>
            ) : null}
        </div>
    )
}
