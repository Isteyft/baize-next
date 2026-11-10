import { emit, listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type AiModelConfig, createAiModel, createAiModelId, normalizeModelBaseUrl } from './aiModels'

vi.mock('@tauri-apps/api/event', () => ({
    emit: vi.fn(async () => undefined),
    listen: vi.fn(async () => () => undefined),
}))

describe('createAiModelId', () => {
    it('生成的 id 唯一', () => {
        const a = createAiModelId()
        const b = createAiModelId()
        expect(a).not.toBe(b)
    })

    it('以 model- 为前缀', () => {
        expect(createAiModelId()).toMatch(/^model-/)
    })
})

describe('createAiModel', () => {
    it('返回空配置', () => {
        const model = createAiModel()
        expect(model.id).toMatch(/^model-/)
        expect(model.name).toBe('')
        expect(model.baseURL).toBe('')
        expect(model.apiKey).toBe('')
        expect(model.model).toBe('')
    })
})

describe('normalizeModelBaseUrl', () => {
    it('缺少协议时自动补 https://', () => {
        expect(normalizeModelBaseUrl('api.moonshot.cn/v1')).toBe('https://api.moonshot.cn/v1')
    })

    it('保留已有 http 协议', () => {
        expect(normalizeModelBaseUrl('http://localhost:8000/v1')).toBe('http://localhost:8000/v1')
    })

    it('去除末尾斜杠与首尾空白', () => {
        expect(normalizeModelBaseUrl('  https://api.openai.com/v1/  ')).toBe('https://api.openai.com/v1')
    })

    it('空字符串原样返回', () => {
        expect(normalizeModelBaseUrl('')).toBe('')
    })
})

describe('存储读写（localStorage 兜底路径）', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.mocked(emit).mockClear()
        vi.mocked(listen).mockClear()
    })

    it('getSavedAiModels 无数据时返回空数组', async () => {
        const { getSavedAiModels } = await import('./aiModels')
        expect(getSavedAiModels()).toEqual([])
    })

    it('subscribeAiModels 在 storage 事件触发时回调新模型列表', async () => {
        const { subscribeAiModels } = await import('./aiModels')
        const onChange = vi.fn()
        const unsubscribe = subscribeAiModels(onChange)

        const models: AiModelConfig[] = [
            { id: 'model-1', name: 'GPT-4o', baseURL: 'https://api.openai.com/v1', apiKey: 'sk', model: 'gpt-4o' },
        ]
        const event = new StorageEvent('storage', {
            key: 'baize-next.ai-models',
            newValue: JSON.stringify(models),
        })
        window.dispatchEvent(event)

        expect(onChange).toHaveBeenCalledWith(models)
        unsubscribe()
    })

    it('subscribeAiModels 在 storage 事件值非法时回调空数组', async () => {
        const { subscribeAiModels } = await import('./aiModels')
        const onChange = vi.fn()
        const unsubscribe = subscribeAiModels(onChange)

        window.dispatchEvent(
            new StorageEvent('storage', {
                key: 'baize-next.ai-models',
                newValue: 'not-json',
            })
        )

        expect(onChange).toHaveBeenCalledWith([])
        unsubscribe()
    })
})
