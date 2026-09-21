import { CONSULT_BOOK_ID_OFFSET, createConsultBookRecord, isConsultBookItem, validateConsultBookGeneration } from '@baize-next/core'
import type { JsonRecord } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

function itemRecord(id: number, type: number, extra: Record<string, unknown> = {}): JsonRecord {
    return {
        key: String(id),
        data: {
            id,
            type,
            name: '天龙吐火诀',
            ShopType: 4,
            ItemFlag: [1, 2],
            price: 100,
            ...extra,
        },
    }
}

describe('consult book generation', () => {
    it('blocks an item whose id exceeds the one-billion upper limit', () => {
        const record = itemRecord(1_000_000_001, 3)
        const result = validateConsultBookGeneration(record, [])

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected validation to fail')
        expect(result.reason).toBe('id-over-limit')
        expect(result.message).toContain('1000000001')
        expect(result.message).toContain('超出十亿上限')
    })

    it('blocks an item that is not a shenTong or skill book', () => {
        const record = itemRecord(12, 0)
        const result = validateConsultBookGeneration(record, [])

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected validation to fail')
        expect(result.reason).toBe('invalid-type')
        expect(result.message).toContain('类型不为神通或功法书籍')
    })

    it('blocks generation when the target id already exists in the data table', () => {
        const record = itemRecord(7, 4)
        const existingTarget = itemRecord(7 + CONSULT_BOOK_ID_OFFSET, 4, { name: '请教天龙吐火诀' })
        const result = validateConsultBookGeneration(record, [existingTarget])

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('expected validation to fail')
        expect(result.reason).toBe('id-conflict')
        expect(result.targetId).toBe(7 + CONSULT_BOOK_ID_OFFSET)
        expect(result.message).toContain('请教书籍已存在')
    })

    it('clones the source item and overrides id, ShopType, ItemFlag and price', () => {
        const source = itemRecord(7, 4, { desc: '原始描述', Affix: [31, 32] })
        const result = validateConsultBookGeneration(source, [])

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('expected validation to pass')
        expect(result.sourceId).toBe(7)
        expect(result.targetId).toBe(7 + CONSULT_BOOK_ID_OFFSET)
        expect(result.record.key).toBe(String(7 + CONSULT_BOOK_ID_OFFSET))
        expect(result.record.data).toMatchObject({
            id: 7 + CONSULT_BOOK_ID_OFFSET,
            name: '天龙吐火诀',
            ShopType: 99,
            ItemFlag: [],
            price: 0,
            desc: '原始描述',
            Affix: [31, 32],
        })
        expect(source.data.id).toBe(7)
        expect(source.data.ShopType).toBe(4)
        expect(source.data.ItemFlag).toEqual([1, 2])
        expect(source.data.price).toBe(100)
    })

    it('creates the clone record directly with the forced overrides', () => {
        const source = itemRecord(9, 3, { desc: '原始描述' })
        const cloned = createConsultBookRecord(source, 9)

        expect(cloned.key).toBe(String(9 + CONSULT_BOOK_ID_OFFSET))
        expect(cloned.data.id).toBe(9 + CONSULT_BOOK_ID_OFFSET)
        expect(cloned.data.ShopType).toBe(99)
        expect(cloned.data.ItemFlag).toEqual([])
        expect(cloned.data.price).toBe(0)
        expect(cloned.data.desc).toBe('原始描述')
        expect(source.data.ItemFlag).toEqual([1, 2])
    })

    it('identifies only shenTong/skill book items as consult book sources', () => {
        expect(isConsultBookItem(itemRecord(12, 3))).toBe(true)
        expect(isConsultBookItem(itemRecord(13, 4))).toBe(true)
        expect(isConsultBookItem(itemRecord(14, 0))).toBe(false)
        expect(isConsultBookItem(itemRecord(14, 5))).toBe(false)
    })
})
