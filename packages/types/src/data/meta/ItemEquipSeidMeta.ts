/**
 * Generated from Data/Meta/ItemEquipSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface ItemEquipSeidMetaEntry {
    ID: number
    IDName: string
    Name: string
    Desc: string
    Properties: ItemEquipSeidMetaEntryPropertiesItem[]
}

export interface ItemEquipSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type ItemEquipSeidMeta = Record<string, ItemEquipSeidMetaEntry>
