import { useEffect, useState } from 'react'

/** 图标预览尺寸（px），与编号字段并排展示。 */
export const ASSET_ICON_SIZE = 32

interface AssetIconProps {
    /** mod 内图标的相对路径，为空时不请求资源。 */
    path: string | null
    /** 读取 mod 资源并返回可展示的 data URL。 */
    resolve: ((relativePath: string) => Promise<string | null>) | undefined
    /** 图标按钮的提示文案，便于在表格中区分不同记录。 */
    title?: string
    /** 图标预览的类名，默认使用编辑器尺寸。 */
    className?: string
}

/**
 * 资源图标预览：按 mod 的 Assets 路径读取图片并直接展示图片，加载失败时展示占位提示。
 * 路径由 resolveModIconPath 统一生成，缺失 mod 目录或资源读取能力时不渲染任何内容。
 */
export function AssetIcon({ path, resolve, title, className = 'h-8 w-8' }: AssetIconProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false
        setUrl(null)
        setFailed(false)
        if (!path || !resolve) return
        void resolve(path).then(
            next => {
                if (cancelled) return
                if (next) setUrl(next)
                else setFailed(true)
            },
            () => {
                if (!cancelled) setFailed(true)
            }
        )
        return () => {
            cancelled = true
        }
    }, [path, resolve])

    if (!path) return null

    if (url) {
        return (
            <img
                src={url}
                alt={title ?? path}
                title={title ?? path}
                width={ASSET_ICON_SIZE}
                height={ASSET_ICON_SIZE}
                className={`${className} rounded-sm object-contain`}
            />
        )
    }

    return (
        <span
            title={title ?? path}
            className={`${className} flex items-center justify-center rounded-sm border border-dashed border-line-strong text-xs text-ink-subtle`}
        >
            {failed ? '×' : '…'}
        </span>
    )
}
