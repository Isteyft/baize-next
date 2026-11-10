import { describe, expect, it } from 'vitest'

import {
    accumulateRecord,
    accumulateSeid,
    accumulatorToResult,
    buildToolDefinitions,
    createAgentAccumulator,
    GLOBAL_SYSTEM_PROMPT,
    hasAccumulatedContent,
    parseAskUserArgs,
    parseCreateRecordArgs,
    parseSearchRecordArgs,
    parseToolArguments,
    parseWriteSeidArgs,
} from './aiTools'

describe('GLOBAL_SYSTEM_PROMPT', () => {
    it('默认是空字符串，作为可扩展的预留位', () => {
        expect(GLOBAL_SYSTEM_PROMPT).toBe('')
    })
})

describe('parseToolArguments', () => {
    it('解析合法 JSON 对象', () => {
        expect(parseToolArguments('{"a":1}')).toEqual({ a: 1 })
    })

    it('非法 JSON 返回 null', () => {
        expect(parseToolArguments('not-json')).toBeNull()
    })

    it('非对象（数组）返回 null', () => {
        expect(parseToolArguments('[1,2,3]')).toBeNull()
    })
})

describe('parseCreateRecordArgs', () => {
    it('解析合法记录', () => {
        const result = parseCreateRecordArgs({ group: 'buff', key: '100', data: { buffid: 100, name: '灼烧' } })
        expect(result).toEqual({ group: 'buff', key: '100', data: { buffid: 100, name: '灼烧' } })
    })

    it('缺 group 返回 null', () => {
        expect(parseCreateRecordArgs({ key: '100', data: {} })).toBeNull()
    })

    it('非白名单 group 返回 null', () => {
        expect(parseCreateRecordArgs({ group: 'unknown', key: '100', data: {} })).toBeNull()
    })

    it('缺 data 返回 null', () => {
        expect(parseCreateRecordArgs({ group: 'buff', key: '100' })).toBeNull()
    })
})

describe('parseWriteSeidArgs', () => {
    it('解析合法 seid 参数', () => {
        expect(parseWriteSeidArgs({ dataKey: 'buff', seidId: '3', targetKey: '100', params: { value1: 5 } })).toEqual({
            dataKey: 'buff',
            seidId: '3',
            targetKey: '100',
            params: { value1: 5 },
        })
    })

    it('缺字段返回 null', () => {
        expect(parseWriteSeidArgs({ dataKey: 'buff', seidId: '3' })).toBeNull()
    })
})

describe('parseSearchRecordArgs', () => {
    it('解析分组与关键词', () => {
        expect(parseSearchRecordArgs({ group: 'buff', query: '剑气' })).toEqual({ group: 'buff', query: '剑气' })
    })

    it('缺 query 时默认为空字符串', () => {
        expect(parseSearchRecordArgs({ group: 'buff' })).toEqual({ group: 'buff', query: '' })
    })

    it('非白名单 group 返回 null', () => {
        expect(parseSearchRecordArgs({ group: 'unknown', query: 'x' })).toBeNull()
    })
})

describe('parseAskUserArgs', () => {
    it('解析问题', () => {
        expect(parseAskUserArgs({ question: 'id 用多少？', kind: 'number' })).toEqual({
            question: 'id 用多少？',
            kind: 'number',
            options: undefined,
        })
    })

    it('缺 question 返回 null', () => {
        expect(parseAskUserArgs({ kind: 'text' })).toBeNull()
    })

    it('解析 options', () => {
        expect(parseAskUserArgs({ question: '选一个', kind: 'options', options: ['a', 'b'] })).toEqual({
            question: '选一个',
            kind: 'options',
            options: ['a', 'b'],
        })
    })
})

describe('accumulator 累积', () => {
    it('累积记录，同 key 同分组覆盖', () => {
        let acc = createAgentAccumulator()
        acc = accumulateRecord(acc, { group: 'buff', key: '100', data: { name: 'a' } })
        acc = accumulateRecord(acc, { group: 'buff', key: '100', data: { name: 'b' } })
        expect(acc.records).toHaveLength(1)
        expect(acc.records[0].data.name).toBe('b')
    })

    it('累积 seid 参数', () => {
        let acc = createAgentAccumulator()
        acc = accumulateSeid(acc, { dataKey: 'buff', seidId: '3', targetKey: '100', params: { value1: 5 } })
        expect(acc.seidData.buff?.['3']?.['100']).toEqual({ value1: 5 })
    })

    it('空累积器无内容', () => {
        expect(hasAccumulatedContent(createAgentAccumulator())).toBe(false)
    })

    it('accumulatorToResult 转换结构', () => {
        const acc = accumulateRecord(createAgentAccumulator(), { group: 'buff', key: '100', data: { name: 'a' } })
        expect(accumulatorToResult(acc)).toEqual({ records: [{ group: 'buff', key: '100', data: { name: 'a' } }], seidData: {} })
    })
})

describe('buildToolDefinitions', () => {
    it('包含 create_record / search_record / write_seid / ask_user 四个工具', () => {
        const tools = buildToolDefinitions()
        const names = tools.map(tool => tool.function.name)
        expect(names).toEqual(['create_record', 'search_record', 'write_seid', 'ask_user'])
    })
})
