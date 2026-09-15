import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable } from './DataTable'

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
})
