import { type JsonRecord } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import {
    collectRecordFields,
    createDatasetId,
    formatCellValue,
    isRecordMap,
    isRecordObject,
    parseJsonContent,
    parseMetaJsonEntry,
    parseModPreloadJsonEntry,
    parseProjectFromEntries,
    type ProjectFileEntry,
    projectNameFromPath,
    serializeProjectFiles,
} from './json'

describe('json parsing helpers', () => {
    it('parses an array of records and keeps stable ids when available', () => {
        const dataset = parseJsonContent('heroes', '[{"id":7,"name":"alpha"},{"id":"8","name":"beta"},{"name":"omega"}]')

        expect(dataset.kind).toBe('file')
        expect(dataset.name).toBe('heroes')
        expect(dataset.records).toEqual([
            { key: '7', data: { id: 7, name: 'alpha' } },
            { key: '8', data: { id: '8', name: 'beta' } },
            { key: '2', data: { name: 'omega' } },
        ])
    })

    it('parses record maps and single object payloads', () => {
        const mapDataset = parseJsonContent('items', '{"a":{"id":"a1","count":2},"b":{"id":3,"count":4}}')
        expect(mapDataset.records).toEqual([
            { key: 'a1', data: { id: 'a1', count: 2 } },
            { key: '3', data: { id: 3, count: 4 } },
        ])

        const singleDataset = parseJsonContent('settings', '{"id":"root","name":"demo"}')
        expect(singleDataset.records).toEqual([{ key: 'root', data: { id: 'root', name: 'demo' } }])
    })

    it('tolerates BOM and trailing commas', () => {
        const dataset = parseJsonContent('tolerant', '\uFEFF[{"id":1},{"id":2},]')

        expect(dataset.records.map(record => record.key)).toEqual(['1', '2'])
    })

    it('throws for unsupported payloads', () => {
        expect(() => parseJsonContent('bad', '{"a":1}')).not.toThrow()
        expect(() => parseJsonContent('null', 'null')).toThrow(/JSON 顶层必须是数组或对象/)
        expect(() => parseJsonContent('invalid', '[1,2]')).toThrow(/数组第 1 项不是对象/)
    })

    it('classifies record objects and maps', () => {
        expect(isRecordObject({})).toBe(true)
        expect(isRecordObject([])).toBe(false)
        expect(isRecordObject(null)).toBe(false)
        expect(isRecordMap({ a: { id: 1 }, b: { id: 2 } })).toBe(true)
        expect(isRecordMap({ a: 1 })).toBe(false)
    })
})

describe('json table helpers', () => {
    it('collects fields in first-seen order', () => {
        const records: JsonRecord[] = [
            { key: '1', data: { a: 1, b: 2 } },
            { key: '2', data: { c: 3, a: 4, d: null } },
        ]

        expect(collectRecordFields(records)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('formats cell values consistently', () => {
        expect(formatCellValue(null)).toBe('null')
        expect(formatCellValue(true)).toBe('true')
        expect(formatCellValue({ a: 1 })).toBe('{"a":1}')
    })

    it('creates dataset ids with normalized base name and random suffix', () => {
        const id = createDatasetId('  Demo File 123  ')

        expect(id).toMatch(/^demo-file-123-[a-z0-9]{8}$/)
    })
})

describe('project JSON mapping', () => {
    it('normalizes project names from posix and windows style paths', () => {
        expect(projectNameFromPath('D:/games/Next/Editor/')).toBe('Editor')
        expect(projectNameFromPath('D:\\games\\Next\\Editor')).toBe('Editor')
    })

    it('recognizes project json entries and groups them by mod', async () => {
        const entries: ProjectFileEntry[] = [
            {
                relativePath: 'plugins/Next/_/mod_demo/Config/modConfig.json',
                content: '{"Name":"Demo"}',
            },
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/100.json',
                content: '{"buffid":100,"name":"Power"}',
            },
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/TuJianChunWenBen.json',
                content: '{"1":{"id":1,"typenum":2,"name1":"hidden","name2":"shown"}}',
            },
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/Unknown.json',
                content: '{"ignored":true}',
            },
        ]

        const project = await parseProjectFromEntries('D:\\games\\Editor', entries)

        expect(project.name).toBe('Editor')
        expect(project.mods).toHaveLength(1)
        const mod = project.mods[0]!
        expect(mod.name).toBe('mod_demo')
        expect(mod.groups.find(group => group.key === 'config')?.records).toEqual([{ key: 'root', data: { Name: 'Demo' } }])
        expect(mod.groups.find(group => group.key === 'buff')?.records).toEqual([{ key: '100', data: { buffid: 100, name: 'Power' } }])
        expect(mod.groups.find(group => group.key === 'tuJianChunWenBen')?.records).toEqual([
            { key: '1', data: { id: 1, typenum: 2, name1: 'hidden', name2: 'shown' } },
        ])
    })

    it('parses meta entries by file name', () => {
        const dataset = parseMetaJsonEntry({
            relativePath: 'plugins/Next/_/mod_demo/Data/example.json',
            content: '[{"id":"one"}]',
        })

        expect(dataset.name).toBe('example')
        expect(dataset.records[0]?.key).toBe('one')
    })

    it('labels mod preload json groups as mod preload', () => {
        const project = parseModPreloadJsonEntry({
            relativePath: 'preload.json',
            content: '[{"id":"one"}]',
        })

        expect(project.mods[0]?.groups[0]?.label).toBe('mod 预加载')
    })

    it('serializes project groups to the expected file paths', () => {
        const writes = serializeProjectFiles({
            id: 'project',
            name: 'Demo',
            mods: [
                {
                    id: 'mod',
                    name: 'demo',
                    groups: [
                        {
                            key: 'config',
                            label: 'config',
                            records: [{ key: 'root', data: { Name: 'Demo' } }],
                        },
                        {
                            key: 'buff',
                            label: 'buff',
                            records: [{ key: '100', data: { buffid: 100 } }],
                        },
                        {
                            key: 'tuJianChunWenBen',
                            label: 'tuJianChunWenBen',
                            records: [{ key: '1', data: { id: 1, name2: 'shown' } }],
                        },
                    ],
                },
            ],
        })

        const paths = writes.map(write => write.relativePath)
        expect(paths).toContain('plugins/Next/_/mod_demo/Config/modConfig.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/BuffJsonData/100.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/TuJianChunWenBen.json')
        expect(writes.find(write => write.relativePath.endsWith('BuffJsonData/100.json'))?.content).toContain('"buffid": 100')
    })
})
