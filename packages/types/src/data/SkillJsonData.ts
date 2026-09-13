/**
 * 由 Data/skillJsonData目录 解析生成的 TypeScript 类型。
 * 请勿手动修改，若 JSON 数据变更，应重新解析更新。
 */

export interface SkillJsonDataItem {
    Affix: number[]
    Affix2: number[]
    AttackType: number[]
    CD: number
    DF: number
    HP: number
    Skill_DisplayType: number
    Skill_ID: number
    Skill_LV: number
    Skill_Lv: number
    Skill_Open: number
    Skill_Type: number
    Skill_castTime: number
    TuJianType: number
    TuJiandescr: string
    canUseDistMax: number
    descr: string
    icon: number
    id: number
    name: string
    qingjiaotype: number
    script: string
    seid: number[]
    skillEffect: string
    skill_Cast: number[]
    skill_CastType: number[]
    skill_SameCastNum: number[]
    speed: number
    typePinJie: number
}

export type SkillJsonData = Record<string, SkillJsonDataItem>

export type SkillJsonDataId = keyof SkillJsonData
