import type { JsonRecord } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { buildBatchIdReplacements } from './batchId'

function record(key: string, data: JsonRecord['data']): JsonRecord {
    return { key, data }
}

describe('buildBatchIdReplacements', () => {
    it('generates a sequential numeric ID plan without conflicts', () => {
        const records = [
            record('1', { id: 1, name: 'Alpha' }),
            record('2', { id: 2, name: 'Beta' }),
            record('3', { id: 3, name: 'Gamma' }),
            record('10', { id: 10, name: 'Keep' }),
        ]

        const result = buildBatchIdReplacements(records, ['1', '2', '3'], 'id', '100')

        expect(result).toEqual({
            ok: true,
            changes: [
                { oldKey: '1', newKey: '100', field: 'id', value: 100 },
                { oldKey: '2', newKey: '101', field: 'id', value: 101 },
                { oldKey: '3', newKey: '102', field: 'id', value: 102 },
            ],
        })
    })

    it('keeps the record order matching the given records array', () => {
        const records = [record('b', { id: 20, name: 'Beta' }), record('a', { id: 10, name: 'Alpha' })]

        const result = buildBatchIdReplacements(records, ['a', 'b'], 'id', '5')

        expect(result.ok ? result.changes.map(change => change.newKey) : null).toEqual(['5', '6'])
    })

    it('intercepts a conflict and returns no changes', () => {
        const records = [
            record('1', { id: 1, name: 'Alpha' }),
            record('2', { id: 2, name: 'Beta' }),
            record('101', { id: 101, name: 'Occupied' }),
        ]

        const result = buildBatchIdReplacements(records, ['1', '2'], 'id', '100')

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.code).toBe('conflict')
        expect(result.conflictingId).toBe('101')
        expect(result.message).toBe('ID 101 已被占用，批量修改已取消。')
        expect('changes' in result).toBe(false)
    })

    it('does not treat IDs owned by selected records as conflicts', () => {
        const records = [record('1', { id: 1, name: 'Alpha' }), record('9', { id: 9, name: 'Beta' })]

        const result = buildBatchIdReplacements(records, ['1', '9'], 'id', '9')

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.changes.map(change => change.newKey)).toEqual(['9', '10'])
        }
    })

    it('supports string IDs with an incrementable numeric suffix', () => {
        const records = [record('A01', { id: 'A01' }), record('A02', { id: 'A02' })]

        const result = buildBatchIdReplacements(records, ['A01', 'A02'], 'id', 'A05')

        expect(result).toEqual({
            ok: true,
            changes: [
                { oldKey: 'A01', newKey: 'A05', field: 'id', value: 'A05' },
                { oldKey: 'A02', newKey: 'A06', field: 'id', value: 'A06' },
            ],
        })
    })

    it('preserves leading zeros of a string suffix', () => {
        const records = [record('001', { id: '001' }), record('002', { id: '002' })]

        const result = buildBatchIdReplacements(records, ['001', '002'], 'id', '003')

        expect(result.ok && result.changes.map(change => change.value)).toEqual(['003', '004'])
    })

    it('rejects empty, non-incrementable and missing-selection inputs', () => {
        const records = [record('1', { id: 1 })]

        expect(buildBatchIdReplacements(records, [], 'id', '1').ok).toBe(false)
        expect(buildBatchIdReplacements(records, ['1'], 'id', '').ok).toBe(false)
        expect(buildBatchIdReplacements(records, ['1'], 'id', 'abc').ok).toBe(false)
        expect(buildBatchIdReplacements(records, ['1'], 'id', '12.5').ok).toBe(false)
    })

    it('rejects when the group has no primary field', () => {
        const result = buildBatchIdReplacements([record('1', { name: 'x' })], ['1'], null, '100')
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.code).toBe('no-primary-field')
    })
})
