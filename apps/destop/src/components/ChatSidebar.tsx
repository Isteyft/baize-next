import { useEffect, useRef, useState } from 'react'

import { type ChatSession, DEFAULT_SESSION_TITLE } from '../chatSession'

const NEW_TEXT = '新会话'
const SEARCH_PLACEHOLDER = '搜索会话…'
const EMPTY_TEXT = '暂无会话'
const RENAME_TEXT = '重命名'
const DELETE_TEXT = '删除'
const COLLAPSE_TITLE = '收起侧边栏'
const EXPAND_TITLE = '展开侧边栏'
const RENAME_PROMPT = '请输入新的会话名称'

interface ChatSidebarProps {
    sessions: ChatSession[]
    currentId: string | null
    collapsed: boolean
    onSelect: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
    onRename: (id: string, title: string) => void
    onToggle: () => void
}

/** 可折叠的会话侧边栏：会话列表 + 新建 / 切换 / 删除 / 重命名 / 搜索。 */
export function ChatSidebar({ sessions, currentId, collapsed, onSelect, onNew, onDelete, onRename, onToggle }: ChatSidebarProps) {
    const [query, setQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const editRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editingId) editRef.current?.select()
    }, [editingId])

    const filtered = query.trim() ? sessions.filter(session => session.title.toLowerCase().includes(query.trim().toLowerCase())) : sessions

    function startRename(session: ChatSession): void {
        setEditingId(session.id)
        setEditingTitle(session.title)
    }

    function commitRename(): void {
        if (!editingId) return
        const title = editingTitle.trim()
        onRename(editingId, title || DEFAULT_SESSION_TITLE)
        setEditingId(null)
        setEditingTitle('')
    }

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={onToggle}
                title={EXPAND_TITLE}
                className="flex w-8 shrink-0 items-center justify-center border-r border-line bg-panel text-ink-muted transition-colors hover:bg-hover"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 2l5 5-5 5" />
                </svg>
            </button>
        )
    }

    return (
        <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-2">
                <button
                    type="button"
                    onClick={onNew}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                    {NEW_TEXT}
                </button>
                <button
                    type="button"
                    onClick={onToggle}
                    title={COLLAPSE_TITLE}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 2L4 7l5 5" />
                    </svg>
                </button>
            </div>

            <div className="shrink-0 p-2">
                <input
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={SEARCH_PLACEHOLDER}
                    className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {filtered.length === 0 ? (
                    <p className="mt-6 text-center text-xs text-ink-subtle">{EMPTY_TEXT}</p>
                ) : (
                    <ul className="space-y-0.5">
                        {filtered.map(session => {
                            const active = session.id === currentId
                            return (
                                <li key={session.id} className="group">
                                    {editingId === session.id ? (
                                        <input
                                            ref={editRef}
                                            type="text"
                                            value={editingTitle}
                                            onChange={event => setEditingTitle(event.target.value)}
                                            onBlur={commitRename}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter') commitRename()
                                                if (event.key === 'Escape') {
                                                    setEditingId(null)
                                                    setEditingTitle('')
                                                }
                                            }}
                                            className="w-full rounded-md border border-accent bg-raised px-2 py-1.5 text-xs text-ink focus:outline-none"
                                        />
                                    ) : (
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onSelect(session.id)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter') onSelect(session.id)
                                            }}
                                            className={`flex cursor-pointer items-center justify-between gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                                active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-hover'
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1 truncate">{session.title || DEFAULT_SESSION_TITLE}</span>
                                            <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    title={RENAME_TEXT}
                                                    onClick={event => {
                                                        event.stopPropagation()
                                                        startRename(session)
                                                    }}
                                                    className="flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-raised"
                                                >
                                                    <svg
                                                        width="11"
                                                        height="11"
                                                        viewBox="0 0 14 14"
                                                        aria-hidden="true"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.3"
                                                    >
                                                        <path d="M2 10l8.5-8.5a1.4 1.4 0 012 2L4 12l-2.5.5L2 10z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    title={DELETE_TEXT}
                                                    onClick={event => {
                                                        event.stopPropagation()
                                                        onDelete(session.id)
                                                    }}
                                                    className="flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-danger hover:text-white"
                                                >
                                                    <svg
                                                        width="11"
                                                        height="11"
                                                        viewBox="0 0 14 14"
                                                        aria-hidden="true"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.3"
                                                    >
                                                        <path d="M3 3h8M5 3V2h4v1M4 3l.5 9h5l.5-9" />
                                                    </svg>
                                                </button>
                                            </span>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </aside>
    )
}

/** 重命名提示文案（保留导出，供测试或后续扩展使用）。 */
export const SIDEBAR_RENAME_PROMPT = RENAME_PROMPT
