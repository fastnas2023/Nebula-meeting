import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'antd-mobile/es/global'
import App from './App.jsx'
import './i18n'; // Import i18n config

createRoot(document.getElementById('root')).render(
    <App />
)
