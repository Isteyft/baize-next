import type { JsonDataset } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { parseProjectFromEntries, type ProjectFileEntry, serializeProjectFiles } from './json'
import {
    createSeidParameterRecord,
    filterSeidDefinitions,
    getItemSeidDataKey,
    getSeidDataKey,
    getSeidDefinitions,
    getSeidMetaDatasetName,
    getSeidPropertyOptions,
    isSeidMultiSelect,
} from './seid'

const ELEMENT_DATASET: JsonDataset = {
    id: 'element',
    name: 'ElementType',
    kind: 'file',
    records: [
        { key: '0', data: { Id: 0, Desc: 'Gold' } },
        { key: '1', data: { Id: 1, Desc: 'Wood' } },
    ],
}

const SEID_DATASET: JsonDataset = {
    id: 'skill-seid',
    name: 'SkillSeidMeta',
    kind: 'file',
    records: [
        {
            key: '7',
            data: {
                ID: 7,
                IDName: 'skillid',
                Name: 'Element array',
                Desc: 'Element test',
                Properties: [{ ID: 'value1', Type: 'IntArray', Desc: 'Elements', SpecialDrawer: ['ElementTypeArrayDrawer'] }],
            },
        },
    ],
}

describe('Seid data mapping', () => {
    it('selects item equip meta only for types 0, 1 and 2', () => {
        expect(getItemSeidDataKey({ type: 0 })).toBe('itemEquip')
        expect(getItemSeidDataKey({ type: 1 })).toBe('itemEquip')
        expect(getItemSeidDataKey({ type: 2 })).toBe('itemEquip')
        expect(getItemSeidDataKey({ type: 3 })).toBe('itemUse')
        expect(getItemSeidDataKey({})).toBe('itemUse')
        expect(getSeidMetaDatasetName('item', { type: 1 })).toBe('ItemEquipSeidMeta')
        expect(getSeidMetaDatasetName('item', { type: 4 })).toBe('ItemUseSeidMeta')
        expect(getSeidDataKey('shenTong', {})).toBe('skill')
        expect(getSeidDataKey('skill', {})).toBe('staticSkill')
    })

    it('parses Seid definitions and SpecialDrawer options', () => {
        const definitions = getSeidDefinitions([SEID_DATASET], 'SkillSeidMeta')
        expect(definitions).toEqual([
            {
                id: 7,
                name: 'Element array',
                description: 'Element test',
                idField: 'skillid',
                properties: [{ id: 'value1', type: 'IntArray', description: 'Elements', drawers: ['ElementTypeArrayDrawer'] }],
            },
        ])

        const options = getSeidPropertyOptions(
            definitions[0]!.properties[0]!,
            [ELEMENT_DATASET],
            { buff: [], skill: [], staticSkill: [], item: [] },
            definitions
        )
        expect(options).toEqual([
            { id: 0, value: '0', label: '0 Gold' },
            { id: 1, value: '1', label: '1 Wood' },
        ])
        expect(isSeidMultiSelect(definitions[0]!.properties[0]!, options)).toBe(true)
    })

    it('uses loaded records for Buff, Skill and StaticSkill drawers', () => {
        const property = { id: 'value1', type: 'Int', description: 'Target', drawers: ['SkillDrawer'] }
        const options = getSeidPropertyOptions(
            property,
            [ELEMENT_DATASET],
            {
                buff: [{ key: '10', data: { buffid: 10, name: 'Buff A' } }],
                skill: [{ key: '20', data: { id: 20, name: 'Skill A' } }],
                staticSkill: [{ key: '30', data: { id: 30, name: 'Static A' } }],
                item: [{ key: '40', data: { id: 40, name: 'Item A' } }],
            },
            []
        )
        expect(options).toEqual([{ id: 20, value: '20', label: '20 Skill A' }])
    })

    it('creates default values and identity fields for a parameter record', () => {
        const definition = getSeidDefinitions([SEID_DATASET], 'SkillSeidMeta')[0]!
        expect(createSeidParameterRecord(definition, '100')).toEqual({ skillid: 100, value1: [] })
    })

    it('loads and serializes all Seid data directories', async () => {
        const entries: ProjectFileEntry[] = [
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/100.json',
                content: '{"buffid":100,"seid":[1]}',
            },
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/BuffSeidJsonData/1.json',
                content: '{"100":{"id":100,"value1":2}}',
            },
        ]
        const project = await parseProjectFromEntries('D:\\games\\Editor', entries)
        expect(project.mods[0]?.seidData?.buff?.['1']?.['100']).toEqual({ id: 100, value1: 2 })

        const writes = serializeProjectFiles(project)
        const seidWrite = writes.find(write => write.relativePath.endsWith('BuffSeidJsonData/1.json'))
        expect(seidWrite?.relativePath).toBe('plugins/Next/_/mod_demo/Data/BuffSeidJsonData/1.json')
        expect(seidWrite?.content).toContain('"value1": 2')
    })
    it('supports string-id operator SpecialDrawers', () => {
        const comparisonDataset: JsonDataset = {
            id: 'comparison',
            name: 'ComparisonOperatorType',
            kind: 'file',
            records: [{ key: '>', data: { TypeStrID: '>', TypeName: 'Greater than' } }],
        }
        const property = { id: 'panduan', type: 'String', description: 'Operator', drawers: ['ComparisonOperatorTypeDrawer'] }
        const options = getSeidPropertyOptions(property, [comparisonDataset], { buff: [], skill: [], staticSkill: [], item: [] }, [])
        expect(options).toEqual([{ id: '>', value: '>', label: '> Greater than' }])
    })
    it('filters Seid definitions by id, name and description', () => {
        const definitions = getSeidDefinitions([SEID_DATASET], 'SkillSeidMeta')
        expect(filterSeidDefinitions(definitions, '7')).toHaveLength(1)
        expect(filterSeidDefinitions(definitions, 'element')).toHaveLength(1)
        expect(filterSeidDefinitions(definitions, 'test')).toHaveLength(1)
        expect(filterSeidDefinitions(definitions, 'missing')).toHaveLength(0)
    })
})
