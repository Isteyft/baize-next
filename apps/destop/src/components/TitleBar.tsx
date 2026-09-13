import { MenuDropdown } from './MenuDropdown'
import { WindowControls } from './WindowControls'

/**
 * 自定义任务栏标题栏。
 * 隐藏系统默认标题栏后，由该组件提供拖拽、菜单与窗口控制。
 */
interface TitleBarProps {
    /** 触发“文件 > 打开文件”操作。 */
    onOpenFile: () => void
    /** 触发“文件 > 打开文件夹”操作。 */
    onOpenFolder: () => void
    /** 触发“关于 > 设置”（当前为 TODO）。 */
    onOpenSettings: () => void
}

export function TitleBar({ onOpenFile, onOpenFolder, onOpenSettings }: TitleBarProps) {
    return (
        <header
            data-tauri-drag-region="true"
            className="flex h-10 shrink-0 select-none items-center justify-between bg-gray-900 text-gray-200"
        >
            <nav className="flex h-full items-center">
                <MenuDropdown label="文件">
                    <button
                        type="button"
                        onClick={onOpenFile}
                        className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
                    >
                        打开文件
                    </button>
                    <button
                        type="button"
                        onClick={onOpenFolder}
                        className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
                    >
                        打开文件夹
                    </button>
                </MenuDropdown>
                <MenuDropdown label="关于">
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
                    >
                        设置（TODO）
                    </button>
                </MenuDropdown>
                <span className="ml-2 text-xs text-gray-500">Baize Next Destop</span>
            </nav>
            <WindowControls />
        </header>
    )
}
