import type { JsonDataset } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { AI_COMMANDS, type AiCommand, buildCommandContext, filterAiCommands } from './aiCommands'

const ELEMENT_DATASET: JsonDataset = {
    id: 'element',
    name: 'ElementType',
    kind: 'file',
    records: [
        { key: '0', data: { Id: 0, Desc: 'Gold' } },
        { key: '1', data: { Id: 1, Desc: 'Wood' } },
    ],
}

const SKILL_SEID_DATASET: JsonDataset = {
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

const ITEM_TYPE_DATASET: JsonDataset = {
    id: 'item-type',
    name: 'ItemType',
    kind: 'file',
    records: [
        { key: '1', data: { Id: 1, Desc: '武器' } },
        { key: '2', data: { Id: 2, Desc: '丹药' } },
    ],
}

describe('AI_COMMANDS', () => {
    it('only contains record-generating commands, no standalone seid command', () => {
        const ids = AI_COMMANDS.map(command => command.id)
        expect(ids).not.toContain('seid')
        expect(ids).toEqual(expect.arrayContaining(['buff', 'skill', 'shenTong', 'item', 'wuDao', 'npcType']))
    })

    it('declares SeidMeta datasets for seid-bearing groups', () => {
        const skill = AI_COMMANDS.find(command => command.id === 'skill')!
        expect(skill.seidMetaDatasets).toContain('StaticSkillSeidMeta')
        const npcType = AI_COMMANDS.find(command => command.id === 'npcType')!
        expect(npcType.seidMetaDatasets).toBeUndefined()
    })

    it('declares extra SeidMeta datasets for cascaded dependencies (skill -> buff)', () => {
        const skill = AI_COMMANDS.find(command => command.id === 'skill')!
        expect(skill.extraSeidMetaDatasets?.buff).toContain('BuffSeidMeta')
    })
})

describe('filterAiCommands', () => {
    it('returns all commands for an empty query', () => {
        expect(filterAiCommands(AI_COMMANDS, '')).toHaveLength(AI_COMMANDS.length)
    })

    it('matches by keyword, label and id', () => {
        expect(filterAiCommands(AI_COMMANDS, '写功法')).toEqual([AI_COMMANDS.find(command => command.id === 'skill')])
        expect(filterAiCommands(AI_COMMANDS, 'buff')[0]?.id).toBe('buff')
    })

    it('returns empty for a non-matching query', () => {
        expect(filterAiCommands(AI_COMMANDS, '不存在的指令')).toHaveLength(0)
    })
})

describe('buildCommandContext', () => {
    it('builds field enum context for a group command', () => {
        const command = AI_COMMANDS.find(item => item.id === 'item')!
        const context = buildCommandContext(command, [ITEM_TYPE_DATASET])
        expect(context).toContain('目标分组：item')
        expect(context).toContain('字段枚举说明')
        expect(context).toContain('type')
        expect(context).toContain('武器')
    })

    it('injects SeidMeta definitions for seid-bearing groups', () => {
        const command = AI_COMMANDS.find(item => item.id === 'shenTong')!
        const context = buildCommandContext(command, [SKILL_SEID_DATASET, ELEMENT_DATASET], {
            buff: [],
            skill: [],
            staticSkill: [],
            item: [],
        })
        expect(context).toContain('可用 Seid 定义')
        expect(context).toContain('Seid id=7')
        expect(context).toContain('Element array')
        expect(context).toContain('value1')
        expect(context).toContain('可选值：0 / 1')
    })

    it('does not include Seid section for groups without seid', () => {
        const command = AI_COMMANDS.find(item => item.id === 'npcType')!
        const context = buildCommandContext(command, [])
        expect(context).not.toContain('可用 Seid 定义')
    })

    it('injects extra Seid definitions for cascaded dependencies with their dataKey', () => {
        const buffSeidDataset: JsonDataset = {
            id: 'buff-seid',
            name: 'BuffSeidMeta',
            kind: 'file',
            records: [
                {
                    key: '1',
                    data: {
                        ID: 1,
                        IDName: 'buffid',
                        Name: 'Buff effect',
                        Desc: 'Buff test',
                        Properties: [{ ID: 'value1', Type: 'Int', Desc: 'Amount' }],
                    },
                },
            ],
        }
        const command = AI_COMMANDS.find(item => item.id === 'skill')!
        const context = buildCommandContext(command, [buffSeidDataset])
        expect(context).toContain('依赖记录可用 Seid 定义（dataKey=`buff`）')
        expect(context).toContain('Seid id=1「Buff effect」')
        expect(context).toContain('dataKey=`buff`')
    })

    it('guides tool-based generation with cascading dependencies', () => {
        const command = AI_COMMANDS.find(item => item.id === 'skill')!
        const context = buildCommandContext(command, [])
        expect(context).toContain('生成方式（使用工具）')
        expect(context).toContain('create_record')
        expect(context).toContain('write_seid')
        expect(context).toContain('递归')
        expect(context).toContain('ask_user')
    })

    it('injects field schema so AI uses real field names (e.g. name not skillName)', () => {
        const command = AI_COMMANDS.find(item => item.id === 'skill')!
        const context = buildCommandContext(command, [])
        expect(context).toContain('字段 schema')
        expect(context).toContain('请严格使用以下字段名生成记录')
        // 功法名字段是 name，主键是 id。
        expect(context).toMatch(/- name（字符串）/)
        expect(context).toContain('- id（数字）：记录主键，务必填写')
    })

    it('injects custom prompt section when a command has a non-empty customPrompt', () => {
        const command: AiCommand = { ...AI_COMMANDS.find(item => item.id === 'skill')!, customPrompt: '偏好火属性攻击型功法' }
        const context = buildCommandContext(command, [])
        expect(context).toContain('## 自定义提示')
        expect(context).toContain('偏好火属性攻击型功法')
        // 自定义提示应注入在任务说明之后、目标分组之前。
        expect(context.indexOf('## 自定义提示')).toBeLessThan(context.indexOf('## 目标分组'))
    })

    it('does not include custom prompt section for empty customPrompt', () => {
        const command = AI_COMMANDS.find(item => item.id === 'npcType')!
        const context = buildCommandContext(command, [])
        expect(context).not.toContain('## 自定义提示')
    })
})
