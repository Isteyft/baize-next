import { type JsonRecord } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import {
    collectGroupRecords,
    collectRecordFields,
    createDatasetId,
    formatCellValue,
    getAffixProjectTypeOptions,
    getAffixSelectOptions,
    getAffixTypeOptions,
    getGroupEnumOptions,
    getMetaEnumLabel,
    getMetaEnumOptions,
    getMetaStringOptions,
    isRecordMap,
    isRecordObject,
    META_DATASET_NAMES,
    parseJsonContent,
    parseMetaJsonEntry,
    parseModPreloadJsonEntry,
    parseProjectFromEntries,
    type ProjectFileEntry,
    projectNameFromPath,
    resolveModIconPath,
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

    it('builds affix meta enum options from preloaded datasets', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/AffixProjectType.json',
                content: '[{"TypeName":"AffixProject","TypeNum":101}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/AffixType.json',
                content: '[{"TypeID":1,"TypeName":"Buff"}]',
            }),
        ]

        expect(getAffixProjectTypeOptions(datasets)).toEqual([
            { value: '101', label: 'AffixProject', typeNum: 101, typeName: 'AffixProject' },
        ])
        expect(getAffixTypeOptions(datasets)).toEqual([{ value: '1', label: 'Buff', typeId: 1, typeName: 'Buff' }])
    })

    it('builds meta enum options from preloaded Data/Meta datasets', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/AttackType.json',
                content: '[{"Id":0,"Desc":"金"},{"Id":1,"Desc":"木"},{"Id":2,"Desc":"水"}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/BuffType.json',
                content: '[{"TypeID":1,"TypeName":"负面buff"},{"TypeID":2,"TypeName":"正面buff"}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/BuffOverlayType.json',
                content: '[{"ID":0,"Desc":"叠加"},{"ID":1,"Desc":"覆盖"}]',
            }),
        ]

        expect(getMetaEnumOptions(datasets, META_DATASET_NAMES.attackType)).toEqual([
            { value: '0', label: '0 金', id: 0 },
            { value: '1', label: '1 木', id: 1 },
            { value: '2', label: '2 水', id: 2 },
        ])
        expect(getMetaEnumOptions(datasets, META_DATASET_NAMES.buffType)).toEqual([
            { value: '1', label: '1 负面buff', id: 1 },
            { value: '2', label: '2 正面buff', id: 2 },
        ])
        expect(getMetaEnumOptions(datasets, META_DATASET_NAMES.buffOverlayType)).toEqual([
            { value: '0', label: '0 叠加', id: 0 },
            { value: '1', label: '1 覆盖', id: 1 },
        ])
    })

    it('returns no meta enum options when the dataset is missing or malformed', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/AttackType.json',
                content: '[{"Id":0,"Desc":"金"},{"Desc":"缺少 Id"},{"Id":1}]',
            }),
        ]

        expect(getMetaEnumOptions(datasets, META_DATASET_NAMES.buffType)).toEqual([])
        expect(getMetaEnumOptions(datasets, META_DATASET_NAMES.attackType)).toEqual([{ value: '0', label: '0 金', id: 0 }])
    })

    it('reads meta enum labels for cell display', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/ItemType.json',
                content: '[{"Id":0,"Desc":"武器"},{"Id":5,"Desc":"丹药"}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/ItemPhaseType.json',
                content: '[{"Id":0,"Desc":"无"},{"Id":1,"Desc":"下品"}]',
            }),
        ]

        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemType, 5)).toBe('丹药')
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemType, '5')).toBe('丹药')
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemType, 99)).toBeNull()
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemPhaseType, 1)).toBe('下品')
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemShopType, 1)).toBeNull()
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemType, '武器')).toBeNull()
        expect(getMetaEnumLabel(datasets, META_DATASET_NAMES.itemType, [0])).toBeNull()
    })

    it('maps item and skill fields to their requested meta datasets', () => {
        const datasets = [
            parseMetaJsonEntry({ relativePath: 'Data/Meta/ItemGuideType.json', content: '[{"Id":4,"Desc":"丹药"}]' }),
            parseMetaJsonEntry({ relativePath: 'Data/Meta/ItemPhaseType.json', content: '[{"Id":2,"Desc":"中品"}]' }),
            parseMetaJsonEntry({ relativePath: 'Data/Meta/SkillQuality.json', content: '[{"Id":3,"Desc":"天阶"}]' }),
            parseMetaJsonEntry({ relativePath: 'Data/Meta/SkillConsultType.json', content: '[{"Id":7,"Desc":"无法请教"}]' }),
            parseMetaJsonEntry({ relativePath: 'Data/Meta/GuideType.json', content: '[{"Id":7,"Desc":"功法"}]' }),
        ]

        expect(getGroupEnumOptions('item', 'TuJianType', datasets)).toEqual([{ value: '4', label: '4 丹药', id: 4 }])
        expect(getGroupEnumOptions('item', 'typePinJie', datasets)).toEqual([{ value: '2', label: '2 中品', id: 2 }])
        expect(getGroupEnumOptions('skill', 'typePinJie', datasets)).toEqual([{ value: '2', label: '2 中品', id: 2 }])
        expect(getGroupEnumOptions('skill', 'Skill_LV', datasets)).toEqual([{ value: '3', label: '3 天阶', id: 3 }])
        expect(getGroupEnumOptions('skill', 'qingjiaotype', datasets)).toEqual([{ value: '7', label: '7 无法请教', id: 7 }])
        expect(getGroupEnumOptions('shenTong', 'TuJianType', datasets)).toEqual([{ value: '7', label: '7 功法', id: 7 }])
    })

    it('builds local boolean enum options with the requested value meaning', () => {
        expect(getGroupEnumOptions('item', 'NPCCanUse', [])).toEqual([
            { value: '0', label: '0 否', id: 0 },
            { value: '1', label: '1 是', id: 1 },
        ])
        expect(getGroupEnumOptions('npcType', 'canjiaPaiMai', [])).toEqual([
            { value: '0', label: '0 是', id: 0 },
            { value: '1', label: '1 否', id: 1 },
        ])
    })

    it('builds affix selection options from loaded TuJianChunWenBen records', () => {
        const records: JsonRecord[] = [
            { key: '270000', data: { id: 270000, name1: 'project', typenum: 101, type: 1, name2: 'Affix A', descr: 'desc' } },
            { key: '270001', data: { id: 270001, name1: 'project', typenum: 101, type: 1, name2: 'Affix B' } },
            { key: 'dup', data: { id: 270000, name1: 'dup', typenum: 0, type: 0, name2: 'Dup' } },
            { key: 'no-id', data: { name2: 'No id' } },
        ]

        expect(getAffixSelectOptions(records)).toEqual([
            expect.objectContaining({ id: 270000, label: 'Affix A', typenum: 101, type: 1, descr: 'desc' }),
            expect.objectContaining({ id: 270001, label: 'Affix B', typenum: 101, type: 1, descr: '' }),
        ])
    })

    it('collects tuJianChunWenBen records from loaded projects', () => {
        const project = parseModPreloadJsonEntry({
            relativePath: 'preload.json',
            content: '[{"id":1,"name2":"Affix A"}]',
        })

        expect(collectGroupRecords(project, 'preload')).toHaveLength(1)
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

describe('skill attack script enum', () => {
    it('builds string enum options from the SkillAttackScriptType meta dataset', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'Data/Meta/SkillAttackScriptType.json',
                content: '[{"Id":"SkillAttack","Desc":"对方"},{"Id":"SkillSelf","Desc":"自身"}]',
            }),
        ]

        expect(getMetaStringOptions(datasets, META_DATASET_NAMES.skillAttackScriptType)).toEqual([
            { value: 'SkillAttack', label: 'SkillAttack 对方' },
            { value: 'SkillSelf', label: 'SkillSelf 自身' },
        ])
    })

    it('returns no options when the dataset is missing or numeric', () => {
        const datasets = [parseMetaJsonEntry({ relativePath: 'Data/Meta/AttackType.json', content: '[{"Id":0,"Desc":"金"}]' })]

        expect(getMetaStringOptions(datasets, META_DATASET_NAMES.skillAttackScriptType)).toEqual([])
        expect(getMetaStringOptions(datasets, META_DATASET_NAMES.attackType)).toEqual([])
    })
})

describe('mod icon path resolution', () => {
    it('resolves id based icons when the icon field is zero', () => {
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 100, BuffIcon: 0 })).toBe('modDemo/Assets/100.png')
        expect(resolveModIconPath('modDemo', 'item', { id: 7, ItemIcon: 0 })).toBe('modDemo/Assets/7.png')
    })

    it('uses Skill_ID for skill and shenTong icons', () => {
        expect(resolveModIconPath('modDemo', 'shenTong', { id: 1, Skill_ID: 5, icon: 42 })).toBe('modDemo/Assets/5.png')
        expect(resolveModIconPath('modDemo', 'skill', { id: 3, Skill_ID: 9, icon: 0 })).toBe('modDemo/Assets/9.png')
    })

    it('falls back to common identifier fields for the zero case', () => {
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 5, BuffIcon: 0 })).toBe('modDemo/Assets/5.png')
        expect(resolveModIconPath('modDemo', 'shenTong', { id: 5, icon: 0 })).toBeNull()
    })

    it('supports mod directories nested inside the project and normalizes separators', () => {
        expect(resolveModIconPath('plugins/Next/_/modDemo', 'item', { id: 7, ItemIcon: 0 })).toBe('plugins/Next/_/modDemo/Assets/7.png')
        expect(resolveModIconPath('plugins\\Next\\_\\modDemo\\', 'item', { id: 7, ItemIcon: 0 })).toBe(
            'plugins/Next/_/modDemo/Assets/7.png'
        )
    })

    it('returns null for unknown groups or invalid icon values', () => {
        expect(resolveModIconPath('modDemo', 'config', { icon: 0 })).toBeNull()
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 1 })).toBeNull()
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 1, BuffIcon: 'x' })).toBeNull()
        expect(resolveModIconPath('modDemo', null, { buffid: 1, BuffIcon: 0 })).toBeNull()
        expect(resolveModIconPath('   ', 'buff', { buffid: 1, BuffIcon: 0 })).toBeNull()
    })
})
