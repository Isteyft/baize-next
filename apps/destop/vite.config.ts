import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Vite 配置：为 Tauri 提供 React 构建与 dev server。 */
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: '127.0.0.1',
    },
    build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
    },
})
