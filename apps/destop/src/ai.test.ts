import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiModelConfig } from './aiModels'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
    Channel: class {
        onmessage: ((message: string) => void) | undefined
    },
}))

import { chatCompletion, chatCompletionStream } from './ai'

const sampleModel: AiModelConfig = {
    id: 'model-1',
    name: 'GPT-4o',
    baseURL: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    model: 'gpt-4o',
}

describe('chatCompletion', () => {
    beforeEach(() => {
        invokeMock.mockReset()
    })

    it('通过 invoke 调用 Rust chat_completion 命令并透传参数', async () => {
        invokeMock.mockResolvedValue('你好')
        const result = await chatCompletion(sampleModel, [{ role: 'user', content: 'hello' }])

        expect(result).toBe('你好')
        expect(invokeMock).toHaveBeenCalledTimes(1)
        expect(invokeMock).toHaveBeenCalledWith('chat_completion', {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-test',
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'hello' }],
        })
    })

    it('过滤空内容消息', async () => {
        invokeMock.mockResolvedValue('ok')
        await chatCompletion(sampleModel, [
            { role: 'user', content: 'hi' },
            { role: 'user', content: '   ' },
        ])

        const args = invokeMock.mock.calls[0] as unknown[]
        const payload = args[1] as { messages: Array<{ role: string; content: string }> }
        expect(payload.messages).toEqual([{ role: 'user', content: 'hi' }])
    })

    it('Rust 返回错误时向外抛出', async () => {
        invokeMock.mockRejectedValue(new Error('请求失败（401）'))
        await expect(chatCompletion(sampleModel, [{ role: 'user', content: 'hi' }])).rejects.toThrow('请求失败（401）')
    })
})

describe('chatCompletionStream', () => {
    beforeEach(() => {
        invokeMock.mockReset()
    })

    it('通过 channel 逐块推送增量并累积为完整回复', async () => {
        invokeMock.mockImplementation(async (_command: string, payload: { onEvent: { onmessage?: (m: string) => void } }) => {
            const channel = payload.onEvent
            channel.onmessage?.('你')
            channel.onmessage?.('好')
        })
        const onDelta = vi.fn()
        const onDone = vi.fn()

        const result = await chatCompletionStream(sampleModel, [{ role: 'user', content: 'hi' }], { onDelta, onDone })

        expect(invokeMock).toHaveBeenCalledWith(
            'chat_completion_stream',
            expect.objectContaining({
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'sk-test',
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }],
            })
        )
        expect(onDelta).toHaveBeenNthCalledWith(1, '你')
        expect(onDelta).toHaveBeenNthCalledWith(2, '好')
        expect(onDone).toHaveBeenCalledWith('你好')
        expect(result).toBe('你好')
    })
})
