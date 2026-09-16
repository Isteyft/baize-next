/**
 * 由 Data/WuDaoAllTypeJson.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface WuDaoAllTypeJsonItem {
    id: number
    name: string
    name1: string
}

export type WuDaoAllTypeJson = Record<string, WuDaoAllTypeJsonItem>

export type WuDaoAllTypeJsonId = keyof WuDaoAllTypeJson
