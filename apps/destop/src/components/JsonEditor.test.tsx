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

        fireEvent.click(screen.getByRole('button', { name: '词缀项目' }))
        fireEvent.click(screen.getByText('Shortcut'))
        expect(onUpdate).toHaveBeenCalledWith('1', 'typenum', 104)
        expect(onUpdate).toHaveBeenCalledWith('1', 'name1', 'Shortcut')

        fireEvent.click(screen.getByRole('button', { name: '指示物' }))
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

    it('renders skill DF as a 0|1 checkbox', () => {
        const onUpdate = vi.fn()
        render(<JsonEditor groupKey="skill" record={{ key: '1', data: { id: 1, name: 'Art', DF: 1 } }} onUpdate={onUpdate} />)

        const dfCheckbox = screen.getByRole('checkbox', { name: '斗法可见' })
        expect((dfCheckbox as HTMLInputElement).checked).toBe(true)
        fireEvent.click(dfCheckbox)
        expect(onUpdate).toHaveBeenCalledWith('1', 'DF', 0)
    })
})
