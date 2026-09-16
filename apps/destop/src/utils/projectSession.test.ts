import type { ProjectData } from '@baize-next/types'
import { describe, expect, it } from 'vitest'

import { collectGroupRecordsFromProjects, getFirstProjectSelection, removeProjectModRoots } from './projectSession'

const PROJECT_A: ProjectData = {
    id: 'project-a',
    name: '项目 A',
    mods: [
        {
            id: 'mod-a',
            name: 'mod-a',
            groups: [{ key: 'buff', label: 'buff', records: [{ key: '1', data: { id: 1 } }] }],
        },
    ],
}

const PROJECT_B: ProjectData = {
    id: 'project-b',
    name: '项目 B',
    mods: [
        {
            id: 'mod-b',
            name: 'mod-b',
            groups: [{ key: 'buff', label: 'buff', records: [{ key: '2', data: { id: 2 } }] }],
        },
    ],
}

describe('projectSession', () => {
    it('builds the first selection from the requested project', () => {
        expect(getFirstProjectSelection('preload', PROJECT_A)).toEqual({
            kind: 'preload',
            projectId: 'project-a',
            modId: 'mod-a',
            groupKey: 'buff',
        })
    })

    it('collects records from every opened project in the requested group', () => {
        expect(collectGroupRecordsFromProjects([PROJECT_A, PROJECT_B], 'buff')).toEqual([
            { key: '1', data: { id: 1 } },
            { key: '2', data: { id: 2 } },
        ])
    })

    it('removes only the closed project resource roots', () => {
        expect(removeProjectModRoots({ 'mod-a': 'A', 'mod-b': 'B' }, PROJECT_A)).toEqual({ 'mod-b': 'B' })
    })
})
