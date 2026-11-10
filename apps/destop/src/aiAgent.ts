import type { ChatMessage } from './ai'
import type { GeneratedResult } from './aiGeneration'
import {
    accumulateRecord,
    accumulateSeid,
    accumulatorToResult,
    type AgentAccumulator,
    type AskUserArgs,
    hasAccumulatedContent,
    parseAskUserArgs,
    parseCreateRecordArgs,
    parseToolArguments,
    parseWriteSeidArgs,
    type ToolCall,
} from './aiTools'

/** agent 循环配置。 */
export interface AgentLoopConfig {
    /** 单轮 AI 请求的最大轮数，防止无限循环。 */
    maxRounds: number
}

/** 单轮执行结果：告知调用方本轮发生了什么。 */
export interface AgentRoundOutcome {
    /** 本轮 AI 回复的文本内容。 */
    content: string
    /** 本轮发起的工具调用。 */
    toolCalls: ToolCall[]
    /** 累积到当前轮的可落库结果。 */
    accumulated: AgentAccumulator
    /** 本轮是否请求向用户提问（有 ask_user 调用）。 */
    askUser: AskUserArgs | null
}

/** 执行工具调用的回调：返回每类工具的处理结果文本（回传给模型）。 */
export interface ToolExecutor {
    /** 执行 create_record，返回回传给模型的文本。 */
    createRecord: (acc: AgentAccumulator, raw: Record<string, unknown>) => { next: AgentAccumulator; feedback: string }
    /** 执行 write_seid。 */
    writeSeid: (acc: AgentAccumulator, raw: Record<string, unknown>) => { next: AgentAccumulator; feedback: string }
}

/**
 * 解析并执行一轮工具调用，返回累积后的结果。
 * 纯函数：ask_user 被识别但不由这里弹窗，而是通过返回的 askUser 交给调用方处理。
 */
export function runToolCalls(
    acc: AgentAccumulator,
    toolCalls: ToolCall[],
    executor: ToolExecutor
): { next: AgentAccumulator; askUser: AskUserArgs | null; feedbacks: { callId: string; content: string }[] } {
    let next = acc
    let askUser: AskUserArgs | null = null
    const feedbacks: { callId: string; content: string }[] = []

    for (const call of toolCalls) {
        const raw = parseToolArguments(call.arguments)
        if (!raw) {
            feedbacks.push({ callId: call.id, content: '工具参数不是合法 JSON' })
            continue
        }
        if (call.name === 'ask_user') {
            const args = parseAskUserArgs(raw)
            if (args) askUser = args
            feedbacks.push({ callId: call.id, content: args ? '已向用户提问，等待回答' : 'ask_user 参数非法' })
            continue
        }
        if (call.name === 'create_record') {
            const result = executor.createRecord(next, raw)
            next = result.next
            feedbacks.push({ callId: call.id, content: result.feedback })
            continue
        }
        if (call.name === 'write_seid') {
            const result = executor.writeSeid(next, raw)
            next = result.next
            feedbacks.push({ callId: call.id, content: result.feedback })
            continue
        }
        feedbacks.push({ callId: call.id, content: `未知工具：${call.name}` })
    }

    return { next, askUser, feedbacks }
}

/**
 * 默认工具执行器：把 create_record / write_seid 累积到 accumulator。
 * create_record 解析失败时反馈错误，成功则反馈成功。
 */
export function createDefaultToolExecutor(): ToolExecutor {
    return {
        createRecord: (acc, raw) => {
            const record = parseCreateRecordArgs(raw)
            if (!record) return { next: acc, feedback: 'create_record 参数非法：缺少 group/data' }
            return { next: accumulateRecord(acc, record), feedback: `已暂存记录 ${record.group}:${record.key}` }
        },
        writeSeid: (acc, raw) => {
            const args = parseWriteSeidArgs(raw)
            if (!args) return { next: acc, feedback: 'write_seid 参数非法：缺少 dataKey/seidId/targetKey/params' }
            return { next: accumulateSeid(acc, args), feedback: `已暂存 Seid ${args.dataKey}:${args.seidId} → ${args.targetKey}` }
        },
    }
}

/** 将累积器转为可应用到 mod 的结果；无内容时返回 null。 */
export function accumulatorToResultOrNull(acc: AgentAccumulator): GeneratedResult | null {
    return hasAccumulatedContent(acc) ? accumulatorToResult(acc) : null
}

/** 组装一轮 agent 请求的完整消息（system + 历史 + 最新 user）。 */
export function buildAgentMessages(systemMessages: ChatMessage[], history: ChatMessage[], userMessage: ChatMessage): ChatMessage[] {
    return [...systemMessages, ...history, userMessage]
}
