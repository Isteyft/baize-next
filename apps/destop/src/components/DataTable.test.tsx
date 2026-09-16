import type { JsonDataset } from '@baize-next/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, formatCellText, getVisibleRange } from './DataTable'

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
