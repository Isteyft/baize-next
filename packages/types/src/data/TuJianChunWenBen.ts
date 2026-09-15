/**
 * 由 Data/TuJianChunWenBen.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface TuJianChunWenBenItem {
    id: number
    name1: string
    typenum: number
    type: number
    name2: string
    descr: string
}

export type TuJianChunWenBen = Record<string, TuJianChunWenBenItem>

export type TuJianChunWenBenId = keyof TuJianChunWenBen
