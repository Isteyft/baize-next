import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CONTEXT_MENU_PADDING, ContextMenu, resolveContextMenuPlacement } from './ContextMenu'

describe('resolveContextMenuPlacement', () => {
    it('keeps the menu below and to the right of the mouse when it fits', () => {
        expect(
            resolveContextMenuPlacement({
                x: 100,
                y: 80,
                menuWidth: 180,
                menuHeight: 120,
                viewportWidth: 800,
                viewportHeight: 600,
            })
        ).toEqual({ left: 100, top: 80, maxHeight: undefined })
    })

    it('flips upward when the menu would overflow the bottom edge', () => {
        const position = resolveContextMenuPlacement({
            x: 100,
            y: 550,
            menuWidth: 180,
            menuHeight: 120,
            viewportWidth: 800,
            viewportHeight: 600,
        })

        expect(position.top).toBe(550 - 120)
        expect(position.left).toBe(100)
        expect(position.maxHeight).toBeUndefined()
    })

    it('keeps at least an 8px gap from the right and bottom edges', () => {
        const position = resolveContextMenuPlacement({
            x: 790,
            y: 580,
            menuWidth: 180,
            menuHeight: 120,
            viewportWidth: 800,
            viewportHeight: 600,
        })

        expect(position.left).toBe(800 - 180 - CONTEXT_MENU_PADDING)
        expect(position.top).toBe(580 - 120)
    })

    it('keeps an 8px safe distance when the mouse is very close to the bottom edge', () => {
        const position = resolveContextMenuPlacement({
            x: 100,
            y: 597,
            menuWidth: 180,
            menuHeight: 120,
            viewportWidth: 800,
            viewportHeight: 600,
        })

        expect(position.top).toBe(592 - 120)
        expect(position.top + 120 + CONTEXT_MENU_PADDING).toBe(600)
    })

    it('caps the menu height when the flipped menu still cannot fit the viewport', () => {
        const viewportHeight = 600
        const position = resolveContextMenuPlacement({
            x: 50,
            y: 500,
            menuWidth: 180,
            menuHeight: 1200,
            viewportWidth: 800,
            viewportHeight,
        })

        const maxHeight = viewportHeight - CONTEXT_MENU_PADDING * 2
        expect(position.maxHeight).toBe(maxHeight)
        expect(position.top).toBe(Math.max(CONTEXT_MENU_PADDING, 500 - maxHeight))
        expect(position.top + maxHeight + CONTEXT_MENU_PADDING).toBeLessThanOrEqual(viewportHeight)
    })
})

describe('ContextMenu', () => {
    it('renders the menu and children', () => {
        render(
            <ContextMenu x={10} y={20} onClose={vi.fn()}>
                <button type="button" role="menuitem">
                    Delete
                </button>
            </ContextMenu>
        )

        expect(screen.getByRole('menu')).toBeTruthy()
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy()
    })

    it('closes when the Escape key is pressed', () => {
        const onClose = vi.fn()
        render(
            <ContextMenu x={10} y={20} onClose={onClose}>
                <button type="button">Item</button>
            </ContextMenu>
        )

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when the menu scrolls internally', () => {
        const onClose = vi.fn()
        const { container } = render(
            <ContextMenu x={10} y={20} onClose={onClose}>
                <button type="button">Item</button>
            </ContextMenu>
        )
        const menu = container.querySelector('[role="menu"]')
        expect(menu).not.toBeNull()

        fireEvent.scroll(menu as Element, { bubbles: true })

        expect(onClose).not.toHaveBeenCalled()
    })

    it('closes when the window is resized', () => {
        const onClose = vi.fn()
        render(
            <ContextMenu x={10} y={20} onClose={onClose}>
                <button type="button">Item</button>
            </ContextMenu>
        )

        fireEvent(window, new Event('resize'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
