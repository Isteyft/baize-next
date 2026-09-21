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
    getRecordSelectOptions,
    getShenTongSkillSelectOptions,
    isRecordMap,
    isRecordObject,
    mergeMetaDatasets,
    META_DATASET_NAMES,
    parseJsonContent,
    parseMetaJsonEntry,
    parseModPreloadJsonEntry,
    parseProjectFromEntries,
    type ProjectFileEntry,
    projectNameFromPath,
    resolveModIconPath,
    resolveProjectRecordRelativePath,
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
                relativePath: 'plugins/Next/_/mod_demo/Data/WuDaoAllTypeJson.json',
                content: '{"1":{"id":1,"name":"金","name1":"金之道"}}',
            },
            {
                relativePath: 'plugins/Next/_/mod_demo/Data/WuDaoJson.json',
                content:
                    '{"101":{"id":101,"icon":"101","name":"御金","Cast":1,"Type":[1],"Lv":1,"seid":[1],"desc":"desc","xiaoguo":"effect","CanForget":0}}',
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
        expect(mod.groups.find(group => group.key === 'wuDaoAllType')?.records).toEqual([
            { key: '1', data: { id: 1, name: '金', name1: '金之道' } },
        ])
        expect(mod.groups.find(group => group.key === 'wuDao')?.records).toEqual([
            {
                key: '101',
                data: {
                    id: 101,
                    icon: '101',
                    name: '御金',
                    Cast: 1,
                    Type: [1],
                    Lv: 1,
                    seid: [1],
                    desc: 'desc',
                    xiaoguo: 'effect',
                    CanForget: 0,
                },
            },
        ])
    })

    it('points to the exact corrupted file when a middle file fails to load', async () => {
        const entries: ProjectFileEntry[] = [
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/100.json', content: '{"buffid":100,"name":"Power"}' },
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/config_01.json', content: '{"buffid":1,' },
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/200.json', content: '{"buffid":200,"name":"Guard"}' },
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/300.json', content: '{"buffid":300,"name":"Haste"}' },
        ]

        await expect(parseProjectFromEntries('D:\\games\\Editor', entries)).rejects.toThrow(/config_01\.json\n项目：Editor\nJSON 语法错误/)
    })

    it('aggregates multiple failed files into one summary error', async () => {
        const entries: ProjectFileEntry[] = [
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/100.json', content: '{"buffid":100,"name":"Power"}' },
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/200.json', content: '{"buffid":200,' },
            { relativePath: 'plugins/Next/_/mod_demo/Data/BuffJsonData/300.json', content: '{"buffid":300' },
        ]

        await expect(parseProjectFromEntries('D:\\games\\Editor', entries)).rejects.toThrowError(
            /BuffJsonData\/200\.json\n项目：Editor\nJSON 语法错误/
        )
        await expect(parseProjectFromEntries('D:\\games\\Editor', entries)).rejects.toThrowError(
            /BuffJsonData\/300\.json\n项目：Editor\nJSON 语法错误/
        )
    })
    it('parses meta entries by file name', () => {
        const dataset = parseMetaJsonEntry({
            relativePath: 'plugins/Next/_/mod_demo/Data/example.json',
            content: '[{"id":"one"}]',
        })

        expect(dataset.name).toBe('example')
        expect(dataset.records[0]?.key).toBe('one')
    })

    it('merges same-name meta datasets and lets later records override duplicate business ids', () => {
        const datasets = [
            parseMetaJsonEntry({
                relativePath: 'base/Data/Meta/AttackType.json',
                content: '[{"Id":0,"Desc":"old"},{"Id":1,"Desc":"melee"}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'patch/Data/Meta/AttackType.json',
                content: '[{"Id":0,"Desc":"new"},{"Id":2,"Desc":"ranged"}]',
            }),
            parseMetaJsonEntry({
                relativePath: 'patch/Data/Meta/BuffType.json',
                content: '[{"TypeID":1,"TypeName":"buff"}]',
            }),
        ]

        const merged = mergeMetaDatasets(datasets)

        expect(merged.map(dataset => dataset.name)).toEqual(['AttackType', 'BuffType'])
        expect(merged[0]?.id).toBe(datasets[0]?.id)
        expect(merged[0]?.records.map(record => record.data)).toEqual([
            { Id: 0, Desc: 'new' },
            { Id: 1, Desc: 'melee' },
            { Id: 2, Desc: 'ranged' },
        ])
        expect(datasets[0]?.records).toHaveLength(2)
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
            parseMetaJsonEntry({ relativePath: 'Data/Meta/AttackType.json', content: '[{"Id":0,"Desc":"金"}]' }),
            parseMetaJsonEntry({ relativePath: 'Data/Meta/SkillPhase.json', content: '[{"Id":4,"Desc":"瞬发"}]' }),
        ]

        expect(getGroupEnumOptions('item', 'TuJianType', datasets)).toEqual([{ value: '4', label: '4 丹药', id: 4 }])
        expect(getGroupEnumOptions('item', 'typePinJie', datasets)).toEqual([{ value: '2', label: '2 中品', id: 2 }])
        expect(getGroupEnumOptions('skill', 'typePinJie', datasets)).toEqual([{ value: '2', label: '2 中品', id: 2 }])
        expect(getGroupEnumOptions('skill', 'Skill_LV', datasets)).toEqual([{ value: '3', label: '3 天阶', id: 3 }])
        expect(getGroupEnumOptions('skill', 'qingjiaotype', datasets)).toEqual([{ value: '7', label: '7 无法请教', id: 7 }])
        expect(getGroupEnumOptions('shenTong', 'TuJianType', datasets)).toEqual([{ value: '7', label: '7 功法', id: 7 }])
        expect(getGroupEnumOptions('shenTong', 'AttackType', datasets)).toEqual([{ value: '0', label: '0 金', id: 0 }])
        expect(getGroupEnumOptions('shenTong', 'Skill_Type', datasets)).toEqual([])
        expect(getGroupEnumOptions('npcType', 'AttackType', datasets)).toEqual([])
        expect(getGroupEnumOptions('npcType', 'DefenseType', datasets)).toEqual([])
    })

    it('builds local boolean enum options with the requested value meaning', () => {
        expect(getGroupEnumOptions('item', 'NPCCanUse', [])).toEqual([])
        expect(getGroupEnumOptions('npcType', 'canjiaPaiMai', [])).toEqual([])
        expect(getGroupEnumOptions('npcType', 'AvatarType', [])).toEqual([
            { value: '1', label: '1 人', id: 1 },
            { value: '2', label: '2 妖', id: 2 },
            { value: '3', label: '3 魔', id: 3 },
            { value: '4', label: '4 鬼', id: 4 },
        ])
        expect(getGroupEnumOptions('npcType', 'LingGen', [])).toEqual([])
    })

    it('groups shenTong options by Skill_ID and prefers the base level name', () => {
        const records: JsonRecord[] = [
            { key: '1', data: { id: 1, Skill_ID: 10, Skill_Lv: 1, name: '金刃1' } },
            { key: '2', data: { id: 2, Skill_ID: 10, Skill_Lv: 2, name: '金刃2' } },
            { key: '201', data: { id: 201, Skill_ID: 201, Skill_Lv: 1, name: '水刃' } },
            { key: 'missing', data: { id: 999, name: '无 Skill_ID' } },
        ]

        expect(getShenTongSkillSelectOptions(records)).toEqual([
            { value: '10', id: 10, label: '10 金刃1' },
            { value: '201', id: 201, label: '201 水刃' },
        ])
    })

    it('builds de-duplicated options from loaded skill records', () => {
        const records: JsonRecord[] = [
            { key: '1', data: { id: 1, name: '赤焰' } },
            { key: '201', data: { id: 201, name: '寒冰' } },
            { key: '1-duplicate', data: { id: 1, name: '重复' } },
            { key: 'no-id', data: { name: '无数值 id' } },
        ]

        expect(getRecordSelectOptions(records)).toEqual([
            { value: '1', id: 1, label: '1 赤焰' },
            { value: '201', id: 201, label: '201 寒冰' },
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
                        {
                            key: 'wuDaoAllType',
                            label: 'wuDaoAllType',
                            records: [{ key: '1', data: { id: 1, name: '金', name1: '金之道' } }],
                        },
                        {
                            key: 'wuDao',
                            label: 'wuDao',
                            records: [{ key: '101', data: { id: 101, name: '御金' } }],
                        },
                    ],
                },
            ],
        })

        const paths = writes.map(write => write.relativePath)
        expect(paths).toContain('plugins/Next/_/mod_demo/Config/modConfig.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/BuffJsonData/100.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/TuJianChunWenBen.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/WuDaoAllTypeJson.json')
        expect(paths).toContain('plugins/Next/_/mod_demo/Data/WuDaoJson.json')
        expect(writes.find(write => write.relativePath.endsWith('BuffJsonData/100.json'))?.content).toContain('"buffid": 100')
    })

    it('normalizes record types and fills complete fields when saving', () => {
        const writes = serializeProjectFiles({
            id: 'project',
            name: 'Demo',
            mods: [
                {
                    id: 'mod',
                    name: 'demo',
                    groups: [
                        {
                            key: 'item',
                            label: 'item',
                            records: [{ key: '7', data: { id: '7', name: 123, Affix: ['1', 'invalid', 2] } }],
                        },
                    ],
                },
            ],
        })

        const content = writes.find(write => write.relativePath.endsWith('ItemJsonData/7.json'))?.content
        expect(content).toBeTruthy()
        const saved = JSON.parse(content ?? '') as Record<string, unknown>
        expect(saved.id).toBe(7)
        expect(saved.name).toBe('')
        expect(saved.Affix).toEqual([1, 2])
        expect(saved.ItemIcon).toBe(0)
        expect(saved.ShuaXin).toBe(0)
    })
    it('resolves directory record paths for deletion', () => {
        expect(resolveProjectRecordRelativePath('demo', 'buff', '100')).toBe('plugins/Next/_/mod_demo/Data/BuffJsonData/100.json')
        expect(resolveProjectRecordRelativePath('demo', 'item', '7')).toBe('plugins/Next/_/mod_demo/Data/ItemJsonData/7.json')
        expect(resolveProjectRecordRelativePath('demo', 'npcType', '1')).toBeNull()
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
    it('resolves id based icons in each Assets icon directory when the icon field is zero', () => {
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 100, BuffIcon: 0 })).toBe('modDemo/Assets/buff icon/100.png')
        expect(resolveModIconPath('modDemo', 'item', { id: 7, ItemIcon: 0 })).toBe('modDemo/Assets/item icon/7.png')
    })

    it('uses Skill_ID for zero-valued skill and shenTong icons', () => {
        expect(resolveModIconPath('modDemo', 'shenTong', { id: 1, Skill_ID: 5, icon: 0 })).toBe('modDemo/Assets/skill icon/5.png')
        expect(resolveModIconPath('modDemo', 'skill', { id: 3, Skill_ID: 9, icon: 0 })).toBe('modDemo/Assets/staticskill icon/9.png')
    })

    it('uses the icon number when the icon field is not zero', () => {
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 5, BuffIcon: 42 })).toBe('modDemo/Assets/buff icon/42.png')
        expect(resolveModIconPath('modDemo', 'item', { id: 5, ItemIcon: 43 })).toBe('modDemo/Assets/item icon/43.png')
        expect(resolveModIconPath('modDemo', 'shenTong', { id: 5, Skill_ID: 1, icon: 44 })).toBe('modDemo/Assets/skill icon/44.png')
        expect(resolveModIconPath('modDemo', 'skill', { id: 5, Skill_ID: 1, icon: 45 })).toBe('modDemo/Assets/staticskill icon/45.png')
    })

    it('supports mod directories nested inside the project and normalizes separators', () => {
        expect(resolveModIconPath('plugins/Next/_/modDemo', 'item', { id: 7, ItemIcon: 0 })).toBe(
            'plugins/Next/_/modDemo/Assets/item icon/7.png'
        )
        expect(resolveModIconPath('plugins\\Next\\_\\modDemo\\', 'item', { id: 7, ItemIcon: 0 })).toBe(
            'plugins/Next/_/modDemo/Assets/item icon/7.png'
        )
    })

    it('returns null for unknown groups or invalid icon values', () => {
        expect(resolveModIconPath('modDemo', 'config', { icon: 0 })).toBeNull()
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 1 })).toBeNull()
        expect(resolveModIconPath('modDemo', 'shenTong', { id: 5, Skill_ID: 5 })).toBeNull()
        expect(resolveModIconPath('modDemo', 'buff', { buffid: 1, BuffIcon: 'x' })).toBeNull()
        expect(resolveModIconPath('modDemo', null, { buffid: 1, BuffIcon: 0 })).toBeNull()
        expect(resolveModIconPath('   ', 'buff', { buffid: 1, BuffIcon: 0 })).toBeNull()
    })
})
