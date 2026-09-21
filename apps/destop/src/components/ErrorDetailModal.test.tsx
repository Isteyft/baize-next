import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorDetailModal } from './ErrorDetailModal'

describe('ErrorDetailModal', () => {
    it('renders nothing while closed', () => {
        render(<ErrorDetailModal open={false} message="detail" onClose={vi.fn()} />)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('shows the full error context and closes on the close button', () => {
        const onClose = vi.fn()
        const detail = 'skills.json\n项目：九州前置\nJSON 语法错误：第 36 行，第 2 列'
        render(<ErrorDetailModal open message={detail} onClose={onClose} />)

        expect(screen.getByRole('dialog', { name: '加载失败' })).toBeTruthy()
        expect(screen.getByText('加载失败')).toBeTruthy()
        expect(screen.getByText(/skills\.json/)).toBeTruthy()
        expect(screen.getByText(/项目：九州前置/)).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: '关闭' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('limits the detail area height and enables vertical scrolling for long text', () => {
        render(<ErrorDetailModal open message="x" onClose={vi.fn()} />)
        const detailArea = screen.getByText('x').closest('div') as HTMLElement
        expect(detailArea.className).toContain('overflow-y-auto')
    })
})
