import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

/** 渲染 React 18 根组件到 #root。 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
