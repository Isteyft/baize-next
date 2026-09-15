import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { SettingsWindow } from './components/SettingsWindow'
import { applyTheme, getSavedTheme } from './theme'

// 启动即应用已保存的主题，避免闪烁。
applyTheme(getSavedTheme())

/** 渲染 React 18 根组件到 #root。 */
const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings'
const root = isSettingsWindow ? <SettingsWindow /> : <App />

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{root}</React.StrictMode>)
