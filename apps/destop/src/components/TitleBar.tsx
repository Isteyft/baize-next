import { MenuDropdown } from './MenuDropdown'
import { WindowControls } from './WindowControls'

/**
 * 自定义任务栏标题栏。
 * 隐藏系统默认标题栏后，由该组件提供拖拽、菜单与窗口控制。
 */
interface TitleBarProps {
    /** 触发“文件 > 打开项目”操作。 */
    onOpenProject: () => void
    /** 触发“关于 > 设置”菜单，打开独立设置窗口。 */
    onOpenSettings: () => void
}

export function TitleBar({ onOpenProject, onOpenSettings }: TitleBarProps) {
    return (
        <header
            data-tauri-drag-region="true"
            className="flex h-10 shrink-0 select-none items-center justify-between bg-panel text-ink-soft"
        >
            <nav className="flex h-full items-center">
                <MenuDropdown label="文件">
                    <button
                        type="button"
                        onClick={onOpenProject}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                    >
                        打开项目
                    </button>
                </MenuDropdown>
                <MenuDropdown label="关于">
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="block w-full px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-hover"
                    >
                        设置
                    </button>
                </MenuDropdown>
                <span className="ml-2 text-xs text-ink-subtle">Baize Next Destop</span>
            </nav>
            <WindowControls />
        </header>
    )
}
