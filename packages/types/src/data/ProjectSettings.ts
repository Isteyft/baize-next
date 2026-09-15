/**
 * 本项目设置专用类型。
 */

import { AppLanguage } from '../enums/AppLanguage'
import { ThemeColor } from '../enums/ThemeColor'
import { PreloadSourceMode } from '../enums/PreloadSourceMode'

export interface ProjectSettings {
    /** 主题色（亮色 / 暗色 / 青黑色） */
    theme: ThemeColor
    /** 界面语言 */
    /** Preload source mode. */
    preloadMode: PreloadSourceMode
    /** Preload JSON path, file or directory. */
    preloadPath: string
    language: AppLanguage
}
