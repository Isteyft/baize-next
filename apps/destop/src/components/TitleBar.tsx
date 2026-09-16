import { MenuDropdown } from './MenuDropdown'
import { WindowControls } from './WindowControls'

const FILE_TEXT = '\u6587\u4ef6'
const OPEN_PROJECT_TEXT = '\u6253\u5f00\u9879\u76ee'
const SAVE_PROJECT_TEXT = '保存全部项目'
const DIRTY_MARK = ' *'
const ABOUT_TEXT = '\u5173\u4e8e'
const SETTINGS_TEXT = '\u8bbe\u7f6e'
const ERROR_LOG_TEXT = '\u9519\u8bef\u65e5\u5fd7'

interface TitleBarProps {
    /** 是否存在可保存的项目。 */
    canSaveProject: boolean
    /** 项目是否有未保存修改。 */
    projectDirty: boolean
    onOpenProject: () => void
    /** 保存全部已打开项目。 */
    onSaveProject: () => void
    onOpenSettings: () => void
    onOpenErrorLog: () => void
}

export function TitleBar({ canSaveProject, projectDirty, onOpenProject, onSaveProject, onOpenSettings, onOpenErrorLog }: TitleBarProps) {
    return (
        <header
            data-tauri-drag-region="true"
            className="flex h-10 shrink-0 select-none items-center justify-between bg-panel text-ink-soft"
        >
            <nav className="flex h-full items-center">
                <MenuDropdown label={FILE_TEXT}>
                    <button
                        type="button"
                        onClick={onOpenProject}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                    >
                        {OPEN_PROJECT_TEXT}
                    </button>
                    <button
                        type="button"
                        disabled={!canSaveProject}
                        onClick={onSaveProject}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent"
                    >
                        {SAVE_PROJECT_TEXT}
                        {projectDirty ? DIRTY_MARK : ''}
                    </button>
                </MenuDropdown>
                <MenuDropdown label={ABOUT_TEXT}>
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                    >
                        {SETTINGS_TEXT}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenErrorLog}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                    >
                        {ERROR_LOG_TEXT}
                    </button>
                </MenuDropdown>
                <span className="ml-2 text-xs text-ink-subtle">Baize Next Destop</span>
            </nav>
            <WindowControls />
        </header>
    )
}
