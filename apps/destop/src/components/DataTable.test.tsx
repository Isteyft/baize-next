import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, getVisibleRange } from './DataTable'

function createRecords(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        key: String(index + 1),
        data: { id: index + 1, name: `Row${index + 1}` },
    }))
}

describe('DataTable', () => {
    it('renders merged fields and notifies row selection', () => {
        const onSelect = vi.fn()
        render(
            <DataTable
                groupKey={null}
                records={[
                    { key: 'a', data: { id: 1, name: 'Alpha' } },
                    { key: 'b', data: { hp: 100 } },
                ]}
                selectedKey="a"
                onSelect={onSelect}
            />
        )

        expect(screen.getByText('Alpha')).toBeTruthy()
        expect(screen.getByText('hp')).toBeTruthy()
        fireEvent.click(screen.getByText('100'))
        expect(onSelect).toHaveBeenCalledWith('b')
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
                groupKey={null}
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
        render(<DataTable groupKey={null} records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)

        const rows = screen.getAllByRole('row').slice(1)
        expect(rows.length).toBeGreaterThan(10)
        expect(rows.length).toBeLessThan(100)
        expect(rows[0]?.textContent ?? '').toContain('Row1')
        expect(screen.queryByText('Row1000')).toBeNull()
    })

    it('moves the rendered window when the viewport scrolls', async () => {
        const { container } = render(<DataTable groupKey={null} records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)
        const viewport = container.querySelector<HTMLElement>('.overflow-scroll')
        expect(viewport).toBeTruthy()
        if (!viewport) return

        viewport.scrollTop = 4000
        fireEvent.scroll(viewport)

        expect(await screen.findByText('Row101')).toBeTruthy()
        expect(screen.queryByText('Row1')).toBeNull()
    })

    it('keeps spacer heights so the scrollbar keeps the full table length', () => {
        const { container } = render(<DataTable groupKey={null} records={createRecords(1000)} selectedKey={null} onSelect={vi.fn()} />)
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
