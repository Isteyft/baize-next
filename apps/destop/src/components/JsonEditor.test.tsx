import type { JsonDataset } from '@baize-next/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { JsonEditor } from './JsonEditor'

describe('JsonEditor', () => {
    it('renders field inputs and commits string changes', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { name: 'alpha', count: 3 } }} onUpdate={onUpdate} />)

        const nameInput = screen.getByDisplayValue('alpha')
        fireEvent.change(nameInput, { target: { value: 'beta' } })
        expect(onUpdate).toHaveBeenCalledWith('a', 'name', 'beta')
    })

    it('renders all description fields as multiline text fields', () => {
        const onUpdate = vi.fn()
        render(
            <JsonEditor
                groupKey={null}
                record={{
                    key: 'a',
                    data: {
                        name: 'alpha',
                        desc: 'first',
                        descr: 'second',
                        desc2: 'third',
                        TuJiandescr: 'fourth',
                        Description: 'fifth',
                    },
                }}
                onUpdate={onUpdate}
            />
        )

        for (const value of ['first', 'second', 'third', 'fourth', 'fifth']) {
            const textarea = screen.getByDisplayValue(value)
            expect(textarea.tagName).toBe('TEXTAREA')
            expect((textarea as HTMLTextAreaElement).rows).toBe(4)
        }

        const description = screen.getByDisplayValue('first')
        fireEvent.change(description, { target: { value: 'first line\nsecond line' } })
        expect(onUpdate).toHaveBeenCalledWith('a', 'desc', 'first line\nsecond line')
    })

    it('hides the name1 field for tuJianChunWenBen records', () => {
        const onUpdate = vi.fn()
        render(
            <JsonEditor
                groupKey="tuJianChunWenBen"
                record={{ key: '1', data: { name1: 'hidden-text', name2: 'visible-text' } }}
                onUpdate={onUpdate}
            />
        )

        expect(screen.getByDisplayValue('visible-text')).toBeTruthy()
        expect(screen.queryByDisplayValue('hidden-text')).toBeNull()
    })

    it('uses meta datasets as enum controls for tuJianChunWenBen fields', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'affix-project-type',
                name: 'AffixProjectType',
                kind: 'file',
                records: [
                    { key: '101', data: { TypeName: 'AffixProject', TypeNum: 101 } },
                    { key: '104', data: { TypeName: 'Shortcut', TypeNum: 104 } },
                ],
            },
            {
                id: 'affix-type',
                name: 'AffixType',
                kind: 'file',
                records: [
                    { key: '0', data: { TypeID: 0, TypeName: 'None' } },
                    { key: '1', data: { TypeID: 1, TypeName: 'Buff' } },
                ],
            },
        ]
        render(
            <JsonEditor
                groupKey="tuJianChunWenBen"
                record={{ key: '1', data: { id: 1, name1: 'AffixProject', typenum: 101, type: 1 } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '词缀项目（AffixProject）' }))
        fireEvent.click(screen.getByText('Shortcut'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'typenum', 104)
        expect(onUpdate).toHaveBeenCalledWith('1', 'name1', 'Shortcut')

        fireEvent.click(screen.getByRole('button', { name: '指示物（Buff）' }))
        fireEvent.click(screen.getByText('None'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'type', 0)
    })

    it('commits object json values on blur', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { config: { enabled: false } } }} onUpdate={onUpdate} />)

        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: '{"enabled": true}' } })
        fireEvent.blur(textarea)
        expect(onUpdate).toHaveBeenCalledWith('a', 'config', { enabled: true })
    })

    it('edits array items in a table and commits changes', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { numbers: [1, 2] } }} onUpdate={onUpdate} />)

        const numberInputs = screen.getAllByRole('textbox')
        expect(numberInputs).toHaveLength(2)
        expect(numberInputs.every(input => input.getAttribute('type') === 'text')).toBe(true)
        fireEvent.change(numberInputs[0]!, { target: { value: '10' } })
        expect(onUpdate).toHaveBeenCalledWith('a', 'numbers', [10, 2])
    })

    it('adds and removes array items', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { numbers: [1, 2] } }} onUpdate={onUpdate} />)

        fireEvent.click(screen.getByRole('button', { name: '添加数组项' }))
        expect(onUpdate).toHaveBeenCalledWith('a', 'numbers', [1, 2, 0])

        fireEvent.click(screen.getByRole('button', { name: '移除第 1 项' }))
        expect(onUpdate).toHaveBeenCalledWith('a', 'numbers', [2])
    })

    it('adds a default numeric item to an empty array', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { numbers: [] } }} onUpdate={onUpdate} />)

        fireEvent.click(screen.getByRole('button', { name: '添加数组项' }))
        expect(onUpdate).toHaveBeenCalledWith('a', 'numbers', [0])
    })

    it('opens affix picker and commits selected affix ids', () => {
        const onUpdate = vi.fn()
        const affixRecords = [
            { key: '270000', data: { id: 270000, name1: 'project', typenum: 101, type: 1, name2: 'Affix A', descr: 'desc A' } },
            { key: '270001', data: { id: 270001, name1: 'project', typenum: 101, type: 1, name2: 'Affix B', descr: 'desc B' } },
        ]
        render(
            <JsonEditor
                groupKey="buff"
                record={{ key: '1', data: { buffid: 1, name: 'Poison', Affix: [270000] } }}
                affixRecords={affixRecords}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '词缀（炼器）' }))
        expect(screen.getByRole('dialog')).toBeTruthy()
        fireEvent.click(screen.getByText('Affix B'))
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(onUpdate).toHaveBeenCalledWith('1', 'Affix', [270000, 270001])
    })

    it('renders buff isHide and ShowOnlyOne as 0|1 checkboxes', () => {
        const onUpdate = vi.fn()
        render(
            <JsonEditor
                groupKey="buff"
                record={{ key: '1', data: { buffid: 1, name: 'Poison', isHide: 1, ShowOnlyOne: 0 } }}
                onUpdate={onUpdate}
            />
        )

        const hideCheckbox = screen.getByRole('checkbox', { name: '是否隐藏（0不，1）' })
        expect((hideCheckbox as HTMLInputElement).checked).toBe(true)
        fireEvent.click(hideCheckbox)
        expect(onUpdate).toHaveBeenCalledWith('1', 'isHide', 0)

        const showOneCheckbox = screen.getByRole('checkbox', { name: '只显示1层（0/不填 正常显示 1 永远只显示一层）' })
        expect((showOneCheckbox as HTMLInputElement).checked).toBe(false)
        fireEvent.click(showOneCheckbox)
        expect(onUpdate).toHaveBeenCalledWith('1', 'ShowOnlyOne', 1)
    })

    it('renders buff meta fields as enum selects backed by Data/Meta', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'buff-type',
                name: 'BuffType',
                kind: 'file',
                records: [
                    { key: '1', data: { TypeID: 1, TypeName: '负面buff' } },
                    { key: '2', data: { TypeID: 2, TypeName: '正面buff' } },
                ],
            },
            {
                id: 'buff-overlay-type',
                name: 'BuffOverlayType',
                kind: 'file',
                records: [
                    { key: '0', data: { ID: 0, Desc: '叠加' } },
                    { key: '1', data: { ID: 1, Desc: '覆盖' } },
                ],
            },
            {
                id: 'buff-trigger-type',
                name: 'BuffTriggerType',
                kind: 'file',
                records: [{ key: '1', data: { ID: 1, Desc: '回合结束时触发' } }],
            },
            {
                id: 'buff-remove-trigger-type',
                name: 'BuffRemoveTriggerType',
                kind: 'file',
                records: [{ key: '1', data: { TypeID: 1, TypeName: '触发后移除一层' } }],
            },
        ]
        render(
            <JsonEditor
                groupKey="buff"
                record={{
                    key: '1',
                    data: { buffid: 1, name: 'Poison', bufftype: 1, BuffType: 0, trigger: 1, removeTrigger: 1 },
                }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        expect(screen.getByRole('button', { name: 'buff类型（1 负面buff）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '叠加类型(0叠加,1覆盖,2增加，3放技能)（0 叠加）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '触发类型（1 回合结束时触发）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '移除类型（1 触发后移除一层）' })).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: '叠加类型(0叠加,1覆盖,2增加，3放技能)（0 叠加）' }))
        fireEvent.click(screen.getByText('1 覆盖'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'BuffType', 1)
    })

    it('keeps non meta numeric fields as plain text inputs', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'buff-type',
                name: 'BuffType',
                kind: 'file',
                records: [
                    { key: '1', data: { TypeID: 1, TypeName: '负面buff' } },
                    { key: '2', data: { TypeID: 2, TypeName: '正面buff' } },
                ],
            },
        ]
        render(
            <JsonEditor
                groupKey="buff"
                record={{ key: '1', data: { buffid: 1, name: 'Poison' } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        const numberInput = screen.getByDisplayValue('1')
        expect(numberInput.getAttribute('type')).toBe('text')
        expect(numberInput.getAttribute('inputmode')).toBe('decimal')
        fireEvent.change(numberInput, { target: { value: '7' } })
        expect(onUpdate).toHaveBeenCalledWith('1', 'buffid', 7)
    })

    it('renders item type, quality, phase and shop type as meta enum selects', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'item-type',
                name: 'ItemType',
                kind: 'file',
                records: [
                    { key: '0', data: { Id: 0, Desc: '武器' } },
                    { key: '5', data: { Id: 5, Desc: '丹药' } },
                ],
            },
            {
                id: 'item-quality-type',
                name: 'ItemQualityType',
                kind: 'file',
                records: [{ key: '1', data: { Id: 1, Desc: '一品（人阶）' } }],
            },
            {
                id: 'item-phase-type',
                name: 'ItemPhaseType',
                kind: 'file',
                records: [
                    { key: '0', data: { Id: 0, Desc: '无' } },
                    { key: '2', data: { Id: 2, Desc: '中品' } },
                ],
            },
            {
                id: 'item-shop-type',
                name: 'ItemShopType',
                kind: 'file',
                records: [{ key: '1', data: { Id: 1, Desc: '坊市武器' } }],
            },
            {
                id: 'item-guide-type',
                name: 'ItemGuideType',
                kind: 'file',
                records: [{ key: '4', data: { Id: 4, Desc: '丹药' } }],
            },
        ]
        render(
            <JsonEditor
                groupKey="item"
                record={{
                    key: '1',
                    data: { id: 1, name: '丹药', type: 5, quality: 1, typePinJie: 2, ShopType: 1, TuJianType: 4 },
                }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        expect(screen.getByRole('button', { name: '物品类型（5 丹药）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '物品品阶（1 一品（人阶））' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '物品品阶阶段（0无，1下品，2中品，3上品）（2 中品）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '商品类型（1 坊市武器）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '图鉴类型（1草药，2矿物，3妖兽材料，4丹药）（4 丹药）' })).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: '物品品阶阶段（0无，1下品，2中品，3上品）（2 中品）' }))
        fireEvent.click(screen.getByText('0 无'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'typePinJie', 0)
    })

    it('renders skill quality, consult type and phase as the requested meta enums', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'item-phase-type',
                name: 'ItemPhaseType',
                kind: 'file',
                records: [{ key: '2', data: { Id: 2, Desc: '中品' } }],
            },
            {
                id: 'skill-quality',
                name: 'SkillQuality',
                kind: 'file',
                records: [{ key: '3', data: { Id: 3, Desc: '天阶' } }],
            },
            {
                id: 'skill-consult-type',
                name: 'SkillConsultType',
                kind: 'file',
                records: [{ key: '7', data: { Id: 7, Desc: '无法请教' } }],
            },
        ]
        render(
            <JsonEditor
                groupKey="skill"
                record={{ key: '1', data: { id: 1, typePinJie: 2, Skill_LV: 3, qingjiaotype: 7 } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        expect(screen.getByRole('button', { name: '功法技能品阶（2 中品）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '技能等阶（3 天阶）' })).toBeTruthy()
        expect(screen.getByRole('button', { name: '功法请教类型（7 无法请教）' })).toBeTruthy()
    })

    it('renders item CanSale and NPCCanUse as DF-like checkboxes', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="item" record={{ key: '1', data: { id: 1, CanSale: 0, NPCCanUse: 1 } }} onUpdate={onUpdate} />)

        const canSale = screen.getByRole('checkbox', { name: '是否可出售(0或不填可出售，1不可出售)' })
        expect((canSale as HTMLInputElement).checked).toBe(true)
        fireEvent.click(canSale)
        expect(onUpdate).toHaveBeenCalledWith('1', 'CanSale', 1)

        const npcCanUse = screen.getByRole('checkbox', { name: 'NPC是否能使用（0否，1是）' })
        expect((npcCanUse as HTMLInputElement).checked).toBe(true)
        fireEvent.click(npcCanUse)
        expect(onUpdate).toHaveBeenCalledWith('1', 'NPCCanUse', 0)
    })

    it('renders canjiaPaiMai as an inverted checkbox and NPC attack/defense as plain text inputs', () => {
        const onUpdate = vi.fn()
        render(
            <JsonEditor
                groupKey="npcType"
                record={{ key: '2', data: { id: 2, canjiaPaiMai: 0, AttackType: 3, DefenseType: 10 } }}
                onUpdate={onUpdate}
            />
        )

        const checkbox = screen.getByRole('checkbox', { name: '是否参加拍卖（0是，1否）' })
        expect((checkbox as HTMLInputElement).checked).toBe(true)
        fireEvent.click(checkbox)
        expect(onUpdate).toHaveBeenCalledWith('2', 'canjiaPaiMai', 1)

        fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '4' } })
        expect(onUpdate).toHaveBeenCalledWith('2', 'AttackType', 4)
        fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '11' } })
        expect(onUpdate).toHaveBeenCalledWith('2', 'DefenseType', 11)
    })

    it('selects shenTong AttackType attributes in a dialog table', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'attack-type',
                name: 'AttackType',
                kind: 'file',
                records: [
                    { key: '0', data: { Id: 0, Desc: '金' } },
                    { key: '2', data: { Id: 2, Desc: '水' } },
                ],
            },
        ]
        render(
            <JsonEditor
                groupKey="shenTong"
                record={{ key: '1', data: { id: 1, name: '金刃', AttackType: [0] } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '攻击类型' }))
        expect(screen.getByRole('dialog', { name: '攻击类型' })).toBeTruthy()
        expect(screen.getByText('属性')).toBeTruthy()
        fireEvent.click(screen.getByRole('checkbox', { name: '选择 0 金' }))
        fireEvent.click(screen.getByRole('checkbox', { name: '选择 2 水' }))
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(onUpdate).toHaveBeenCalledWith('1', 'AttackType', [2])
    })

    it('keeps shenTong Skill_Type as a plain text input', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'skill-phase',
                name: 'SkillPhase',
                kind: 'file',
                records: [{ key: '4', data: { Id: 4, Desc: '瞬发' } }],
            },
        ]
        render(
            <JsonEditor
                groupKey="shenTong"
                record={{ key: '1', data: { id: 1, name: '金刃', Skill_Type: 4 } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        expect(screen.queryByRole('button', { name: /技能释放优先级/ })).toBeNull()
        fireEvent.change(screen.getByDisplayValue('4'), { target: { value: '5' } })
        expect(onUpdate).toHaveBeenCalledWith('1', 'Skill_Type', 5)
    })

    it('renders skill AttackType as a StaticSkillType enum select', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'static-skill-type',
                name: 'StaticSkillType',
                kind: 'file',
                records: [
                    { key: '0', data: { Id: 0, Desc: '金' } },
                    { key: '6', data: { Id: 6, Desc: '遁术' } },
                ],
            },
        ]
        render(
            <JsonEditor
                groupKey="skill"
                record={{ key: '1', data: { id: 1, name: '天刃诀', AttackType: 0 } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '功法类型（0 金）' }))
        fireEvent.click(screen.getByText('6 遁术'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'AttackType', 6)
    })

    it('falls back to a plain number array when meta data is not preloaded', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="shenTong" record={{ key: '1', data: { AttackType: [0] } }} onUpdate={onUpdate} />)

        expect(screen.queryByRole('button', { name: /攻击类型/ })).toBeNull()
        const numberInputs = screen.getAllByRole('textbox')
        expect(numberInputs).toHaveLength(1)
        expect(numberInputs.every(input => input.getAttribute('type') === 'text')).toBe(true)
        fireEvent.change(numberInputs[0]!, { target: { value: '3' } })
        expect(onUpdate).toHaveBeenCalledWith('1', 'AttackType', [3])
    })

    it('renders skill DF as a 0|1 checkbox', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="skill" record={{ key: '1', data: { id: 1, name: 'Art', DF: 1 } }} onUpdate={onUpdate} />)

        const dfCheckbox = screen.getByRole('checkbox', { name: '斗法可见' })
        expect((dfCheckbox as HTMLInputElement).checked).toBe(true)
        fireEvent.click(dfCheckbox)
        expect(onUpdate).toHaveBeenCalledWith('1', 'DF', 0)
    })

    it('renders the skill script field as a SkillAttackScriptType string enum', () => {
        const onUpdate = vi.fn()
        const metaDatasets: JsonDataset[] = [
            {
                id: 'skill-attack-script-type',
                name: 'SkillAttackScriptType',
                kind: 'file',
                records: [
                    { key: 'SkillAttack', data: { Id: 'SkillAttack', Desc: '对方' } },
                    { key: 'SkillSelf', data: { Id: 'SkillSelf', Desc: '自身' } },
                ],
            },
        ]
        render(
            <JsonEditor
                groupKey="shenTong"
                record={{ key: '1', data: { id: 1, name: '金刃', script: 'SkillAttack' } }}
                metaDatasets={metaDatasets}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '攻击脚本（SkillAttack 对方）' }))
        fireEvent.click(screen.getByText('SkillSelf 自身'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'script', 'SkillSelf')
    })

    it('keeps the script field editable as text when meta data is not preloaded', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="shenTong" record={{ key: '1', data: { id: 1, script: 'SkillAttack' } }} onUpdate={onUpdate} />)

        const input = screen.getByDisplayValue('SkillAttack')
        fireEvent.change(input, { target: { value: 'SkillSelf' } })
        expect(onUpdate).toHaveBeenCalledWith('1', 'script', 'SkillSelf')
    })

    it('hides the legacy affix field for shenTong records', () => {
        const onUpdate = vi.fn()
        const affixRecords = [{ key: '270000', data: { id: 270000, name2: 'Affix A', typenum: 101, type: 1, descr: '' } }]
        render(
            <JsonEditor
                groupKey="shenTong"
                record={{ key: '1', data: { id: 1, name: '金刃', Affix: [270000], Affix2: [] } }}
                affixRecords={affixRecords}
                onUpdate={onUpdate}
            />
        )

        expect(screen.queryByText('老词缀')).toBeNull()
        expect(screen.getByText('新词缀')).toBeTruthy()
    })

    it('moves the icon field editor directly below the id field', () => {
        const onUpdate = vi.fn()
        const { container } = render(
            <JsonEditor groupKey="buff" record={{ key: '100', data: { buffid: 100, name: 'Poison', BuffIcon: 0 } }} onUpdate={onUpdate} />
        )

        const labels = Array.from(container.querySelectorAll('span')).map(node => node.textContent)
        const idIndex = labels.indexOf('id序列')
        const iconIndex = labels.indexOf('图标')

        expect(idIndex).toBeGreaterThan(-1)
        expect(iconIndex).toBe(idIndex + 1)
    })

    it('selects and deselects existing shenTong and skill records in dialog tables', () => {
        const onUpdate = vi.fn()
        const shenTongRecords = [
            { key: '1', data: { id: 1, Skill_ID: 1, Skill_Lv: 1, name: '赤焰神通1' } },
            { key: '2', data: { id: 2, Skill_ID: 1, Skill_Lv: 2, name: '赤焰神通2' } },
            { key: '201', data: { id: 201, Skill_ID: 201, Skill_Lv: 1, name: '寒冰神通' } },
        ]
        const skillRecords = [
            { key: '5001', data: { id: 5001, name: '长春功' } },
            { key: '5031', data: { id: 5031, name: '御剑诀' } },
        ]
        render(
            <JsonEditor
                groupKey="npcType"
                record={{ key: '700000', data: { id: 700000, skills: [1], staticSkills: [5001] } }}
                shenTongRecords={shenTongRecords}
                skillRecords={skillRecords}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /绑定技能/ }))
        expect(screen.getByRole('dialog', { name: '绑定技能' })).toBeTruthy()
        expect(screen.queryByRole('checkbox', { name: '选择 1 赤焰神通2' })).toBeNull()
        fireEvent.click(screen.getByRole('checkbox', { name: '选择 1 赤焰神通1' }))
        fireEvent.click(screen.getByRole('checkbox', { name: '选择 201 寒冰神通' }))
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(onUpdate).toHaveBeenCalledWith('700000', 'skills', [201])

        fireEvent.click(screen.getByRole('button', { name: /绑定功法/ }))
        expect(screen.getByRole('dialog', { name: '绑定功法' })).toBeTruthy()
        fireEvent.click(screen.getByRole('checkbox', { name: '选择 5031 御剑诀' }))
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(onUpdate).toHaveBeenCalledWith('700000', 'staticSkills', [5001, 5031])
    })

    it('selects a single skill for yuanying and uses the fixed race enum', () => {
        const onUpdate = vi.fn()
        const skillRecords = [
            { key: '5001', data: { id: 5001, name: '长春功' } },
            { key: '5187', data: { id: 5187, name: '元婴真诀' } },
        ]
        render(
            <JsonEditor
                groupKey="npcType"
                record={{ key: '700000', data: { id: 700000, yuanying: 0, AvatarType: 1 } }}
                skillRecords={skillRecords}
                onUpdate={onUpdate}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '元婴功法' }))
        fireEvent.click(screen.getByText('5187 元婴真诀'))
        expect(onUpdate).toHaveBeenCalledWith('700000', 'yuanying', 5187)

        fireEvent.click(screen.getByRole('button', { name: '种族（1 人）' }))
        fireEvent.click(screen.getByText('4 鬼'))
        expect(onUpdate).toHaveBeenCalledWith('700000', 'AvatarType', 4)
    })

    it('keeps NPC LingGen as a plain numeric array', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="npcType" record={{ key: '700000', data: { id: 700000, LingGen: [20, 20] } }} onUpdate={onUpdate} />)

        const lingGenInputs = screen.getAllByDisplayValue('20')
        expect(lingGenInputs).toHaveLength(2)
        expect(screen.queryByRole('button', { name: /绑定灵根/ })).toBeNull()
        fireEvent.change(lingGenInputs[0]!, { target: { value: '21' } })
        expect(onUpdate).toHaveBeenCalledWith('700000', 'LingGen', [21, 20])
    })

    it('renders the mod icon preview from the Assets path', async () => {
        const onUpdate = vi.fn()
        const readAsset = vi.fn().mockResolvedValue('data:image/png;base64,AAAA')
        render(
            <JsonEditor
                groupKey="item"
                record={{ key: '7', data: { id: 7, name: 'Sword', ItemIcon: 0 } }}
                modDirectory="plugins/Next/_/modDemo"
                readAsset={readAsset}
                onUpdate={onUpdate}
            />
        )

        expect(readAsset).toHaveBeenCalledWith('plugins/Next/_/modDemo/Assets/item icon/7.png')
        const image = await screen.findByRole('img')
        expect(image).toHaveProperty('src', 'data:image/png;base64,AAAA')
        expect(image).toHaveProperty('width', 64)
        expect(image).toHaveProperty('height', 64)
        expect(image.className).toContain('h-full')
    })

    it('uses Skill_ID as the icon name for zero-valued shenTong icons', async () => {
        const onUpdate = vi.fn()
        const readAsset = vi.fn().mockResolvedValue('data:image/png;base64,BBBB')
        render(
            <JsonEditor
                groupKey="shenTong"
                record={{ key: '1', data: { id: 1, Skill_ID: 5, name: 'Gold Blade', icon: 0 } }}
                modDirectory="modDemo"
                readAsset={readAsset}
                onUpdate={onUpdate}
            />
        )

        expect(readAsset).toHaveBeenCalledWith('modDemo/Assets/skill icon/5.png')
    })

    it('does not request an icon when no mod directory is provided', () => {
        const onUpdate = vi.fn()
        const readAsset = vi.fn().mockResolvedValue('data:image/png;base64,AAAA')
        render(<JsonEditor groupKey="item" record={{ key: '7', data: { id: 7, ItemIcon: 0 } }} readAsset={readAsset} onUpdate={onUpdate} />)

        expect(readAsset).not.toHaveBeenCalled()
    })
    it('opens the dedicated Seid editor from the seid field', () => {
        const onUpdate = vi.fn()
        const onUpdateSeidData = vi.fn()
        render(
            <JsonEditor
                groupKey="buff"
                record={{ key: '100', data: { buffid: 100, name: 'Poison', seid: [1] } }}
                onUpdate={onUpdate}
                onUpdateSeidData={onUpdateSeidData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Seid/ }))
        expect(screen.getByRole('dialog')).toBeTruthy()
    })
})
