import { describe, expect, it } from 'vitest'

import { createDefaultToolExecutor, runToolCalls } from './aiAgent'
import { createAgentAccumulator } from './aiTools'

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
