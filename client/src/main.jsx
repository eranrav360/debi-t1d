import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import KeyGate from './components/KeyGate'
import { installAccessKey } from './lib/accessKey'

installAccessKey()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KeyGate><App /></KeyGate>
  </StrictMode>
)
