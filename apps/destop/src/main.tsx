import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { ChatWindow } from './components/ChatWindow'
import { ErrorLogWindow } from './components/ErrorLogWindow'
import { SettingsWindow } from './components/SettingsWindow'
import { applyLanguage, getSavedLanguage } from './language'
import { initializeSettingsStorage } from './settingsStorage'
import { applyTheme, getSavedTheme } from './theme'

async function renderApp(): Promise<void> {
    await initializeSettingsStorage()
    applyTheme(getSavedTheme())
    applyLanguage(getSavedLanguage())

    const params = new URLSearchParams(window.location.search)
    const isSettingsWindow = params.get('window') === 'settings'
    const isErrorLogWindow = params.get('window') === 'error-log'
    const isChatWindow = params.get('window') === 'chat'
    const root = isErrorLogWindow ? <ErrorLogWindow /> : isSettingsWindow ? <SettingsWindow /> : isChatWindow ? <ChatWindow /> : <App />

    ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{root}</React.StrictMode>)
}

void renderApp()
