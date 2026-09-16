import type { JsonRecord, JsonValue, ProjectMod, ProjectModGroupKey } from '@baize-next/types'

import { withDefaultRecordData } from './defaultRecordTemplates'

export type SkillBookSourceGroupKey = 'skill' | 'shenTong'

export interface SkillBookGeneration {
    item: JsonRecord
    seidId: string
    seidValue: Record<string, JsonValue>
    skillId: number
}

export type SkillBookGenerationError = 'source-not-found' | 'missing-skill-id' | 'item-id-exists'

export type AppendSkillBookResult =
    | {
          ok: true
          item: JsonRecord
          mod: ProjectMod
          skillId: number
      }
    | {
          ok: false
          reason: SkillBookGenerationError
          skillId?: number
      }

function numericValue(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
}

function copyArray(value: JsonValue | undefined): JsonValue[] {
    return Array.isArray(value) ? value.map(item => (Array.isArray(item) ? [...item] : item)) : []
}

/** 判断当前分组是否可生成技能书。 */
export function isSkillBookSourceGroup(groupKey: ProjectModGroupKey | null): groupKey is SkillBookSourceGroupKey {
    return groupKey === 'skill' || groupKey === 'shenTong'
}

/** 根据功法或神通记录构造技能书物品及对应 Seid 参数。 */
export function createSkillBookGeneration(groupKey: SkillBookSourceGroupKey, source: JsonRecord): SkillBookGeneration | null {
    const skillId = numericValue(source.data.Skill_ID)
    if (skillId === null) return null

    const isShenTong = groupKey === 'shenTong'
    const seidId = isShenTong ? '1' : '2'
    const descr = source.data.descr ?? ''
    const sourceAffix = isShenTong ? source.data.Affix2 : source.data.Affix
    const item: JsonRecord = {
        key: String(skillId),
        data: withDefaultRecordData('item', {
            id: skillId,
            ItemIcon: isShenTong ? 3001 : 3002,
            maxNum: 1,
            name: source.data.name ?? '',
            Affix: copyArray(sourceAffix),
            type: isShenTong ? 3 : 4,
            quality: source.data.Skill_LV ?? 0,
            typePinJie: source.data.typePinJie ?? 0,
            seid: [Number(seidId)],
            desc: descr,
            desc2: descr,
        }),
    }

    return {
        item,
        seidId,
        seidValue: {
            id: skillId,
            value1: skillId,
        },
        skillId,
    }
}

/** 将技能书物品及其 Seid 参数追加到指定 mod；物品 ID 已存在时不覆盖。 */
export function appendSkillBookToMod(mod: ProjectMod, sourceGroupKey: ProjectModGroupKey, sourceRecordKey: string): AppendSkillBookResult {
    if (!isSkillBookSourceGroup(sourceGroupKey)) return { ok: false, reason: 'source-not-found' }

    const source = mod.groups.find(group => group.key === sourceGroupKey)?.records.find(record => record.key === sourceRecordKey)
    if (!source) return { ok: false, reason: 'source-not-found' }

    const generation = createSkillBookGeneration(sourceGroupKey, source)
    if (!generation) return { ok: false, reason: 'missing-skill-id' }

    const itemGroup = mod.groups.find(group => group.key === 'item')
    const itemExists = itemGroup?.records.some(
        record => record.key === generation.item.key || numericValue(record.data.id) === generation.skillId
    )
    if (itemExists) return { ok: false, reason: 'item-id-exists', skillId: generation.skillId }

    const groups = mod.groups.map(group => (group.key === 'item' ? { ...group, records: [...group.records, generation.item] } : group))
    const seidData = { ...(mod.seidData ?? {}) }
    const itemUse = { ...(seidData.itemUse ?? {}) }
    const seidRecords = { ...(itemUse[generation.seidId] ?? {}) }
    seidRecords[generation.item.key] = generation.seidValue
    itemUse[generation.seidId] = seidRecords
    seidData.itemUse = itemUse

    return {
        ok: true,
        item: generation.item,
        mod: { ...mod, groups, seidData },
        skillId: generation.skillId,
    }
}
