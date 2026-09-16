import type { JsonRecord, ProjectData, ProjectModGroupKey } from '@baize-next/types'

/** 当前表格与编辑器展示的数据来源。 */
export type SelectionSource =
    | { kind: 'preload'; projectId: string; modId: string; groupKey: ProjectModGroupKey }
    | { kind: 'project'; projectId: string; modId: string; groupKey: ProjectModGroupKey }
    | null

/** 返回项目内第一个可展示的 Mod 分组；项目没有 Mod 或分组时返回 null。 */
export function getFirstProjectSelection(kind: 'preload' | 'project', project: ProjectData | null): SelectionSource {
    const firstMod = project?.mods[0] ?? null
    const firstGroup = firstMod?.groups[0] ?? null
    return project && firstMod && firstGroup ? { kind, projectId: project.id, modId: firstMod.id, groupKey: firstGroup.key } : null
}

/** 汇总一组项目在指定分组下的全部记录。 */
export function collectGroupRecordsFromProjects(projects: ProjectData[], groupKey: ProjectModGroupKey): JsonRecord[] {
    return projects.flatMap(project => project.mods.flatMap(mod => mod.groups.find(group => group.key === groupKey)?.records ?? []))
}

/** 从 Mod 根路径映射中移除一个项目关联的所有条目，确保关闭项目时卸载资源索引。 */
export function removeProjectModRoots(modRootPaths: Record<string, string>, project: ProjectData): Record<string, string> {
    const next = { ...modRootPaths }
    for (const mod of project.mods) {
        delete next[mod.id]
    }
    return next
}
