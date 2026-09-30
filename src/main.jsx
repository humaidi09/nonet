import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import './index.css'
import { applyRemoteData } from './lib/content'
import { readCache, indexBySlug, fetchRemoteData, signature } from './lib/remoteData'

// Router base tracks Vite's base (BASE_URL): '' when standalone, '/nonet' when
// mounted under the portfolio. One source of truth so links never hardcode it.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '')

// The Learning Centre and hint copy are owner-editable from the portfolio admin.
// Apply the last cached payload synchronously so the first paint already reflects
// edits; with no cache the bundled content shows. `applied` tracks what we've
// rendered so the background revalidate only remounts when the data genuinely
// changed — the common case never does.
let applied = null
const cached = readCache()
if (cached) {
  applyRemoteData(indexBySlug(cached))
  applied = signature(cached)
}

const root = createRoot(document.getElementById('root'))

function render() {
  // Keying <App> on the data signature makes a change remount the tree, so any
  // component-local snapshot (a useMemo over LESSONS) re-reads fresh data.
  root.render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <ErrorBoundary>
          <App key={applied ?? 'bundled'} />
        </ErrorBoundary>
      </BrowserRouter>
    </StrictMode>,
  )
}

render()

// Best-effort background revalidate. Never blocks paint; on failure we keep the
// cached/bundled data.
fetchRemoteData().then((datasets) => {
  if (!datasets) return
  const next = signature(datasets)
  if (next === applied) return
  applyRemoteData(indexBySlug(datasets))
  applied = next
  render()
})
