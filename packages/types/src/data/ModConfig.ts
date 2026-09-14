/**
 * 由 modConfig.json 解析生成的 TypeScript 类型。
 * Settings 为设置数组，每一项是一个设置选项（结构待补充）。
 */

export interface ModConfig {
    Name: string
    Author: string
    Version: string
    Description: string
    Settings: ModConfigSetting[]
}

/** 设置选项的具体键值结构待补充 */
export interface ModConfigSetting {
    [key: string]: unknown
}
