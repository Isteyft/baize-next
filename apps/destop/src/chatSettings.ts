import { invoke } from '@tauri-apps/api/core'

import { getSettingsStorageItem, setSettingsStorageItem } from './settingsStorage'

/** 会话保存位置设置。 */
export interface ChatSettings {
    /** 会话目录，为空表示使用默认目录。 */
    dir: string
}

const STORAGE_KEY = 'baize-next.chat-settings'

/** 从后端获取默认会话目录（可执行文件所在目录下的 .bz-chat）。 */
export async function getDefaultChatDir(): Promise<string> {
    try {
        return await invoke<string>('get_default_chat_dir')
    } catch {
        return '.bz-chat'
    }
}

function normalizeChatSettings(value: unknown): ChatSettings | null {
    if (!value || typeof value !== 'object') return null
    const data = value as Partial<ChatSettings>
    if (typeof data.dir === 'string') {
        return { dir: data.dir }
    }
    return null
}

/** 读取已保存的会话设置，未保存时返回空目录（由调用方决定默认值）。 */
export function getSavedChatSettings(): ChatSettings {
    try {
        const raw = getSettingsStorageItem(STORAGE_KEY)
        if (raw) {
            const parsed = normalizeChatSettings(JSON.parse(raw) as unknown)
            if (parsed) return parsed
        }
    } catch {
        // Ignore storage failures.
    }
    return { dir: '' }
}

/** 持久化会话设置。 */
export function saveChatSettings(settings: ChatSettings): void {
    try {
        setSettingsStorageItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // Ignore storage failures.
    }
}

/** 解析实际生效的会话目录：优先用户配置，为空时回退到默认目录。 */
export async function resolveChatDir(): Promise<string> {
    const saved = getSavedChatSettings()
    if (saved.dir) return saved.dir
    return getDefaultChatDir()
}
