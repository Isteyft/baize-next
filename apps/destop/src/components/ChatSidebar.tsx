import { useEffect, useRef, useState } from 'react'

import { type ChatSession, DEFAULT_SESSION_TITLE } from '../chatSession'

const NEW_TEXT = '新会话'
const SEARCH_PLACEHOLDER = '搜索会话…'
const EMPTY_TEXT = '暂无会话'
const RENAME_TEXT = '重命名'
const DELETE_TEXT = '删除'
const RENAME_PROMPT = '请输入新的会话名称'

interface ChatSidebarProps {
    sessions: ChatSession[]
    currentId: string | null
    onSelect: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
    onRename: (id: string, title: string) => void
}

/**
 * 会话侧边栏：位于聊天面板顶部，包含「会话列表」下拉与「新会话」按钮。
 * 会话列表点击后以弹出层展示，支持切换 / 删除 / 重命名 / 搜索。
 */
export function ChatSidebar({ sessions, currentId, onSelect, onNew, onDelete, onRename }: ChatSidebarProps) {
    const [query, setQuery] = useState('')
    const [listOpen, setListOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const editRef = useRef<HTMLInputElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (editingId) editRef.current?.select()
    }, [editingId])

    // 点击侧边栏外部时关闭会话列表弹出层。
    useEffect(() => {
        if (!listOpen) return
        const handlePointerDown = (event: MouseEvent): void => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setListOpen(false)
            }
        }
        document.addEventListener('mousedown', handlePointerDown)
        return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [listOpen])

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

    function handleSelect(id: string): void {
        onSelect(id)
        setListOpen(false)
        setQuery('')
    }

    return (
        <div ref={rootRef} className="relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-panel px-2 py-1.5">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setListOpen(value => !value)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-hover"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <path d="M2 3h10M2 7h10M2 11h10" />
                    </svg>
                    会话列表
                </button>

                {listOpen ? (
                    <div className="absolute left-0 top-full z-30 mt-1 flex max-h-72 w-60 flex-col overflow-hidden rounded-lg border border-line-strong bg-panel shadow-xl">
                        <div className="shrink-0 border-b border-line p-2">
                            <input
                                type="text"
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder={SEARCH_PLACEHOLDER}
                                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                            />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-1">
                            {filtered.length === 0 ? (
                                <p className="mt-4 text-center text-xs text-ink-subtle">{EMPTY_TEXT}</p>
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
                                                        onClick={() => handleSelect(session.id)}
                                                        onKeyDown={event => {
                                                            if (event.key === 'Enter') handleSelect(session.id)
                                                        }}
                                                        className={`flex cursor-pointer items-center justify-between gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                                            active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-hover'
                                                        }`}
                                                    >
                                                        <span className="min-w-0 flex-1 truncate">
                                                            {session.title || DEFAULT_SESSION_TITLE}
                                                        </span>
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
                    </div>
                ) : null}
            </div>

            <button
                type="button"
                onClick={onNew}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
                {NEW_TEXT}
            </button>
        </div>
    )
}

/** 重命名提示文案（保留导出，供测试或后续扩展使用）。 */
export const SIDEBAR_RENAME_PROMPT = RENAME_PROMPT
