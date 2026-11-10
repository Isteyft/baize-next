import type {
    BuffJsonDataItem,
    ItemJsonDataItem,
    JsonValue,
    NPCLeiXingDateItem,
    NPCWuDaoJsonItem,
    ProjectModGroupKey,
    SkillJsonDataItem,
    StaticSkillJsonDataItem,
    TuJianChunWenBenItem,
    WuDaoAllTypeJsonItem,
    WuDaoJsonItem,
} from '@baize-next/types'

/** 生成类型仅存在于编译期，用它们约束各默认模板的字段和类型完整性。 */
type DefaultRecordTemplateMap = {
    buff: Omit<BuffJsonDataItem, 'buffid'>
    item: Omit<ItemJsonDataItem, 'id'>
    skill: Omit<StaticSkillJsonDataItem, 'id'>
    shenTong: Omit<SkillJsonDataItem, 'id'>
    npcType: Omit<NPCLeiXingDateItem, 'id'>
    npcWuDao: Omit<NPCWuDaoJsonItem, 'id'>
    wuDaoAllType: Omit<WuDaoAllTypeJsonItem, 'id'>
    wuDao: Omit<WuDaoJsonItem, 'id'>
    tuJianChunWenBen: Omit<TuJianChunWenBenItem, 'id'>
}

/** 新增数据时使用的内置默认值；占位 ID 不写入模板。 */
const DEFAULT_RECORD_TEMPLATES: Partial<DefaultRecordTemplateMap> = {
    buff: {
        BuffIcon: 0,
        skillEffect: 'fx_Summoner_o',
        name: '',
        Affix: [],
        bufftype: 0,
        seid: [],
        descr: '',
        trigger: 0,
        removeTrigger: 0,
        script: 'Buff',
        looptime: 1,
        totaltime: 1,
        BuffType: 0,
        isHide: 0,
        ShowOnlyOne: 0,
    },
    item: {
        ItemIcon: 0,
        maxNum: 0,
        name: '',
        FaBaoType: '',
        Affix: [],
        TuJianType: 0,
        ShopType: 99,
        ItemFlag: [],
        WuWeiType: 0,
        ShuXingType: 0,
        type: 0,
        quality: 0,
        typePinJie: 0,
        StuTime: 0,
        seid: [],
        ShuaXin: 0,
        vagueType: 0,
        price: 0,
        desc: '',
        desc2: '',
        CanSale: 0,
        DanDu: 0,
        CanUse: 0,
        NPCCanUse: 0,
        yaoZhi1: 0,
        yaoZhi2: 0,
        yaoZhi3: 0,
        wuDao: [],
    },
    skill: {
        Skill_ID: 0,
        Skill_Lv: 0,
        name: '',
        Affix: [],
        qingjiaotype: 0,
        seid: [],
        TuJiandescr: '',
        descr: '',
        AttackType: 0,
        icon: 0,
        Skill_LV: 0,
        typePinJie: 0,
        Skill_castTime: 0,
        Skill_Speed: 0,
        DF: 0,
        TuJianType: 0,
    },
    shenTong: {
        Skill_ID: 0,
        Skill_Lv: 1,
        skillEffect: '1',
        Skill_Type: 0,
        name: '',
        qingjiaotype: 0,
        seid: [],
        Affix: [],
        Affix2: [],
        descr: '',
        TuJiandescr: '',
        Skill_LV: 1,
        AttackType: [],
        typePinJie: 1,
        script: 'SkillAttack',
        HP: 0,
        speed: 0,
        icon: 0,
        Skill_DisplayType: 0,
        skill_SameCastNum: [],
        skill_CastType: [],
        skill_Cast: [],
        DF: 0,
        TuJianType: 0,
        Skill_Open: 0,
        Skill_castTime: 0,
        canUseDistMax: 30,
        CD: 10000,
    },
    npcType: {
        Type: 1,
        LiuPai: 1,
        MengPai: 0,
        Level: 1,
        skills: [],
        staticSkills: [],
        yuanying: 0,
        HuaShenLingYu: 0,
        LingGen: [20, 20, 20, 20, 20],
        wudaoType: 61,
        NPCTag: [21, 27],
        canjiaPaiMai: 0,
        paimaifenzu: [1],
        AvatarType: 1,
        XinQuType: 7,
        equipWeapon: [1],
        equipClothing: [86],
        equipRing: [154],
        JinDanType: [1],
        FirstName: '',
        ShiLi: [1, 10],
        AttackType: 1,
        DefenseType: 0,
    },
    npcWuDao: {
        Type: 0,
        lv: 1,
        wudaoID: [],
        value1: 0,
        value2: 0,
        value3: 0,
        value4: 0,
        value5: 0,
        value6: 0,
        value7: 0,
        value8: 0,
        value9: 0,
        value10: 0,
        value11: 0,
        value12: 0,
        value21: 0,
    },
    wuDaoAllType: {
        name: '',
        name1: '',
    },
    wuDao: {
        icon: '',
        name: '',
        Cast: 0,
        Type: [],
        Lv: 1,
        seid: [],
        desc: '',
        xiaoguo: '',
        CanForget: 0,
    },
    tuJianChunWenBen: {
        name1: '',
        typenum: 0,
        type: 0,
        name2: '',
        descr: '',
    },
}

/** 各分组中仅用于创建、不得作为默认值写入的 ID 字段。 */
const TEMPLATE_ID_FIELDS: Partial<Record<ProjectModGroupKey, string>> = {
    buff: 'buffid',
    item: 'id',
    skill: 'id',
    shenTong: 'id',
    npcType: 'id',
    npcWuDao: 'id',
    wuDaoAllType: 'id',
    wuDao: 'id',
    tuJianChunWenBen: 'id',
}

function cloneJsonValue(value: JsonValue): JsonValue {
    if (Array.isArray(value)) return value.map(cloneJsonValue)
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]))
    }
    return value
}

/** 返回分组 schema 的默认字段模板（字段名 -> 默认值）；无模板时返回 null。 */
export function getDefaultRecordTemplate(groupKey: ProjectModGroupKey): Record<string, JsonValue> | null {
    const template = DEFAULT_RECORD_TEMPLATES[groupKey as keyof DefaultRecordTemplateMap]
    return template ? (template as unknown as Record<string, JsonValue>) : null
}

function numericValue(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
}

function normalizeNumberArray(value: JsonValue | undefined, fallback: JsonValue[]): JsonValue[] {
    const fallbackNumbers = fallback.map(item => numericValue(item) ?? 0)
    if (!Array.isArray(value)) return fallbackNumbers
    return value.map(item => numericValue(item)).filter((item): item is number => item !== null)
}

function normalizeRecordValue(defaultValue: JsonValue, value: JsonValue | undefined): JsonValue {
    if (Array.isArray(defaultValue)) return normalizeNumberArray(value, defaultValue)
    if (typeof defaultValue === 'number') return numericValue(value) ?? defaultValue
    if (typeof defaultValue === 'string') return typeof value === 'string' ? value : defaultValue
    if (typeof defaultValue === 'boolean') return typeof value === 'boolean' ? value : defaultValue
    if (defaultValue === null) return value === null || value === undefined ? null : cloneJsonValue(value)
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return cloneJsonValue(value)
    return cloneJsonValue(defaultValue)
}

/** 返回分组记录的业务主键字段。 */
export function getRecordIdField(groupKey: ProjectModGroupKey | null): string | undefined {
    return groupKey ? TEMPLATE_ID_FIELDS[groupKey] : undefined
}

/** 读取分组 schema 中字段的默认值；ID 字段使用记录 key 作为编辑兜底。 */
export function getDefaultRecordFieldValue(groupKey: ProjectModGroupKey | null, field: string, recordKey?: string): JsonValue | undefined {
    if (!groupKey) return undefined
    if (field === getRecordIdField(groupKey)) return numericValue(recordKey) ?? recordKey
    const value = getDefaultRecordTemplate(groupKey)?.[field]
    return value === undefined ? undefined : cloneJsonValue(value)
}
/** 返回分组 schema 的完整字段顺序，并保留数据中的未知扩展字段。 */
export function getRecordFieldNames(groupKey: ProjectModGroupKey | null, data: Record<string, JsonValue>): string[] {
    if (!groupKey) return Object.keys(data)
    const template = getDefaultRecordTemplate(groupKey)
    const idField = getRecordIdField(groupKey)
    const fields: string[] = []

    if (idField && Object.prototype.hasOwnProperty.call(data, idField)) fields.push(idField)
    for (const field of Object.keys(template ?? {})) {
        if (!fields.includes(field)) fields.push(field)
    }
    for (const field of Object.keys(data)) {
        if (!fields.includes(field)) fields.push(field)
    }
    return fields
}

/**
 * 按分组 schema 规范化记录：补齐缺失字段，并强制恢复数值、字符串和数值数组类型。
 * 未知扩展字段保留原值。
 */
export function normalizeRecordData(
    groupKey: ProjectModGroupKey,
    data: Record<string, JsonValue>,
    recordKey?: string
): Record<string, JsonValue> {
    const template = getDefaultRecordTemplate(groupKey)
    if (!template) return { ...data }

    const idField = getRecordIdField(groupKey)
    const normalized: Record<string, JsonValue> = {}

    const fields = getRecordFieldNames(groupKey, data)
    if (idField && recordKey !== undefined && !fields.includes(idField)) fields.unshift(idField)

    for (const field of fields) {
        if (field === idField) {
            normalized[field] = numericValue(data[field] ?? recordKey) ?? 0
            continue
        }

        const defaultValue = template[field]
        normalized[field] = defaultValue === undefined ? cloneJsonValue(data[field]!) : normalizeRecordValue(defaultValue, data[field])
    }

    return normalized
}

/**
 * 以内置默认值补全新增记录，创建时输入的字段会覆盖默认值。
 * 默认值中的 ID 字段不会保留。
 */
export function withDefaultRecordData(groupKey: ProjectModGroupKey, data: Record<string, JsonValue>): Record<string, JsonValue> {
    const template = getDefaultRecordTemplate(groupKey)
    if (!template) return { ...data }
    return normalizeRecordData(groupKey, { ...template, ...data })
}
