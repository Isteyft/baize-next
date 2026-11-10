import type { ProjectData } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { applyGeneratedResultToProject, extractJsonObject, normalizeGeneratedResult, parseGeneratedResult } from './aiGeneration'

describe('extractJsonObject', () => {
    it('parses plain JSON', () => {
        expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 })
    })

    it('strips ```json fences', () => {
        const text = '```json\n{"a":1}\n```'
        expect(extractJsonObject(text)).toEqual({ a: 1 })
    })

    it('extracts JSON embedded in prose', () => {
        const text = '好的，以下是结果：\n{"a": 1, "b": [2,3]}\n希望有帮助'
        expect(extractJsonObject(text)).toEqual({ a: 1, b: [2, 3] })
    })

    it('returns null for non-JSON text', () => {
        expect(extractJsonObject('这里没有 JSON')).toBeNull()
        expect(extractJsonObject('')).toBeNull()
    })

    it('rejects arrays as top-level', () => {
        expect(extractJsonObject('[1,2,3]')).toBeNull()
    })
})

describe('parseGeneratedResult', () => {
    it('parses records + seidData structure', () => {
        const text = JSON.stringify({
            records: [
                { group: 'skill', key: '123', data: { Skill_ID: 123, name: '火剑', seid: [7] } },
                { group: 'buff', key: '456', data: { buffid: 456, name: '灼烧', seid: [3] } },
            ],
            seidData: {
                staticSkill: { '7': { '123': { skillid: 123, value1: [1, 2] } } },
            },
        })
        const result = parseGeneratedResult(text)
        expect(result).not.toBeNull()
        expect(result!.records).toHaveLength(2)
        expect(result!.records[0]!.group).toBe('skill')
        expect(result!.records[0]!.key).toBe('123')
        expect(result!.seidData.staticSkill?.['7']?.['123']).toEqual({ skillid: 123, value1: [1, 2] })
    })

    it('derives key from id field when key is missing', () => {
        const text = JSON.stringify({
            records: [{ group: 'buff', data: { buffid: 999, name: 'test' } }],
        })
        const result = parseGeneratedResult(text)
        expect(result!.records[0]!.key).toBe('999')
    })

    it('falls back to single record object with fallbackGroup', () => {
        const text = '{"buffid": 100, "name": "single"}'
        const result = parseGeneratedResult(text, 'buff')
        expect(result!.records).toHaveLength(1)
        expect(result!.records[0]!.key).toBe('100')
        expect(result!.records[0]!.group).toBe('buff')
    })

    it('returns null for invalid input', () => {
        expect(parseGeneratedResult('不是 JSON')).toBeNull()
        expect(parseGeneratedResult('')).toBeNull()
    })
})

describe('normalizeGeneratedResult', () => {
    it('ensures seid entries exist for listed seid ids', () => {
        const result = normalizeGeneratedResult({
            records: [{ group: 'buff', key: '100', data: { buffid: 100, seid: [1, 2] } }],
            seidData: {},
        })
        expect(result.seidData.buff?.['1']?.['100']).toEqual({})
        expect(result.seidData.buff?.['2']?.['100']).toEqual({})
    })
})

describe('applyGeneratedResultToProject', () => {
    function makeProject(): ProjectData {
        return {
            id: 'p1',
            name: 'test',
            mods: [
                {
                    id: 'm1',
                    name: 'mod1',
                    groups: [
                        { key: 'buff', label: 'buff', records: [] },
                        { key: 'skill', label: '功法', records: [] },
                    ],
                },
            ],
        }
    }

    it('inserts records and writes seid params with seid id appended', () => {
        const project = makeProject()
        const result = applyGeneratedResultToProject(project, 'm1', {
            records: [
                { group: 'skill', key: '100', data: { Skill_ID: 100, name: '火剑', seid: [7] } },
                { group: 'buff', key: '200', data: { buffid: 200, name: '灼烧', seid: [3] } },
            ],
            seidData: {
                staticSkill: { '7': { '100': { skillid: 100, value1: 10 } } },
                buff: { '3': { '200': { buffid: 200, value1: 5 } } },
            },
        })

        const mod = result.mods[0]!
        const skillGroup = mod.groups.find(group => group.key === 'skill')!
        const buffGroup = mod.groups.find(group => group.key === 'buff')!

        expect(skillGroup.records).toHaveLength(1)
        expect(skillGroup.records[0]!.key).toBe('100')
        expect(skillGroup.records[0]!.data.seid).toContain(7)
        expect(buffGroup.records[0]!.data.seid).toContain(3)

        expect(mod.seidData?.staticSkill?.['7']?.['100']).toEqual({ skillid: 100, value1: 10 })
        expect(mod.seidData?.buff?.['3']?.['200']).toEqual({ buffid: 200, value1: 5 })
    })

    it('overwrites existing record data but keeps it in place', () => {
        const project = makeProject()
        project.mods[0]!.groups.find(group => group.key === 'buff')!.records = [{ key: '200', data: { buffid: 200, name: '旧buff' } }]

        const result = applyGeneratedResultToProject(project, 'm1', {
            records: [{ group: 'buff', key: '200', data: { buffid: 200, name: '新buff' } }],
            seidData: {},
        })
        const buffGroup = result.mods[0]!.groups.find(group => group.key === 'buff')!
        expect(buffGroup.records).toHaveLength(1)
        expect(buffGroup.records[0]!.data.name).toBe('新buff')
    })

    it('leaves project unchanged when modId does not exist', () => {
        const project = makeProject()
        const result = applyGeneratedResultToProject(project, 'missing', {
            records: [{ group: 'buff', key: '200', data: { buffid: 200 } }],
            seidData: {},
        })
        expect(result).toEqual(project)
    })
})
