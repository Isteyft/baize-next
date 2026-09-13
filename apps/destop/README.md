# @baize-next/destop

Baize Next 桌面端：基于 Tauri 2 + React 18 + TypeScript + Tailwind CSS 的 JSON 数据查看与编辑应用。

## 功能

-   左栏：选择 JSON 数据集（支持打开单个/多个 JSON 文件，或打开包含多个 JSON 文件的目录）
-   中栏：以表格展示当前数据集中的记录
-   右栏：编辑选中的 JSON 记录，合法输入实时回写表格
-   自定义任务栏：隐藏系统标题栏，支持拖拽、关闭/最小化/最大化，以及“文件 / 关于”菜单

## 开发

```bash
pnpm install            # 在仓库根目录安装依赖
pnpm --filter @baize-next/destop tauri dev
```

> 首次运行 Tauri 需要安装 Rust 工具链。
