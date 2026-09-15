/**
 * Generated from Data/Meta/SkillSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface SkillSeidMetaEntry {
    ID: number
    IDName: string
    Name: string
    Desc: string
    Properties?: SkillSeidMetaEntryPropertiesItem[]
    SpecialDrawer?: SkillSeidMetaEntrySpecialDrawerItem[]
}

export interface SkillSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export interface SkillSeidMetaEntrySpecialDrawerItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type SkillSeidMeta = Record<string, SkillSeidMetaEntry>
