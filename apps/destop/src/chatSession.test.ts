import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    createChatSession,
    createSessionId,
    DEFAULT_SESSION_TITLE,
    deriveSessionTitle,
    normalizeChatSession,
    serializeChatSession,
} from './chatSession'

describe('createSessionId', () => {
    it('生成唯一 id 且以 sess- 为前缀', () => {
        const a = createSessionId()
        const b = createSessionId()
        expect(a).not.toBe(b)
        expect(a).toMatch(/^sess-/)
    })
})

describe('createChatSession', () => {
    it('返回空会话且标题可传入', () => {
        const session = createChatSession('你好')
        expect(session.id).toMatch(/^sess-/)
        expect(session.title).toBe('你好')
        expect(session.messages).toEqual([])
        expect(session.createdAt).toBe(session.updatedAt)
    })
})

describe('normalizeChatSession', () => {
    it('正常对象解析成功', () => {
        const session = normalizeChatSession('sess-1', {
            title: 't',
            createdAt: 1,
            updatedAt: 2,
            messages: [{ role: 'user', content: 'hi' }],
        })
        expect(session).not.toBeNull()
        expect(session?.messages).toEqual([{ role: 'user', content: 'hi' }])
    })

    it('过滤非法消息', () => {
        const session = normalizeChatSession('sess-1', {
            messages: [{ role: 'user', content: 'ok' }, { role: 'system', content: 'x' }, { content: 'bad' }],
        })
        expect(session?.messages).toEqual([{ role: 'user', content: 'ok' }])
    })

    it('非对象返回 null', () => {
        expect(normalizeChatSession('sess-1', 'str')).toBeNull()
        expect(normalizeChatSession('sess-1', null)).toBeNull()
    })
})

describe('serializeChatSession', () => {
    it('输出 JSON 文本可再解析', () => {
        const session = createChatSession('t')
        const parsed = JSON.parse(serializeChatSession(session)) as { id: string }
        expect(parsed.id).toBe(session.id)
    })
})

describe('deriveSessionTitle', () => {
    it('取首条用户消息摘要', () => {
        expect(deriveSessionTitle([{ role: 'user', content: '帮我写一段代码' }])).toBe('帮我写一段代码')
    })

    it('超长消息截断并加省略号', () => {
        expect(deriveSessionTitle([{ role: 'user', content: 'a'.repeat(30) }])).toBe(`${'a'.repeat(20)}…`)
    })

    it('无用户消息时返回默认标题', () => {
        expect(deriveSessionTitle([])).toBe(DEFAULT_SESSION_TITLE)
        expect(deriveSessionTitle([{ role: 'assistant', content: 'hi' }])).toBe(DEFAULT_SESSION_TITLE)
    })
})

describe('读写（invoke 封装）', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('readChatSessions 排序并解析', async () => {
        const invokeMock = vi.fn().mockResolvedValue([
            { relativePath: 'sess-a', content: JSON.stringify({ title: 'a', updatedAt: 1, messages: [] }) },
            { relativePath: 'sess-b', content: JSON.stringify({ title: 'b', updatedAt: 3, messages: [] }) },
        ])
        vi.doMock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }))
        const { readChatSessions } = await import('./chatSession')
        const sessions = await readChatSessions('/tmp/chat')
        expect(sessions.map(item => item.id)).toEqual(['sess-b', 'sess-a'])
    })
})
