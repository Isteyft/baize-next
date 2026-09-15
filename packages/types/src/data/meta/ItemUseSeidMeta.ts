/**
 * Generated from Data/Meta/ItemUseSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface ItemUseSeidMetaEntry {
    ID: number
    IDName: string
    Name: string
    Desc: string
    Properties: ItemUseSeidMetaEntryPropertiesItem[]
    SpecialDrawer?: unknown[]
}

export interface ItemUseSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type ItemUseSeidMeta = Record<string, ItemUseSeidMetaEntry>
