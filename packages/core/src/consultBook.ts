import type { JsonRecord, JsonValue } from '@baize-next/types'

/** 生成请教书籍时的新 ID 偏移量：新ID = 原ID + 1,000,000,000 */
export const CONSULT_BOOK_ID_OFFSET = 1_000_000_000

/** 原ID 允许的最大值，超过该值无法生成请教书籍 */
export const CONSULT_BOOK_MAX_BASE_ID = 1_000_000_000

/** 请教书籍强制使用的商铺类型 */
export const CONSULT_BOOK_SHOP_TYPE = 99

/** 可生成请教书籍的物品种类：3=神通书，4=功法书 */
export const CONSULT_BOOK_ITEM_TYPES = [3, 4] as const

/**
 * Mod 物品数据的严格最小类型。
 * 实际项目中 ItemJsonData 的字段为小写 id/type/price，
 * 但新增的请教书籍只强制覆盖 id、ShopType、ItemFlag、price 四个字段。
 */
export interface ModItemData extends Record<string, JsonValue> {
    id: number
    type: number
    name: string
    ShopType: number
    ItemFlag: number[]
    price: number
}

export type ConsultBookValidationReason = 'id-over-limit' | 'invalid-type' | 'id-conflict'

export type ConsultBookGenerationResult =
    | {
          ok: true
          sourceId: number
          targetId: number
          sourceName: string
          record: JsonRecord
      }
    | {
          ok: false
          reason: ConsultBookValidationReason
          sourceId?: number
          targetId?: number
          message: string
      }

function cloneJsonValue(value: JsonValue): JsonValue {
    if (Array.isArray(value)) return value.map(cloneJsonValue)
    if (value !== null && typeof value === 'object') {
        const result: Record<string, JsonValue> = {}
        for (const [key, entry] of Object.entries(value)) result[key] = cloneJsonValue(entry)
        return result
    }
    return value
}

function numericValue(value: JsonValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
}

function isConsultBookItemType(type: number): boolean {
    return type === CONSULT_BOOK_ITEM_TYPES[0] || type === CONSULT_BOOK_ITEM_TYPES[1]
}

/** 判断某物品记录是否为可生成请教书籍的神通书（type=3）或功法书（type=4）。 */
export function isConsultBookItem(record: JsonRecord): boolean {
    const id = numericValue(record.data.id ?? record.key)
    const itemType = numericValue(record.data.type)
    return id !== null && itemType !== null && isConsultBookItemType(itemType)
}

/** 深拷贝原物品并生成请教书籍记录，强制覆盖新 ID、ShopType、ItemFlag、price。 */
export function createConsultBookRecord(record: JsonRecord, sourceId: number): JsonRecord {
    const targetId = sourceId + CONSULT_BOOK_ID_OFFSET
    const data: Record<string, JsonValue> = {}
    for (const [key, value] of Object.entries(record.data)) data[key] = cloneJsonValue(value)

    data.id = targetId
    data.ShopType = CONSULT_BOOK_SHOP_TYPE
    data.ItemFlag = []
    data.price = 0

    return { key: String(targetId), data }
}

/**
 * 执行“生成请教书籍”的前置校验并构造结果：
 * 1. 原 ID 是否超过十亿；2. 物品种类是否属于神通书/功法书；3. 目标 ID 是否已存在。
 */
export function validateConsultBookGeneration(record: JsonRecord, existingRecords: JsonRecord[]): ConsultBookGenerationResult {
    const sourceId = numericValue(record.data.id ?? record.key)

    if (sourceId === null || sourceId > CONSULT_BOOK_MAX_BASE_ID) {
        return {
            ok: false,
            reason: 'id-over-limit',
            sourceId: sourceId ?? undefined,
            message: `当前物品 ID:${sourceId ?? record.data.id ?? record.key} 超出十亿上限，无法创建请教书籍`,
        }
    }

    const itemType = numericValue(record.data.type)
    if (itemType === null || !isConsultBookItemType(itemType)) {
        return {
            ok: false,
            reason: 'invalid-type',
            sourceId,
            message: `当前物品 ID:${sourceId} 类型不为神通或功法书籍，无法创建请教书籍`,
        }
    }

    const targetId = sourceId + CONSULT_BOOK_ID_OFFSET
    const targetKey = String(targetId)
    const conflict = existingRecords.some(existing => existing.key === targetKey || numericValue(existing.data.id) === targetId)
    if (conflict) {
        return {
            ok: false,
            reason: 'id-conflict',
            sourceId,
            targetId,
            message: `当前物品 ID:${sourceId} 对应的请教书籍已存在，无法创建`,
        }
    }

    const name = typeof record.data.name === 'string' ? record.data.name : ''
    return {
        ok: true,
        sourceId,
        targetId,
        sourceName: name,
        record: createConsultBookRecord(record, sourceId),
    }
}
