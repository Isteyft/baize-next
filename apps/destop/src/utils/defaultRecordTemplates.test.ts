import type { ProjectModGroupKey } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { getRecordFieldNames, getRecordIdField, normalizeRecordData, withDefaultRecordData } from './defaultRecordTemplates'

const GROUP_CASES: Array<[ProjectModGroupKey, string]> = [
    ['buff', 'buffid'],
    ['item', 'id'],
    ['skill', 'id'],
    ['shenTong', 'id'],
    ['npcType', 'id'],
    ['npcWuDao', 'id'],
    ['wuDaoAllType', 'id'],
    ['wuDao', 'id'],
    ['tuJianChunWenBen', 'id'],
]

describe('default record templates', () => {
    it('fills a new item from built-in defaults while keeping the entered id', () => {
        const data = withDefaultRecordData('item', { id: 42 })

        expect(data).toMatchObject({
            id: 42,
            ItemIcon: 0,
            maxNum: 0,
            ShopType: 99,
            type: 0,
            Affix: [],
            ItemFlag: [],
            wuDao: [],
        })
    })

    it('creates every field required by generated data types for each addable group', () => {
        for (const [groupKey, idField] of GROUP_CASES) {
            expect(getRecordIdField(groupKey)).toBe(idField)

            const data = withDefaultRecordData(groupKey, { [idField]: 42 })
            expect(data[idField]).toBe(42)
            expect(Object.keys(data)).toEqual(getRecordFieldNames(groupKey, data))
        }
    })

    it('uses generated data types to keep templates complete', () => {
        expect(withDefaultRecordData('item', {}).ShuaXin).toBe(0)
        expect(withDefaultRecordData('npcWuDao', {})).toMatchObject({
            Type: 0,
            lv: 1,
            wudaoID: [],
            value1: 0,
            value21: 0,
        })
        expect(withDefaultRecordData('npcWuDao', {})).not.toHaveProperty('icon')
        expect(withDefaultRecordData('wuDao', {})).toMatchObject({
            icon: '',
            Cast: 0,
            Type: [],
            Lv: 1,
            seid: [],
        })
    })

    it('normalizes field types and fills missing fields before saving', () => {
        const data = normalizeRecordData(
            'item',
            {
                id: '42',
                name: 123,
                Affix: ['1', 'invalid', 2],
                unknown: { keep: true },
            },
            '42'
        )

        expect(data).toMatchObject({
            id: 42,
            name: '',
            Affix: [1, 2],
            ItemIcon: 0,
            ShuaXin: 0,
            unknown: { keep: true },
        })
        expect(Object.keys(data)).toEqual(getRecordFieldNames('item', data))
    })

    it('clones template arrays so separate additions do not share mutable data', () => {
        const first = withDefaultRecordData('item', { id: 1 })
        const second = withDefaultRecordData('item', { id: 2 })
        const affix = first.Affix

        expect(Array.isArray(affix)).toBe(true)
        if (!Array.isArray(affix)) return
        affix.push(999)

        expect(second.Affix).toEqual([])
    })
})
