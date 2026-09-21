import type { JsonRecord } from '@baize-next/types'

/**
 * 批量修改 JSON 记录 ID 时的一次替换操作。
 */
export interface BatchIdChange {
    /** 修改前的 record.key。 */
    oldKey: string
    /** 修改后应使用的 record.key。 */
    newKey: string
    /** 当前分组的主键字段，例如 id / buffid。 */
    field: string
    /** 写入主键字段的新 ID。 */
    value: string | number
}

export type BatchIdFailureCode = 'no-primary-field' | 'no-selection' | 'invalid-first-id' | 'conflict'

export interface BatchIdFailure {
    ok: false
    code: BatchIdFailureCode
    /** 可展示给用户的错误信息。 */
    message: string
    /** conflict 状态下的占用 ID。 */
    conflictingId?: string
}

export interface BatchIdSuccess {
    ok: true
    /** 必须全部通过冲突校验后才能执行的替换列表。 */
    changes: BatchIdChange[]
}

export type BatchIdResult = BatchIdSuccess | BatchIdFailure

const INTEGER_PATTERN = /^-?\d+$/
const DECIMAL_PATTERN = /^-?\d+\.\d+$/

/** 具有前导零的整数（如 "003"）按字符串形态递增，避免丢失格式化信息。 */
function hasLeadingZeros(input: string): boolean {
    return input.length > 1 && /^0+/.test(input) && !input.startsWith('-')
}

/** 尝试将“首个 ID”解析为可递增的数字。 */
function parseNumericBase(input: string): number | null {
    if (hasLeadingZeros(input)) return null
    if (!INTEGER_PATTERN.test(input)) return null
    const parsed = Number(input)
    return Number.isSafeInteger(parsed) ? parsed : null
}

/** 捕获末尾数字后缀，用于“ABC1, ABC2, ...”这类字符串 ID。 */
const SUFFIX_PATTERN = /^(.*?)(\d+)$/

/** 根据首个 ID 预生成 N 个新 ID（数字保持 number，字符串保留字符串形态）。 */
function buildNewIds(firstId: string, count: number): { values: (string | number)[] } | { error: string } {
    const numericBase = parseNumericBase(firstId)
    if (numericBase !== null) {
        const values: number[] = []
        for (let index = 0; index < count; index += 1) {
            const value = numericBase + index
            if (!Number.isSafeInteger(value)) return { error: '首个 ID 过大，无法生成连续 ID' }
            values.push(value)
        }
        return { values }
    }

    // 纯数字小数字符串不能作为可递增 ID。
    if (DECIMAL_PATTERN.test(firstId)) {
        return { error: '首个 ID 必须是整数或包含可递增数字后缀的字符串' }
    }

    const suffixMatch = firstId.match(SUFFIX_PATTERN)
    if (!suffixMatch) {
        return { error: '首个 ID 必须是整数或包含可递增数字后缀的字符串' }
    }
    const prefix = suffixMatch[1] ?? ''
    const suffix = suffixMatch[2] ?? ''
    const suffixNumber = Number(suffix)
    if (!Number.isSafeInteger(suffixNumber)) {
        return { error: '首个 ID 过大，无法生成连续 ID' }
    }
    const width = suffix.length
    const values: string[] = []
    for (let index = 0; index < count; index += 1) {
        const nextSuffix = suffixNumber + index
        if (!Number.isSafeInteger(nextSuffix)) return { error: '首个 ID 过大，无法生成连续 ID' }
        values.push(`${prefix}${String(nextSuffix).padStart(width, '0')}`)
    }
    return { values }
}

/**
 * 预生成批量修改后的 ID，并检查是否与当前已有 ID 冲突。
 *
 * 原子性保证：本函数只返回“计划”，不会修改任何数据。调用方只有在
 * `ok === true` 时才应把 `changes` 应用到内存数据；任意一个新 ID 被占用
 * 都会返回 conflict，此时调用方不得执行任何修改。
 */
export function buildBatchIdReplacements(
    records: JsonRecord[],
    selectedKeys: readonly string[],
    primaryField: string | null,
    firstIdInput: string
): BatchIdResult {
    if (!primaryField) {
        return { ok: false, code: 'no-primary-field', message: '当前分组没有可修改的 ID 字段' }
    }

    const selectedKeySet = new Set(selectedKeys)
    const selectedRecords = records.filter(record => selectedKeySet.has(record.key))
    if (selectedRecords.length === 0) {
        return { ok: false, code: 'no-selection', message: '请先选择至少一条记录' }
    }

    const firstId = firstIdInput.trim()
    if (!firstId) {
        return { ok: false, code: 'invalid-first-id', message: '请输入首个 ID' }
    }

    const generated = buildNewIds(firstId, selectedRecords.length)
    if ('error' in generated) {
        return { ok: false, code: 'invalid-first-id', message: generated.error }
    }
    const values = generated.values
    const finalKeys = values.map(String)
    if (new Set(finalKeys).size !== finalKeys.length) {
        return { ok: false, code: 'invalid-first-id', message: '首个 ID 无法生成合法序列' }
    }

    // 只把未被选中记录仍占用的 ID / key 视为冲突；选中记录自身会释放旧 ID。
    const occupied = new Set<string>()
    for (const record of records) {
        if (selectedKeySet.has(record.key)) continue
        occupied.add(record.key)
        const currentId = record.data[primaryField]
        if (typeof currentId === 'string' || typeof currentId === 'number') occupied.add(String(currentId))
    }

    for (const nextKey of finalKeys) {
        if (occupied.has(nextKey)) {
            return {
                ok: false,
                code: 'conflict',
                message: `ID ${nextKey} 已被占用，批量修改已取消。`,
                conflictingId: nextKey,
            }
        }
    }

    const changes: BatchIdChange[] = selectedRecords.map((record, index) => {
        const nextKey = finalKeys[index]!
        return { oldKey: record.key, newKey: nextKey, field: primaryField, value: values[index]! }
    })

    return { ok: true, changes }
}
