/**
 * 由 Data/NPCWuDaoJson.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface NPCWuDaoJsonItem {
    id: number
    Type: number
    lv: number
    wudaoID: number[]
    value1: number
    value2: number
    value3: number
    value4: number
    value5: number
    value6: number
    value7: number
    value8: number
    value9: number
    value10: number
    value11: number
    value12: number
    value21: number
}

export type NPCWuDaoJson = Record<string, NPCWuDaoJsonItem>

export type NPCWuDaoJsonId = keyof NPCWuDaoJson
