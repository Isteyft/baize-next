import type { JsonDataset } from '@baize-next/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SeidEditor } from './SeidEditor'

const EMPTY_RECORDS = { buff: [], skill: [], staticSkill: [], item: [] }

function createBuffSeidDataset(): JsonDataset {
    return {
        id: 'buff-seid',
        name: 'BuffSeidMeta',
        kind: 'file',
        records: [
            {
                key: '1',
                data: {
                    ID: 1,
                    IDName: 'id',
                    Name: 'Damage',
                    Desc: 'Damage test',
                    Properties: [{ ID: 'value1', Type: 'Int', Desc: 'Damage value' }],
                },
            },
            {
                key: '2',
                data: {
                    ID: 2,
                    IDName: 'id',
                    Name: 'Buff target',
                    Desc: 'Buff target test',
                    Properties: [{ ID: 'value1', Type: 'Int', Desc: 'Buff', SpecialDrawer: ['BuffDrawer'] }],
                },
            },
        ],
    }
}

describe('SeidEditor', () => {
    it('adds a Seid and creates its parameter record', () => {
        const onUpdateRecord = vi.fn()
        const onUpdateSeidData = vi.fn()
        render(
            <SeidEditor
                open
                groupKey="buff"
                record={{ key: '100', data: { buffid: 100, name: 'Poison', seid: [1] } }}
                seidData={{}}
                metaDatasets={[createBuffSeidDataset()]}
                records={EMPTY_RECORDS}
                onClose={vi.fn()}
                onUpdateRecord={onUpdateRecord}
                onUpdateSeidData={onUpdateSeidData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '增加 Seid' }))
        expect(screen.getByRole('dialog', { name: '选择 Seid' })).toBeTruthy()
        fireEvent.change(screen.getByLabelText('搜索 Seid'), { target: { value: 'target' } })
        fireEvent.click(screen.getByRole('button', { name: '添加 Seid 2' }))

        expect(onUpdateRecord).toHaveBeenCalledWith('100', 'seid', [1, 2])
        expect(onUpdateSeidData).toHaveBeenCalledWith('buff', '2', '100', { id: 100, value1: 0 })
    })

    it('renders ElementTypeArrayDrawer as a multi-select backed by ElementType', () => {
        const onUpdateSeidData = vi.fn()
        const datasets: JsonDataset[] = [
            {
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
            },
            {
                id: 'element',
                name: 'ElementType',
                kind: 'file',
                records: [
                    { key: '0', data: { Id: 0, Desc: 'Gold' } },
                    { key: '1', data: { Id: 1, Desc: 'Wood' } },
                ],
            },
        ]
        render(
            <SeidEditor
                open
                groupKey="shenTong"
                record={{ key: '200', data: { id: 200, name: 'Skill', seid: [7] } }}
                seidData={{}}
                metaDatasets={datasets}
                records={EMPTY_RECORDS}
                onClose={vi.fn()}
                onUpdateRecord={vi.fn()}
                onUpdateSeidData={onUpdateSeidData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Elements（0 项）' }))
        fireEvent.click(screen.getByText('0 Gold'))
        expect(onUpdateSeidData).toHaveBeenCalledWith('skill', '7', '200', { skillid: 200, value1: [0] })
    })

    it('removes a Seid and deletes its parameter record', () => {
        const onUpdateRecord = vi.fn()
        const onUpdateSeidData = vi.fn()
        render(
            <SeidEditor
                open
                groupKey="buff"
                record={{ key: '100', data: { buffid: 100, seid: [1] } }}
                seidData={{ buff: { '1': { '100': { id: 100, value1: 2 } } } }}
                metaDatasets={[createBuffSeidDataset()]}
                records={EMPTY_RECORDS}
                onClose={vi.fn()}
                onUpdateRecord={onUpdateRecord}
                onUpdateSeidData={onUpdateSeidData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '删除 Seid 1' }))
        expect(onUpdateRecord).toHaveBeenCalledWith('100', 'seid', [])
        expect(onUpdateSeidData).toHaveBeenCalledWith('buff', '1', '100', null)
    })
    it('moves Seid entries up and down in the underlying array', () => {
        const onUpdateRecord = vi.fn()
        render(
            <SeidEditor
                open
                groupKey="buff"
                record={{ key: '100', data: { buffid: 100, seid: [1, 2] } }}
                seidData={{}}
                metaDatasets={[createBuffSeidDataset()]}
                records={EMPTY_RECORDS}
                onClose={vi.fn()}
                onUpdateRecord={onUpdateRecord}
                onUpdateSeidData={vi.fn()}
            />
        )

        expect((screen.getByRole('button', { name: '上移 Seid 1' }) as HTMLButtonElement).disabled).toBe(true)
        expect((screen.getByRole('button', { name: '下移 Seid 2' }) as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(screen.getByRole('button', { name: '下移 Seid 1' }))
        expect(onUpdateRecord).toHaveBeenLastCalledWith('100', 'seid', [2, 1])

        onUpdateRecord.mockClear()
        fireEvent.click(screen.getByRole('button', { name: '上移 Seid 2' }))
        expect(onUpdateRecord).toHaveBeenLastCalledWith('100', 'seid', [2, 1])
    })
})
