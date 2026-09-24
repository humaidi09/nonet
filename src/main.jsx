import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import './index.css'

// Router base tracks Vite's base (BASE_URL): '' when standalone, '/nonet' when
// mounted under the portfolio. One source of truth so links never hardcode it.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
