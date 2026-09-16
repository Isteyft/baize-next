import type { ProjectMod } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { appendSkillBookToMod, createSkillBookGeneration } from './skillBook'

describe('skill book generation', () => {
    it('creates a shenTong book with Affix2 and a skill Seid value', () => {
        const result = createSkillBookGeneration('shenTong', {
            key: '10',
            data: {
                id: 10,
                Skill_ID: 7,
                Skill_LV: 4,
                typePinJie: 3,
                name: '雷法',
                descr: '造成雷系伤害',
                Affix: [99],
                Affix2: [1, 2],
            },
        })

        expect(result).toEqual({
            item: {
                key: '7',
                data: {
                    id: 7,
                    ItemIcon: 3001,
                    maxNum: 1,
                    name: '雷法',
                    Affix: [1, 2],
                    TuJianType: 0,
                    ShopType: 99,
                    type: 3,
                    quality: 4,
                    typePinJie: 3,
                    seid: [1],
                    desc: '造成雷系伤害',
                    desc2: '造成雷系伤害',
                },
            },
            seidId: '1',
            seidValue: {
                id: 7,
                value1: 7,
            },
            skillId: 7,
        })
    })

    it('creates a static skill book with its own icon, type and Seid id', () => {
        const result = createSkillBookGeneration('skill', {
            key: '5',
            data: {
                id: 5,
                Skill_ID: 9,
                Skill_LV: 2,
                typePinJie: 1,
                name: '天刃诀',
                descr: '提升金系伤害',
                Affix: [31, 32],
            },
        })

        expect(result?.item.data).toMatchObject({
            id: 9,
            ItemIcon: 3002,
            maxNum: 1,
            name: '天刃诀',
            Affix: [31, 32],
            TuJianType: 0,
            ShopType: 99,
            type: 4,
            quality: 2,
            typePinJie: 1,
            seid: [2],
            desc: '提升金系伤害',
            desc2: '提升金系伤害',
        })
        expect(result?.seidId).toBe('2')
        expect(result?.seidValue).toEqual({ id: 9, value1: 9 })
    })

    it('appends the generated item and ItemsSeidJsonData value to the mod', () => {
        const mod: ProjectMod = {
            id: 'mod-test',
            name: 'modTest',
            groups: [
                {
                    key: 'skill',
                    label: '功法',
                    records: [
                        {
                            key: '5',
                            data: {
                                id: 5,
                                Skill_ID: 9,
                                Skill_LV: 2,
                                typePinJie: 1,
                                name: '天刃诀',
                                descr: '提升金系伤害',
                                Affix: [31, 32],
                            },
                        },
                    ],
                },
                { key: 'item', label: '物品', records: [] },
            ],
        }

        const result = appendSkillBookToMod(mod, 'skill', '5')

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('expected skill book generation to succeed')
        expect(result.mod.groups.find(group => group.key === 'item')?.records).toEqual([result.item])
        expect(result.mod.seidData?.itemUse?.['2']?.['9']).toEqual({ id: 9, value1: 9 })
        expect(mod.groups.find(group => group.key === 'item')?.records).toEqual([])
        expect(mod.seidData).toBeUndefined()
    })

    it('does not overwrite an existing item id or generate without Skill_ID', () => {
        const mod: ProjectMod = {
            id: 'mod-test',
            name: 'modTest',
            groups: [
                {
                    key: 'shenTong',
                    label: '神通',
                    records: [
                        { key: '10', data: { id: 10, Skill_ID: 7, name: '雷法', descr: '雷' } },
                        { key: '11', data: { id: 11, name: '缺少编号', descr: '无' } },
                    ],
                },
                { key: 'item', label: '物品', records: [{ key: '7', data: { id: 7, name: '已有物品' } }] },
            ],
        }

        expect(appendSkillBookToMod(mod, 'shenTong', '10')).toMatchObject({
            ok: false,
            reason: 'item-id-exists',
            skillId: 7,
        })
        expect(appendSkillBookToMod(mod, 'shenTong', '11')).toEqual({
            ok: false,
            reason: 'missing-skill-id',
        })
    })
})
