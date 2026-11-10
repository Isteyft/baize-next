import { invoke } from '@tauri-apps/api/core'

import type { GeneratedResult } from './aiGeneration'

/** 单条会话消息（会话持久化时去除临时字段，保留 role、content 与可应用的生成结果）。 */
export interface ChatSessionMessage {
    role: 'user' | 'assistant'
    content: string
    /** 指令生成的可应用结果，落盘后重新进入会话仍可「应用到 mod」。 */
    generated?: GeneratedResult | null
}

/** 一次完整会话。 */
export interface ChatSession {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: ChatSessionMessage[]
}

/** 生成唯一会话 id。 */
export function createSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 新建一个空会话。 */
export function createChatSession(title = ''): ChatSession {
    const now = Date.now()
    return {
        id: createSessionId(),
        title,
        createdAt: now,
        updatedAt: now,
        messages: [],
    }
}

/** 默认会话标题（未命名时展示）。 */
export const DEFAULT_SESSION_TITLE = '新会话'

/** 校验 generated 字段：须为含 records 数组的对象，否则丢弃。 */
function isGeneratedResult(value: unknown): value is GeneratedResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const entry = value as Partial<GeneratedResult>
    return Array.isArray(entry.records)
}

function isChatSessionMessage(value: unknown): value is ChatSessionMessage {
    if (!value || typeof value !== 'object') return false
    const entry = value as Partial<ChatSessionMessage>
    return (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string'
}

/** 校验并规范化未知对象为会话；非法时返回 null。 */
export function normalizeChatSession(id: string, value: unknown): ChatSession | null {
    if (!value || typeof value !== 'object') return null
    const data = value as Partial<ChatSession>
    const messages = Array.isArray(data.messages)
        ? data.messages.filter(isChatSessionMessage).map(item => ({
              role: item.role,
              content: item.content,
              generated: isGeneratedResult(item.generated) ? item.generated : undefined,
          }))
        : []
    const title = typeof data.title === 'string' ? data.title : ''
    const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : createdAt
    return { id, title, createdAt, updatedAt, messages }
}

/** 将会话序列化为落盘 JSON 文本。 */
export function serializeChatSession(session: ChatSession): string {
    return JSON.stringify(session, null, 2)
}

/** 由消息列表推导会话标题：取首条用户消息的前若干字符。 */
export function deriveSessionTitle(messages: ChatSessionMessage[]): string {
    const first = messages.find(item => item.role === 'user')
    if (!first) return DEFAULT_SESSION_TITLE
    const text = first.content.trim().replace(/\s+/g, ' ')
    return text.length > 20 ? `${text.slice(0, 20)}…` : text || DEFAULT_SESSION_TITLE
}

/**
 * 读取会话目录下所有会话。目录不存在或异常时返回空数组。
 * 返回结果按 updatedAt 倒序排列。
 */
export async function readChatSessions(dir: string): Promise<ChatSession[]> {
    try {
        const entries = await invoke<Array<{ relativePath: string; content: string }>>('read_chat_sessions', { dir })
        const sessions = entries
            .map(entry => normalizeChatSession(entry.relativePath, JSON.parse(entry.content) as unknown))
            .filter((session): session is ChatSession => session !== null)
        sessions.sort((a, b) => b.updatedAt - a.updatedAt)
        return sessions
    } catch {
        return []
    }
}

/** 将单个会话写入会话目录；异常时静默忽略。 */
export async function writeChatSession(dir: string, session: ChatSession): Promise<void> {
    try {
        await invoke('write_chat_session', { dir, id: session.id, content: serializeChatSession(session) })
    } catch {
        // Non-Tauri previews or invalid dir ignore writes.
    }
}

/** 删除会话目录下的单个会话；异常时静默忽略。 */
export async function deleteChatSession(dir: string, id: string): Promise<void> {
    try {
        await invoke('delete_chat_session', { dir, id })
    } catch {
        // Non-Tauri previews or invalid dir ignore deletes.
    }
}
