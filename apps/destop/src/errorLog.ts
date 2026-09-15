import { invoke } from '@tauri-apps/api/core'

function normalizeError(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return JSON.stringify(error)
}

export async function resetErrorLog(): Promise<void> {
    try {
        await invoke('reset_error_log')
    } catch {
        // Non-Tauri previews ignore error log writes.
    }
}

export async function appendErrorLog(source: string, error: unknown): Promise<void> {
    const message = normalizeError(error)
    if (!message) return
    try {
        const line = `[${new Date().toISOString()}] ${source}: ${message}\n`
        await invoke('append_error_log', { content: line })
    } catch {
        // Non-Tauri previews ignore error log writes.
    }
}

export async function readErrorLog(): Promise<string> {
    try {
        return await invoke<string>('read_error_log')
    } catch {
        return ''
    }
}
