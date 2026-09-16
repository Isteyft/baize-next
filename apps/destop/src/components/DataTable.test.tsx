import type { JsonDataset } from '@baize-next/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildNpcBatchRecords, DataTable, formatCellText, getVisibleRange } from './DataTable'

/** 构造长表测试数据：由于表格对未配置分组只保留一列，这里固定使用 buff 分组的 name 列。 */
function createRecords(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        key: String(index + 1),
        data: { buffid: index + 1, name: `Row${index + 1}` },
    }))
}

function typeSearch(value: string): void {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value } })
}

describe('DataTable', () => {
    it('renders configured fields and notifies row selection', () => {
        const onSelect = vi.fn()
        render(
            <DataTable
                groupKey="item"
                records={[
                    { key: 'a', data: { id: 1, name: 'Alpha', desc: 'Alpha desc' } },
                    { key: 'b', data: { id: 2, name: 'Beta', desc: 'Beta desc' } },
                ]}
                selectedKey="a"
                onSelect={onSelect}
            />
        )

        expect(screen.getByText('Alpha')).toBeTruthy()
        expect(screen.getByText('Alpha desc')).toBeTruthy()
        fireEvent.click(screen.getByText('Beta desc'))
        expect(onSelect).toHaveBeenCalledWith('b')
    })

    it('hides fields other than id, name and description', () => {
        render(
            <DataTable
                groupKey="item"
                records={[{ key: '1', data: { id: 1, name: 'Sword', desc: 'A sword', price: 999, quality: 7 } }]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )

        expect(screen.getByText('Sword')).toBeTruthy()
        expect(screen.queryByText('999')).toBeNull()
        expect(screen.queryByText('7')).toBeNull()
    })

    it('renders only the id column for groups without a description field', () => {
        render(
            <DataTable
                groupKey="npcWuDao"
                records={[{ key: '1', data: { id: 1, Type: 'fire', lv: 3, value1: 5 } }]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )

        expect(screen.getByText('fire')).toBeTruthy()
        expect(screen.queryByText('5')).toBeNull()
    })

    it('creates a record with the id entered in the add dialog', () => {
        const onCreateRecord = vi.fn()
        render(<DataTable groupKey="item" records={[]} selectedKey={null} onSelect={vi.fn()} onCreateRecord={onCreateRecord} />)

        fireEvent.click(screen.getByRole('button', { name: '增加记录' }))
        fireEvent.change(screen.getByLabelText('ID'), { target: { value: '42' } })
        fireEvent.click(screen.getByRole('button', { name: '确定' }))

        expect(onCreateRecord).toHaveBeenCalledWith('42', { id: 42 })
    })

    it('rejects an empty or duplicate id in the add dialog', () => {
        const onCreateRecord = vi.fn()
        render(
            <DataTable
                groupKey="item"
                records={[{ key: '7', data: { id: 7, name: 'Existing' } }]}
                selectedKey={null}
                onSelect={vi.fn()}
                onCreateRecord={onCreateRecord}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: '增加记录' }))
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(screen.getByText('请输入 ID')).toBeTruthy()

        fireEvent.change(screen.getByLabelText('ID'), { target: { value: '7' } })
        fireEvent.click(screen.getByRole('button', { name: '确定' }))
        expect(screen.getByText('该 ID 已存在')).toBeTruthy()
        expect(onCreateRecord).not.toHaveBeenCalled()
    })

    it('batch generates NPC levels 1-15 from the selected template', () => {
        const onCreateRecord = vi.fn()
        render(
            <DataTable
                groupKey="npcType"
                records={[
                    {
                        key: '700000',
                        data: { id: 700000, Type: 7000, Level: 1, LingGen: [20], skills: [1] },
                    },
                ]}
                selectedKey="700000"
                selectedKeys={['700000']}
                onSelect={vi.fn()}
                onCreateRecord={onCreateRecord}
            />
        )

        fireEvent.contextMenu(screen.getByText('700000'))
        fireEvent.click(screen.getByRole('menuitem', { name: '\u6279\u91cf\u751f\u6210' }))

        expect(onCreateRecord).toHaveBeenCalledTimes(15)
        expect(onCreateRecord).toHaveBeenNthCalledWith(1, '700001', {
            id: 700001,
            Type: 7000,
            Level: 1,
            LingGen: [20],
            skills: [1],
        })
        expect(onCreateRecord).toHaveBeenNthCalledWith(15, '700015', {
            id: 700015,
            Type: 7000,
            Level: 15,
            LingGen: [20],
            skills: [1],
        })
    })

    it('batch generates NPC WuDao levels 1-15 with the lv field', () => {
        const onCreateRecord = vi.fn()
        render(
            <DataTable
                groupKey="npcWuDao"
                records={[
                    {
                        key: '800000',
                        data: { id: 800000, Type: 61, lv: 1, wudaoID: [10] },
                    },
                ]}
                selectedKey="800000"
                selectedKeys={['800000']}
                onSelect={vi.fn()}
                onCreateRecord={onCreateRecord}
            />
        )

        fireEvent.contextMenu(screen.getByText('800000'))
        fireEvent.click(screen.getByRole('menuitem', { name: '\u6279\u91cf\u751f\u6210' }))

        expect(onCreateRecord).toHaveBeenCalledTimes(15)
        expect(onCreateRecord).toHaveBeenNthCalledWith(1, '800001', {
            id: 800001,
            Type: 61,
            lv: 1,
            wudaoID: [10],
        })
        expect(onCreateRecord).toHaveBeenNthCalledWith(15, '800015', {
            id: 800015,
            Type: 61,
            lv: 15,
            wudaoID: [10],
        })
    })

    it('stops NPC batch generation and shows an ID conflict dialog when a serial number already exists', () => {
        const onCreateRecord = vi.fn()
        render(
            <DataTable
                groupKey="npcType"
                records={[
                    { key: '700000', data: { id: 700000, Type: 7000, Level: 1 } },
                    { key: '700003', data: { id: 700003, Type: 9999, Level: 4 } },
                ]}
                selectedKey="700000"
                selectedKeys={['700000']}
                onSelect={vi.fn()}
                onCreateRecord={onCreateRecord}
            />
        )

        fireEvent.contextMenu(screen.getByText('700000'))
        fireEvent.click(screen.getByRole('menuitem', { name: '\u6279\u91cf\u751f\u6210' }))

        expect(onCreateRecord).toHaveBeenCalledTimes(2)
        expect(onCreateRecord).toHaveBeenLastCalledWith('700002', { id: 700002, Type: 7000, Level: 2 })
        expect(screen.getByRole('dialog', { name: 'ID \u51b2\u7a81' })).toBeTruthy()
        expect(screen.getByText('ID 700003 \u5df2\u5b58\u5728\uff0c\u6279\u91cf\u751f\u6210\u5df2\u505c\u6b62\u3002')).toBeTruthy()
    })

    it('builds NPC batch records against record keys and ID fields', () => {
        const result = buildNpcBatchRecords(
            [
                { key: '100', data: { id: 100, Level: 1, name: 'template' } },
                { key: 'existing', data: { id: '103', Level: 4, name: 'existing' } },
            ],
            '100'
        )

        expect(result.conflictKey).toBe('103')
        expect(result.records).toEqual([
            { key: '101', data: { id: 101, Level: 1, name: 'template' } },
            { key: '102', data: { id: 102, Level: 2, name: 'template' } },
        ])
    })

    it.each(['skill', 'shenTong'] as const)('generates a skill book from a %s row context menu', groupKey => {
        const onGenerateSkillBook = vi.fn()
        render(
            <DataTable
                groupKey={groupKey}
                records={[{ key: '1', data: { id: 1, Skill_ID: 9, name: 'Source skill', descr: 'Description' } }]}
                selectedKey="1"
                selectedKeys={['1']}
                onSelect={vi.fn()}
                onGenerateSkillBook={onGenerateSkillBook}
            />
        )

        fireEvent.contextMenu(screen.getByText('1'))
        fireEvent.click(screen.getByRole('menuitem', { name: '生成技能书' }))

        expect(onGenerateSkillBook).toHaveBeenCalledWith('1')
        expect(screen.queryByRole('menu')).toBeNull()
    })

    it('does not show skill book generation outside skill and shenTong groups', () => {
        render(
            <DataTable
                groupKey="item"
                records={[{ key: '1', data: { id: 1, name: 'Item' } }]}
                selectedKey="1"
                selectedKeys={['1']}
                onSelect={vi.fn()}
                onGenerateSkillBook={vi.fn()}
            />
        )

        fireEvent.contextMenu(screen.getByText('1'))

        expect(screen.queryByRole('menuitem', { name: '生成技能书' })).toBeNull()
    })
    it('supports shift selection across the visible rows', () => {
        const onSelectionChange = vi.fn()
        const onSelect = vi.fn()
        render(
            <DataTable
                groupKey="buff"
                records={createRecords(4)}
                selectedKey="1"
                selectedKeys={['1']}
                onSelect={onSelect}
                onSelectionChange={onSelectionChange}
            />
        )

        fireEvent.click(screen.getByText('Row3'), { shiftKey: true })

        expect(onSelectionChange).toHaveBeenLastCalledWith(['1', '2', '3'])
        expect(onSelect).toHaveBeenLastCalledWith('3')
    })

    it('supports ctrl selection without clearing existing rows', () => {
        const onSelectionChange = vi.fn()
        render(
            <DataTable
                groupKey="buff"
                records={createRecords(3)}
                selectedKey="1"
                selectedKeys={['1', '3']}
                onSelect={vi.fn()}
                onSelectionChange={onSelectionChange}
            />
        )

        fireEvent.click(screen.getByText('Row2'), { ctrlKey: true })

        expect(onSelectionChange).toHaveBeenLastCalledWith(['1', '3', '2'])
    })

    it('does not render a delete button next to the add button', () => {
        render(
            <DataTable
                groupKey="buff"
                records={createRecords(3)}
                selectedKey="1"
                selectedKeys={['1', '3']}
                onSelect={vi.fn()}
                onCreateRecord={vi.fn()}
                onDeleteRecords={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: '增加记录' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: '删除已选记录' })).toBeNull()
    })

    it('opens a row context menu and deletes the selected row', () => {
        const onDeleteRecords = vi.fn()
        const onSelectionChange = vi.fn()
        render(
            <DataTable
                groupKey="buff"
                records={createRecords(3)}
                selectedKey="1"
                selectedKeys={['1']}
                onSelect={vi.fn()}
                onSelectionChange={onSelectionChange}
                onDeleteRecords={onDeleteRecords}
            />
        )

        fireEvent.contextMenu(screen.getByText('Row2'), { clientX: 20, clientY: 30 })
        expect(onSelectionChange).toHaveBeenLastCalledWith(['2'])
        fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
        fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

        expect(onDeleteRecords).toHaveBeenCalledWith(['2'])
    })

    it.each([
        ['npcType', 'Level', 3, '炼气后期(3)'],
        ['npcWuDao', 'lv', 7, '金丹初期(7)'],
    ] as const)('renders the realm as text for %s rows', (groupKey, field, value, expected) => {
        const metaDatasets: JsonDataset[] = [
            {
                id: 'level-type',
                name: 'LevelType',
                kind: 'file',
                records: [
                    { key: '3', data: { TypeID: 3, Desc: '炼气后期' } },
                    { key: '7', data: { TypeID: 7, Desc: '金丹初期' } },
                ],
            },
        ]
        render(
            <DataTable
                groupKey={groupKey}
                records={[{ key: '1', data: { id: 1, Type: 100, [field]: value } }]}
                selectedKey="1"
                onSelect={vi.fn()}
                metaDatasets={metaDatasets}
            />
        )

        expect(screen.getByText(expected)).toBeTruthy()
        expect(screen.queryByRole('button', { name: /境界 1$/ })).toBeNull()
    })

    it('filters rows by id, name or description keyword', () => {
        render(
            <DataTable
                groupKey="item"
                records={[
                    { key: '1', data: { id: 1, name: 'Sword', desc: 'a sharp blade' } },
                    { key: '2', data: { id: 2, name: 'Shield', desc: 'a sturdy plate' } },
                    { key: '3', data: { id: 9, name: 'Potion', desc: 'a healing elixir' } },
                ]}
                selectedKey={null}
                onSelect={vi.fn()}
            />
        )

        typeSearch('2')
        expect(screen.getByText('Shield')).toBeTruthy()
        expect(screen.queryByText('Sword')).toBeNull()

        typeSearch('sturdy')
        expect(screen.getByText('Shield')).toBeTruthy()
        expect(screen.queryByText('Potion')).toBeNull()

        typeSearch('potion')
        expect(screen.getByText('Potion')).toBeTruthy()
        expect(screen.queryByText('Shield')).toBeNull()
    })

    it('shows an empty hint when nothing matches the keyword', () => {
        render(
            <DataTable
                groupKey="item"
                records={[{ key: '1', data: { id: 1, name: 'Sword', desc: 'a sharp blade' } }]}
                selectedKey={null}
                onSelect={vi.fn()}
            />
        )

        typeSearch('missing')
        expect(screen.getByText('没有匹配“missing”的记录')).toBeTruthy()
        expect(screen.queryByText('Sword')).toBeNull()
    })

    it('searches the record key for groups without a configured column', () => {
        render(
            <DataTable
                groupKey="config"
                records={[
                    { key: 'alpha', data: { Name: 'Alpha Mod' } },
                    { key: 'beta', data: { Name: 'Beta Mod' } },
                ]}
                selectedKey={null}
                onSelect={vi.fn()}
            />
        )

        expect(screen.getAllByRole('row')).toHaveLength(3)
        typeSearch('beta')
        expect(screen.getAllByRole('row')).toHaveLength(2)

        typeSearch('')
        expect(screen.getAllByRole('row')).toHaveLength(3)
    })

    it('keeps the search box across long tables and restores rows when cleared', () => {
        render(<DataTable groupKey="buff" records={createRecords(200)} selectedKey={null} onSelect={vi.fn()} />)

        typeSearch('Row150')
        expect(screen.getByText('Row150')).toBeTruthy()
        expect(screen.queryByText('Row1')).toBeNull()

        typeSearch('')
        expect(screen.getByText('Row1')).toBeTruthy()
    })

    it('hides the name1 field for tuJianChunWenBen rows', () => {
        render(
            <DataTable
                groupKey="tuJianChunWenBen"
                records={[{ key: '1', data: { id: 1, name1: 'hidden-text', name2: 'visible-text' } }]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )

        expect(screen.getByText('visible-text')).toBeTruthy()
        expect(screen.queryByText('hidden-text')).toBeNull()
    })

    it('hides the legacy affix column for shenTong rows', () => {
        render(
            <DataTable
                groupKey="shenTong"
                records={[{ key: '1', data: { id: 1, name: 'Gold Blade', descr: 'desc', Affix: [270000] } }]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )

        expect(screen.getByText('Gold Blade')).toBeTruthy()
        expect(screen.queryByText('[270000]')).toBeNull()
    })

    it('appends the meta enum description when formatting enum cells', () => {
        const metaDatasets: JsonDataset[] = [
            {
                id: 'item-type',
                name: 'ItemType',
                kind: 'file',
                records: [{ key: '0', data: { Id: 0, Desc: '武器' } }],
            },
        ]

        expect(formatCellText('item', 'type', 0, metaDatasets)).toBe('武器(0)')
        expect(formatCellText('item', 'type', 9, metaDatasets)).toBe('9')
        expect(formatCellText('item', 'name', 'Sword', metaDatasets)).toBe('Sword')
        expect(formatCellText(null, 'type', 0, metaDatasets)).toBe('0')
    })

    it('shows wuDao Type names from WuDaoAllType records without an icon column', () => {
        const readAsset = vi.fn().mockResolvedValue('data:image/png;base64,AAAA')
        const { container } = render(
            <DataTable
                groupKey="wuDao"
                records={[{ key: '101', data: { id: 101, icon: '101', name: '御金', Lv: 1, Type: [1, 2] } }]}
                wuDaoTypeRecords={[
                    { key: '1', data: { id: 1, name: '金', name1: '金之道' } },
                    { key: '2', data: { id: 2, name: '木', name1: '木之道' } },
                ]}
                selectedKey="101"
                onSelect={vi.fn()}
                modDirectory="plugins/Next/_/modDemo"
                readAsset={readAsset}
            />
        )

        expect(screen.getByText('金、木')).toBeTruthy()
        expect(screen.queryByText('图标')).toBeNull()
        expect(readAsset).not.toHaveBeenCalled()
        expect(container.querySelectorAll('thead tr:first-child th')).toHaveLength(4)
    })
    it('loads and displays row icons from the mod asset directory', async () => {
        const readAsset = vi.fn().mockResolvedValue('data:image/png;base64,AAAA')
        render(
            <DataTable
                groupKey="item"
                records={[{ key: '1', data: { id: 7, name: 'Sword', desc: 'A sword', ItemIcon: 0 } }]}
                selectedKey={null}
                onSelect={vi.fn()}
                modDirectory="plugins/Next/_/modDemo"
                readAsset={readAsset}
            />
        )

        expect(readAsset).toHaveBeenCalledWith('plugins/Next/_/modDemo/Assets/item icon/7.png')
        expect(await screen.findByRole('img')).toHaveProperty('src', 'data:image/png;base64,AAAA')
    })

    it('aligns header and data cells when the icon column is hidden', () => {
        const { container } = render(
            <DataTable
                groupKey="item"
                records={[{ key: '1', data: { id: 1, name: 'Sword', desc: 'A sword' } }]}
                selectedKey={null}
                onSelect={vi.fn()}
            />
        )

        const headerCells = container.querySelectorAll('thead tr:first-child th')
        const dataCells = container.querySelectorAll('tbody tr:first-child td')

        expect(headerCells).toHaveLength(dataCells.length)
        expect(headerCells).toHaveLength(3)
    })

    it('renders an empty table body for empty records', () => {
        const { container } = render(<DataTable groupKey={null} records={[]} selectedKey={null} onSelect={vi.fn()} />)

        expect(container.querySelector('tbody')).toBeNull()
    })

    it('sorts rows by numeric id ascending', () => {
        render(
            <DataTable
                groupKey="tuJianChunWenBen"
                records={[
                    { key: '10', data: { id: 10, name2: 'Ten' } },
                    { key: '2', data: { id: 2, name2: 'Two' } },
                    { key: '1', data: { id: 1, name2: 'One' } },
                ]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )
        const rows = screen
            .getAllByRole('row')
            .slice(1)
            .map(row => row.textContent ?? '')
        expect(rows[0] || '').toContain('One')
        expect(rows[1] || '').toContain('Two')
        expect(rows[2] || '').toContain('Ten')
    })

    it('sorts fallback record keys numerically', () => {
        render(
            <DataTable
                groupKey="shenTong"
                records={[
                    { key: '1000', data: { name: 'Thousand' } },
                    { key: '100', data: { name: 'Hundred' } },
                    { key: '10', data: { name: 'Ten' } },
                    { key: '1', data: { name: 'One' } },
                ]}
                selectedKey="1"
                onSelect={vi.fn()}
            />
        )
        const rows = screen
            .getAllByRole('row')
            .slice(1)
            .map(row => row.textContent ?? '')
        expect(rows[0] || '').toContain('One')
        expect(rows[1] || '').toContain('Ten')
        expect(rows[2] || '').toContain('Hundred')
        expect(rows[3] || '').toContain('Thousand')
    })

    it('renders only the visible slice for long tables', () => {
        render(<DataTable groupKey="buff" records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)

        const rows = screen.getAllByRole('row').slice(1)
        expect(rows.length).toBeGreaterThan(10)
        expect(rows.length).toBeLessThan(100)
        expect(rows[0]?.textContent ?? '').toContain('Row1')
        expect(screen.queryByText('Row1000')).toBeNull()
    })

    it('moves the rendered window when the viewport scrolls', async () => {
        const { container } = render(<DataTable groupKey="buff" records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)
        const viewport = container.querySelector<HTMLElement>('.overflow-scroll')
        expect(viewport).toBeTruthy()
        if (!viewport) return

        viewport.scrollTop = 4000
        fireEvent.scroll(viewport)

        expect(await screen.findByText('Row101')).toBeTruthy()
        expect(screen.queryByText('Row1')).toBeNull()
    })

    it('keeps spacer heights so the scrollbar keeps the full table length', () => {
        const { container } = render(<DataTable groupKey="buff" records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)
        const spacers = Array.from(container.querySelectorAll('tbody tr[aria-hidden="true"] td')) as HTMLElement[]
        const spacerHeight = spacers.reduce((total, cell) => total + Number.parseFloat(cell.style.height || '0'), 0)

        expect(spacerHeight).toBeGreaterThan(1000 * 40 - 100 * 40)
    })
})

describe('getVisibleRange', () => {
    it('adds overscan around the visible rows', () => {
        expect(getVisibleRange(0, 400, 1000)).toEqual({ start: 0, end: 18 })
        expect(getVisibleRange(400, 400, 1000)).toEqual({ start: 2, end: 28 })
    })

    it('clamps the range to the record count', () => {
        expect(getVisibleRange(0, 400, 3)).toEqual({ start: 0, end: 3 })
        expect(getVisibleRange(100000, 400, 1000)).toEqual({ start: 1000, end: 1000 })
        expect(getVisibleRange(0, 400, 0)).toEqual({ start: 0, end: 0 })
    })
})
