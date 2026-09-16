import type { ProjectData } from '@baize-next/types'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { LeftPanel } from './LeftPanel'

const PROJECT_A: ProjectData = {
    id: 'preload-a',
    name: '项目 A',
    mods: [
        {
            id: 'mod_a',
            name: 'mod_a',
            groups: [{ key: 'preload', label: 'mod 预加载', records: [{ key: '1', data: { id: 1 } }] }],
        },
    ],
}

const PROJECT_B: ProjectData = {
    id: 'preload-b',
    name: '项目 B',
    mods: [
        {
            id: 'mod_b',
            name: 'mod_b',
            groups: [{ key: 'preload', label: 'mod 预加载', records: [{ key: '2', data: { id: 2 } }] }],
        },
    ],
}

function renderLeftPanel(overrides: Partial<ComponentProps<typeof LeftPanel>> = {}) {
    const props: ComponentProps<typeof LeftPanel> = {
        preloadProjects: [PROJECT_A, PROJECT_B],
        projects: [],
        selection: { kind: 'preload', projectId: PROJECT_A.id, modId: 'mod_a', groupKey: 'preload' },
        onSelectPreloadGroup: vi.fn(),
        onSelectGroup: vi.fn(),
        onCreateMod: vi.fn(),
        onRenameMod: vi.fn(),
        onDeleteMod: vi.fn(),
        onDeletePreloadMod: vi.fn(),
        onSaveProject: vi.fn(),
        onCloseProject: vi.fn(),
        onClosePreloadProject: vi.fn(),
        ...overrides,
    }
    return {
        props,
        ...render(
            <div onContextMenu={event => event.preventDefault()}>
                <LeftPanel {...props} />
            </div>
        ),
    }
}

describe('LeftPanel', () => {
    it('renders every preload project and its own mods', () => {
        renderLeftPanel()

        expect(screen.getByText('项目 A')).toBeTruthy()
        expect(screen.getByText('项目 B')).toBeTruthy()
        expect(screen.getByText('mod_a')).toBeTruthy()
        expect(screen.getByText('mod_b')).toBeTruthy()
        expect(screen.queryByText('Meta 预加载')).toBeNull()
    })

    it('keeps mods from simultaneously opened projects isolated', () => {
        const firstProject: ProjectData = {
            ...PROJECT_A,
            id: 'project-a',
            mods: [{ ...PROJECT_A.mods[0], id: 'project-mod-a', name: 'project_mod_a' }],
        }
        const secondProject: ProjectData = {
            ...PROJECT_B,
            id: 'project-b',
            mods: [{ ...PROJECT_B.mods[0], id: 'project-mod-b', name: 'project_mod_b' }],
        }

        renderLeftPanel({
            preloadProjects: [],
            projects: [firstProject, secondProject],
            selection: { kind: 'project', projectId: firstProject.id, modId: 'project-mod-a', groupKey: 'preload' },
        })

        expect(screen.getByText(firstProject.name)).toBeTruthy()
        expect(screen.getByText(secondProject.name)).toBeTruthy()
        expect(screen.getByText('project_mod_a')).toBeTruthy()
        expect(screen.getByText('project_mod_b')).toBeTruthy()
    })

    it('opens the preload project menu without mixing in mod actions', () => {
        const onClosePreloadProject = vi.fn()
        renderLeftPanel({ onClosePreloadProject })

        fireEvent.contextMenu(screen.getByRole('button', { name: PROJECT_A.name }), { clientX: 10, clientY: 20 })

        expect(screen.queryByRole('menuitem', { name: '删除 Mod' })).toBeNull()
        expect(screen.queryByRole('menuitem', { name: '保存该项目' })).toBeNull()
        fireEvent.click(screen.getByRole('menuitem', { name: '关闭此项目' }))

        expect(onClosePreloadProject).toHaveBeenCalledWith(PROJECT_A.id)
    })

    it('opens the preload mod menu and removes that mod', () => {
        const onDeletePreloadMod = vi.fn()
        renderLeftPanel({ onDeletePreloadMod })

        fireEvent.contextMenu(screen.getByRole('button', { name: PROJECT_A.mods[0].name }), { clientX: 10, clientY: 20 })
        fireEvent.click(screen.getByRole('menuitem', { name: '删除 Mod' }))

        expect(onDeletePreloadMod).toHaveBeenCalledWith(PROJECT_A.id, PROJECT_A.mods[0].id)
    })

    it('opens the mod menu and deletes the selected mod', () => {
        const project: ProjectData = { ...PROJECT_A, id: 'project-a' }
        const onDeleteMod = vi.fn()
        renderLeftPanel({
            preloadProjects: [],
            projects: [project],
            selection: { kind: 'project', projectId: project.id, modId: 'mod_a', groupKey: 'preload' },
            onDeleteMod,
        })

        fireEvent.contextMenu(screen.getByRole('button', { name: project.mods[0].name }), { clientX: 10, clientY: 20 })

        expect(screen.queryByRole('menuitem', { name: '关闭此项目' })).toBeNull()
        fireEvent.click(screen.getByRole('menuitem', { name: '删除 Mod' }))

        expect(onDeleteMod).toHaveBeenCalledWith(project.id, project.mods[0].id)
    })

    it('saves an opened project from its context menu', () => {
        const project: ProjectData = { ...PROJECT_A, id: 'project-a' }
        const onSaveProject = vi.fn()
        renderLeftPanel({
            preloadProjects: [],
            projects: [project],
            selection: { kind: 'project', projectId: project.id, modId: 'mod_a', groupKey: 'preload' },
            onSaveProject,
        })

        fireEvent.contextMenu(screen.getByRole('button', { name: project.name }), { clientX: 10, clientY: 20 })
        fireEvent.click(screen.getByRole('menuitem', { name: '保存该项目' }))

        expect(onSaveProject).toHaveBeenCalledWith(project.id)
    })

    it('shows the project menu and closes the selected project', () => {
        const project: ProjectData = { ...PROJECT_A, id: 'project-a' }
        const onCloseProject = vi.fn()
        renderLeftPanel({
            preloadProjects: [],
            projects: [project],
            selection: { kind: 'project', projectId: project.id, modId: 'mod_a', groupKey: 'preload' },
            onCloseProject,
        })

        fireEvent.contextMenu(screen.getByRole('button', { name: project.name }), { clientX: 10, clientY: 20 })

        expect(screen.queryByRole('menuitem', { name: '删除 Mod' })).toBeNull()
        fireEvent.click(screen.getByText('关闭此项目'))

        expect(onCloseProject).toHaveBeenCalledWith(project.id)
    })
})
