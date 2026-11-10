import { describe, expect, it } from 'vitest'

import { createDefaultToolExecutor, runToolCalls, searchExistingRecords } from './aiAgent'
import { createAgentAccumulator } from './aiTools'

describe('searchExistingRecords', () => {
    const index = {
        buff: [
            { key: '100', data: { buffid: 100, name: '剑气' } },
            { key: '101', data: { buffid: 101, name: '灼烧' } },
        ],
        skill: [{ key: '261030', data: { Skill_ID: 261030, name: '剑心通明诀' } }],
    }

    it('按关键词查询返回匹配记录摘要', () => {
        const result = searchExistingRecords(index, { group: 'buff', query: '剑气' })
        expect(result).toContain('100 剑气')
        expect(result).not.toContain('灼烧')
    })

    it('空 query 返回该分组全部记录', () => {
        const result = searchExistingRecords(index, { group: 'buff', query: '' })
        expect(result).toContain('100 剑气')
        expect(result).toContain('101 灼烧')
    })

    it('分组无记录时返回提示', () => {
        const result = searchExistingRecords(index, { group: 'item', query: '' })
        expect(result).toContain('暂无已有记录')
    })

    it('未匹配时返回提示', () => {
        const result = searchExistingRecords(index, { group: 'buff', query: '不存在' })
        expect(result).toContain('未找到')
    })

    it('功法分组用 Skill_ID 作为主键摘要', () => {
        const result = searchExistingRecords(index, { group: 'skill', query: '剑心' })
        expect(result).toContain('261030 剑心通明诀')
    })
})

describe('runToolCalls', () => {
    const executor = createDefaultToolExecutor()

    it('执行 create_record 累积记录', () => {
        const acc = createAgentAccumulator()
        const { next, askUser } = runToolCalls(
            acc,
            [{ id: 'c1', name: 'create_record', arguments: JSON.stringify({ group: 'buff', key: '100', data: { buffid: 100 } }) }],
            executor
        )
        expect(next.records).toHaveLength(1)
        expect(next.records[0].key).toBe('100')
        expect(askUser).toBeNull()
    })

    it('执行 write_seid 累积 seid 参数', () => {
        const acc = createAgentAccumulator()
        const { next } = runToolCalls(
            acc,
            [
                {
                    id: 'c1',
                    name: 'write_seid',
                    arguments: JSON.stringify({ dataKey: 'buff', seidId: '3', targetKey: '100', params: { value1: 5 } }),
                },
            ],
            executor
        )
        expect(next.seidData.buff?.['3']?.['100']).toEqual({ value1: 5 })
    })

    it('识别 ask_user 并通过返回值暴露', () => {
        const acc = createAgentAccumulator()
        const { askUser } = runToolCalls(
            acc,
            [{ id: 'c1', name: 'ask_user', arguments: JSON.stringify({ question: 'id 用多少？', kind: 'number' }) }],
            executor
        )
        expect(askUser).toEqual({ question: 'id 用多少？', kind: 'number', options: undefined })
    })

    it('非法工具参数返回反馈但累积器不变', () => {
        const acc = createAgentAccumulator()
        const { next, feedbacks } = runToolCalls(acc, [{ id: 'c1', name: 'create_record', arguments: 'not-json' }], executor)
        expect(next.records).toHaveLength(0)
        expect(feedbacks[0].content).toContain('不是合法 JSON')
    })

    it('未知工具返回未知工具反馈', () => {
        const acc = createAgentAccumulator()
        const { feedbacks } = runToolCalls(acc, [{ id: 'c1', name: 'unknown_tool', arguments: '{}' }], executor)
        expect(feedbacks[0].content).toContain('未知工具')
    })

    it('执行 search_record 返回查询结果且不改变累积器', () => {
        const acc = createAgentAccumulator()
        const indexedExecutor = createDefaultToolExecutor({
            buff: [{ key: '100', data: { buffid: 100, name: '剑气' } }],
        })
        const { next, feedbacks } = runToolCalls(
            acc,
            [{ id: 'c1', name: 'search_record', arguments: JSON.stringify({ group: 'buff', query: '剑气' }) }],
            indexedExecutor
        )
        expect(next.records).toHaveLength(0)
        expect(feedbacks[0].content).toContain('100 剑气')
    })

    it('search_record 缺少 group 返回非法反馈', () => {
        const acc = createAgentAccumulator()
        const { feedbacks } = runToolCalls(acc, [{ id: 'c1', name: 'search_record', arguments: '{}' }], executor)
        expect(feedbacks[0].content).toContain('参数非法')
    })

    it('多个工具调用按顺序执行', () => {
        const acc = createAgentAccumulator()
        const { next } = runToolCalls(
            acc,
            [
                { id: 'c1', name: 'create_record', arguments: JSON.stringify({ group: 'buff', key: '100', data: { buffid: 100 } }) },
                {
                    id: 'c2',
                    name: 'write_seid',
                    arguments: JSON.stringify({ dataKey: 'buff', seidId: '3', targetKey: '100', params: { value1: 5 } }),
                },
            ],
            executor
        )
        expect(next.records).toHaveLength(1)
        expect(next.seidData.buff?.['3']?.['100']).toEqual({ value1: 5 })
    })
})
