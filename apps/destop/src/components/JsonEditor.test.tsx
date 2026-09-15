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

    it('commits complex json values on blur', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey={null} record={{ key: 'a', data: { affixes: [1, 2] } }} onUpdate={onUpdate} />)

        const textarea = screen.getByRole('textbox')
        fireEvent.change(textarea, { target: { value: '[3, 4]' } })
        fireEvent.blur(textarea)
        expect(onUpdate).toHaveBeenCalledWith('a', 'affixes', [3, 4])
    })
})
