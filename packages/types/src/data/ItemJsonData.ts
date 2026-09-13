/**
 * 由 Data/ItemJsonData目录 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface ItemJsonDataItem {
    Affix: number[]
    CanSale: number
    CanUse: number
    DanDu: number
    FaBaoType: string
    ItemFlag: number[]
    ItemIcon: number
    NPCCanUse: number
    ShopType: number
    ShuXingType: number
    ShuaXin: number
    StuTime: number
    TuJianType: number
    WuWeiType: number
    desc: string
    desc2: string
    id: number
    maxNum: number
    name: string
    price: number
    quality: number
    seid: number[]
    type: number
    typePinJie: number
    vagueType: number
    wuDao: number[]
    yaoZhi1: number
    yaoZhi2: number
    yaoZhi3: number
}

export type ItemJsonData = Record<string, ItemJsonDataItem>

export type ItemJsonDataId = keyof ItemJsonData
