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

        const numberInputs = screen.getAllByRole('spinbutton')
        expect(numberInputs).toHaveLength(2)
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
})
