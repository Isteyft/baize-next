import type { JsonRecord, ProjectData, ProjectModGroupKey } from '@baize-next/types'

import { getRecordIdField } from './defaultRecordTemplates'

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

interface RecordSortKey {
    number: number | null
    text: string
}

/** 取记录的排序键：优先主键字段数值，其次数值化 key，无法数值化时按字符串。 */
function recordSortKey(record: JsonRecord, groupKey: ProjectModGroupKey): RecordSortKey {
    const idField = getRecordIdField(groupKey)
    const raw = idField ? record.data[idField] : undefined
    if (typeof raw === 'number') return { number: raw, text: String(raw) }
    if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw.trim()))) {
        return { number: Number(raw.trim()), text: raw.trim() }
    }
    const keyNumber = Number(record.key)
    if (record.key.trim() !== '' && Number.isFinite(keyNumber)) return { number: keyNumber, text: record.key }
    return { number: null, text: record.key }
}

function compareSortKeys(left: RecordSortKey, right: RecordSortKey): number {
    if (left.number !== null && right.number !== null) return left.number - right.number
    if (left.number !== null) return -1
    if (right.number !== null) return 1
    return left.text.localeCompare(right.text)
}

/**
 * 按主键数字序将新记录插入到正确位置，保持 records 数组始终有序。
 * 无法数值化的记录按字符串顺序排在有数值键的记录之后。
 */
export function insertRecordSorted(groupKey: ProjectModGroupKey, records: JsonRecord[], nextRecord: JsonRecord): JsonRecord[] {
    const next = recordSortKey(nextRecord, groupKey)
    let index = records.length
    for (let i = 0; i < records.length; i += 1) {
        if (compareSortKeys(next, recordSortKey(records[i]!, groupKey)) <= 0) {
            index = i
            break
        }
    }
    const result = [...records]
    result.splice(index, 0, nextRecord)
    return result
}
