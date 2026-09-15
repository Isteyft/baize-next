/**
 * 由 Data/StaticSkillJsonData.json 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface StaticSkillJsonDataItem {
    Affix: number[]
    AttackType: number
    DF: 0 | 1
    Skill_ID: number
    Skill_LV: number
    Skill_Lv: number
    Skill_Speed: number
    Skill_castTime: number
    TuJianType: number
    TuJiandescr: string
    descr: string
    icon: number
    id: number
    name: string
    qingjiaotype: number
    seid: number[]
    typePinJie: number
}

export type StaticSkillJsonData = Record<string, StaticSkillJsonDataItem>

export type StaticSkillJsonDataId = keyof StaticSkillJsonData
