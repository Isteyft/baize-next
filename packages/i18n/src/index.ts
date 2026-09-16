/**
 * 字段表头 i18n 映射。
 * 数据优先读取 zh-CN，缺失时再回退到英文或原始字段名。
 */

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

/** 当前支持的界面语言。 */
export type LocaleCode = 'zh-CN' | 'en'

type LocaleMessages = typeof zhCN

/** 应用内分组键与 locale JSON 数据集名称的映射。 */
const GROUP_KEY_ALIASES = {
    config: 'ModConfig',
    buff: 'BuffJsonData',
    item: 'ItemJsonData',
    skill: 'StaticSkillJsonData',
    shenTong: 'SkillJsonData',
    npcType: 'NPCLeiXingDate',
    npcWuDao: 'NPCWuDaoJson',
    wuDaoAllType: 'WuDaoAllTypeJson',
    wuDao: 'WuDaoJson',
    tuJianChunWenBen: 'TuJianChunWenBen',
} as const

function resolveGroupKey(groupKey: string): string {
    return GROUP_KEY_ALIASES[groupKey as keyof typeof GROUP_KEY_ALIASES] ?? groupKey
}

function getLocaleLabel(locale: LocaleMessages, groupKey: string, field: string): string | undefined {
    const group = locale[groupKey as keyof LocaleMessages] as Record<string, string> | undefined
    return group?.[field]
}

/**
 * 获取数据分组对应的字段表头。
 * 默认优先使用简体中文，中文缺失时再使用英文，最后原样返回字段名。
 * @param groupKey 数据分组键。
 * @param field 原始字段名。
 * @param locale 期望语言，默认简体中文。
 * @returns 字段表头文案。
 */
export function translateField(groupKey: string, field: string, locale: LocaleCode = 'zh-CN'): string {
    const resolvedGroupKey = resolveGroupKey(groupKey)
    const locales = locale === 'en' ? [en, zhCN] : [zhCN, en]

    for (const messages of locales) {
        const label = getLocaleLabel(messages, resolvedGroupKey, field)
        if (label) return label
    }

    return field
}
