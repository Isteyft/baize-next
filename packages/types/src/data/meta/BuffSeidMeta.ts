/**
 * Generated from Data/Meta/BuffSeidMeta.json.
 * Do not edit manually; regenerate when the JSON meta source changes.
 */

export interface BuffSeidMetaEntry {
    ID: number
    IDName: string
    Name: string
    Desc: string
    Properties: BuffSeidMetaEntryPropertiesItem[]
    Ignore?: boolean
    SpecialDrawer?: unknown[]
}

export interface BuffSeidMetaEntryPropertiesItem {
    ID: string
    Type: string
    Desc: string
    SpecialDrawer?: string[]
}

export type BuffSeidMeta = Record<string, BuffSeidMetaEntry>
