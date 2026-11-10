import type { ProjectData } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { collectGroupRecordsFromProjects, getFirstProjectSelection, insertRecordSorted, removeProjectModRoots } from './projectSession'

const PROJECT_A: ProjectData = {
    id: 'project-a',
    name: '项目 A',
    mods: [
        {
            id: 'mod-a',
            name: 'mod-a',
            groups: [{ key: 'buff', label: 'buff', records: [{ key: '1', data: { id: 1 } }] }],
        },
    ],
}

const PROJECT_B: ProjectData = {
    id: 'project-b',
    name: '项目 B',
    mods: [
        {
            id: 'mod-b',
            name: 'mod-b',
            groups: [{ key: 'buff', label: 'buff', records: [{ key: '2', data: { id: 2 } }] }],
        },
    ],
}

describe('projectSession', () => {
    it('builds the first selection from the requested project', () => {
        expect(getFirstProjectSelection('preload', PROJECT_A)).toEqual({
            kind: 'preload',
            projectId: 'project-a',
            modId: 'mod-a',
            groupKey: 'buff',
        })
    })

    it('collects records from every opened project in the requested group', () => {
        expect(collectGroupRecordsFromProjects([PROJECT_A, PROJECT_B], 'buff')).toEqual([
            { key: '1', data: { id: 1 } },
            { key: '2', data: { id: 2 } },
        ])
    })

    it('removes only the closed project resource roots', () => {
        expect(removeProjectModRoots({ 'mod-a': 'A', 'mod-b': 'B' }, PROJECT_A)).toEqual({ 'mod-b': 'B' })
    })
})

describe('insertRecordSorted', () => {
    it('inserts a new record by numeric id into its correct position', () => {
        const records = [
            { key: '25999', data: { id: 25999 } },
            { key: '30000', data: { id: 30000 } },
        ]
        const next = { key: '26000', data: { id: 26000 } }
        expect(insertRecordSorted('item', records, next).map(record => record.key)).toEqual(['25999', '26000', '30000'])
    })

    it('appends to the end when the new id is the largest', () => {
        const records = [
            { key: '1', data: { id: 1 } },
            { key: '25999', data: { id: 25999 } },
        ]
        const next = { key: '26000', data: { id: 26000 } }
        expect(insertRecordSorted('item', records, next).map(record => record.key)).toEqual(['1', '25999', '26000'])
    })

    it('inserts before when the new id is the smallest', () => {
        const records = [
            { key: '1', data: { id: 1 } },
            { key: '2', data: { id: 2 } },
        ]
        const next = { key: '0', data: { id: 0 } }
        expect(insertRecordSorted('item', records, next).map(record => record.key)).toEqual(['0', '1', '2'])
    })

    it('sorts numeric ids correctly regardless of string or number type', () => {
        const records = [
            { key: '25999', data: { id: 25999 } },
            { key: '30000', data: { id: '30000' } },
        ]
        const next = { key: '26000', data: { id: '26000' } }
        expect(insertRecordSorted('item', records, next).map(record => record.key)).toEqual(['25999', '26000', '30000'])
    })

    it('falls back to numeric record key when the id field is missing', () => {
        const records = [
            { key: '100', data: { name: 'A' } },
            { key: '300', data: { name: 'C' } },
        ]
        const next = { key: '200', data: { name: 'B' } }
        expect(insertRecordSorted('shenTong', records, next).map(record => record.key)).toEqual(['100', '200', '300'])
    })

    it('places non-numeric records after numeric ones', () => {
        const records = [{ key: '2', data: { id: 2 } }]
        const next = { key: 'abc', data: { id: 'abc' } }
        expect(insertRecordSorted('item', records, next).map(record => record.key)).toEqual(['2', 'abc'])
    })
})
