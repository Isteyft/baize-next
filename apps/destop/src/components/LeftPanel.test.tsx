import type { ProjectData } from '@baize-next/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LeftPanel } from './LeftPanel'

const EMPTY_CALLBACK = (): void => undefined

describe('LeftPanel', () => {
    it('shows mod preload data instead of Meta entries', () => {
        const preloadProject: ProjectData = {
            id: 'preload',
            name: 'Editor',
            mods: [
                {
                    id: 'mod_demo',
                    name: 'mod_demo',
                    groups: [{ key: 'preload', label: 'mod 预加载', records: [{ key: '1', data: { id: 1 } }] }],
                },
            ],
        }

        render(
            <LeftPanel
                preloadProject={preloadProject}
                project={null}
                selection={{ kind: 'preload', modId: 'mod_demo', groupKey: 'preload' }}
                onSelectPreloadGroup={vi.fn()}
                onSelectGroup={vi.fn()}
                onCreateMod={EMPTY_CALLBACK}
                onRenameMod={EMPTY_CALLBACK}
                onDeleteMod={EMPTY_CALLBACK}
            />
        )

        expect(screen.getByText('mod_demo')).toBeTruthy()
        expect(screen.getByText('mod 预加载')).toBeTruthy()
        expect(screen.queryByText('Meta 预加载')).toBeNull()
    })
})
