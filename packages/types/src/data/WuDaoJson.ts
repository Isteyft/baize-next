/**
 * 由 Data/WuDaoJson.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface WuDaoJsonItem {
    id: number
    icon: string
    name: string
    Cast: number
    Type: number[]
    Lv: number
    seid: number[]
    desc: string
    xiaoguo: string
    CanForget: number
}

export type WuDaoJson = Record<string, WuDaoJsonItem>

export type WuDaoJsonId = keyof WuDaoJson
