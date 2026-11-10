import { Channel, invoke } from '@tauri-apps/api/core'

import type { AiModelConfig } from './aiModels'
import type { ToolCall } from './aiTools'

/** 单条聊天消息。 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    /** 工具调用（assistant 发起 function call 时携带），字段名与 Rust 后端 camelCase 对齐。 */
    toolCalls?: ToolCall[]
    /** tool 角色消息对应的工具调用 id。 */
    toolCallId?: string
}

/** 流式输出回调。 */
export interface StreamCallbacks {
    onDelta: (text: string) => void
    onDone: (fullText: string) => void
}

/** 一次带工具能力的请求返回结果。 */
export interface ChatCompletionWithToolsResult {
    content: string
    toolCalls: ToolCall[]
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages
        .filter(message => message.role === 'tool' || message.content.trim().length > 0 || (message.toolCalls?.length ?? 0) > 0)
        .map(message => ({ role: message.role, content: message.content }))
}

/**
 * 调用大模型（OpenAI 兼容接口），返回完整回复文本。
 * 实际请求由 Rust 后端转发（`chat_completion` 命令），绕开浏览器 CORS 限制。
 */
export async function chatCompletion(model: AiModelConfig, messages: ChatMessage[]): Promise<string> {
    return invoke<string>('chat_completion', {
        baseUrl: model.baseURL,
        apiKey: model.apiKey,
        model: model.model,
        messages: normalizeMessages(messages),
    })
}

/**
 * 带工具（function calling）能力地调用大模型。
 * 返回文本内容与模型发起的工具调用列表。
 */
export async function chatCompletionWithTools(
    model: AiModelConfig,
    messages: ChatMessage[],
    tools: unknown[]
): Promise<ChatCompletionWithToolsResult> {
    const result = await invoke<{ content: string; toolCalls: ToolCall[] }>('chat_completion', {
        baseUrl: model.baseURL,
        apiKey: model.apiKey,
        model: model.model,
        messages,
        tools,
    })
    return { content: result.content, toolCalls: result.toolCalls ?? [] }
}

/**
 * 发起一次流式对话：后端以 SSE 逐块推送增量文本（含思考过程），
 * 每收到一块就调用 onDelta，让界面边生成边显示。
 * 完成后调用 onDone 并返回完整文本。
 */
export async function chatCompletionStream(model: AiModelConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<string> {
    const onEvent = new Channel<string>()
    let fullText = ''
    onEvent.onmessage = (delta: string) => {
        fullText += delta
        callbacks.onDelta(delta)
    }

    await invoke('chat_completion_stream', {
        baseUrl: model.baseURL,
        apiKey: model.apiKey,
        model: model.model,
        messages: normalizeMessages(messages),
        onEvent,
    })

    callbacks.onDone(fullText)
    return fullText
}
