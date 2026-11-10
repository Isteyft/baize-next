import { beforeEach, describe, expect, it } from 'vitest'

import { createAiModel, createAiModelId, normalizeModelBaseUrl } from './aiModels'

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
    })

    it('getSavedAiModels 无数据时返回空数组', async () => {
        const { getSavedAiModels } = await import('./aiModels')
        expect(getSavedAiModels()).toEqual([])
    })
})
