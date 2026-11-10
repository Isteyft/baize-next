import { invoke } from '@tauri-apps/api/core'

import type { AiModelConfig } from './aiModels'

/** 单条聊天消息。 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

/** 流式输出回调。 */
export interface StreamCallbacks {
    onDelta: (text: string) => void
    onDone: (fullText: string) => void
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.filter(message => message.content.trim().length > 0).map(message => ({ role: message.role, content: message.content }))
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
 * 发起一次对话并返回完整回复。
 * 当前后端为一次性返回完整文本，为保持调用方接口稳定，仍以回调形式交付。
 */
export async function chatCompletionStream(model: AiModelConfig, messages: ChatMessage[], callbacks: StreamCallbacks): Promise<string> {
    const text = await chatCompletion(model, messages)
    if (text) callbacks.onDelta(text)
    callbacks.onDone(text)
    return text
}
