import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { keepShellPortrait } from './components/hero/heroPortrait'

// before React's first render replaces the pre-rendered hero
keepShellPortrait()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
