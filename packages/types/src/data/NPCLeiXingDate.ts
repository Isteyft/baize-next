/**
 * 由 Data/NPCLeiXingDate.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface NPCLeiXingDateItem {
    id: number
    Type: number
    LiuPai: number
    MengPai: number
    Level: number
    skills: number[]
    staticSkills: number[]
    yuanying: number
    HuaShenLingYu: number
    LingGen: number[]
    wudaoType: number
    NPCTag: number[]
    canjiaPaiMai: number
    paimaifenzu: number[]
    AvatarType: number
    XinQuType: number
    equipWeapon: number[]
    equipClothing: number[]
    equipRing: number[]
    JinDanType: number[]
    FirstName: string
    ShiLi: number[]
    AttackType: number
    DefenseType: number
}

export type NPCLeiXingDate = Record<string, NPCLeiXingDateItem>

export type NPCLeiXingDateId = keyof NPCLeiXingDate
