/**
 * 由 Data/BuffJsonData目录 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface BuffJsonDataItem {
    Affix: number[]
    BuffIcon: number
    BuffType: number
    ShowOnlyOne: 0 | 1
    buffid: number
    bufftype: number
    descr: string
    isHide: 0 | 1
    looptime: number
    name: string
    removeTrigger: number
    script: string
    seid: number[]
    skillEffect: string
    totaltime: number
    trigger: number
}

export type BuffJsonData = Record<string, BuffJsonDataItem>

export type BuffJsonDataId = keyof BuffJsonData
