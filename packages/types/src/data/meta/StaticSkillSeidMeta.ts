/**
 * Generated from Data/Meta/StaticSkillSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface StaticSkillSeidMetaEntry {
    ID: number
    IDName: string
    Name: string
    Desc: string
    Properties: StaticSkillSeidMetaEntryPropertiesItem[]
    SpecialDrawer: unknown[]
}

export interface StaticSkillSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type StaticSkillSeidMeta = Record<string, StaticSkillSeidMetaEntry>
