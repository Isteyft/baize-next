/**
 * Generated from Data/Meta/CreateAvatarSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface CreateAvatarSeidMetaEntry {
    ID: number
    IDName?: string
    Name: string
    Desc: string
    Properties: CreateAvatarSeidMetaEntryPropertiesItem[]
    SpecialDrawer?: unknown[]
}

export interface CreateAvatarSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type CreateAvatarSeidMeta = Record<string, CreateAvatarSeidMetaEntry>
