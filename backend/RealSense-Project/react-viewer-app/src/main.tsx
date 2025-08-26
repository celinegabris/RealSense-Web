import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RSViewer from './RSViewer.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RSViewer />
  </StrictMode>,
)
