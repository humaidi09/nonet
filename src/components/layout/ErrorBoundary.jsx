// A single place to catch render-time errors so a broken screen never becomes a
// blank page. React error boundaries must be class components. The fallback is
// context-independent (plain links + reload), so the same component works both as
// the app's last resort in main.jsx and around an individual route inside the
// shell — where the sidebar and nav keep working, so a page crash is recoverable.

import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui'

// Root under the current mount ('/nonet/' in the portfolio, '/' standalone).
const HOME_HREF = import.meta.env.BASE_URL || '/'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface it for debugging; the interface stays calm.
    console.error('Nonet caught a render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-warn-soft text-warn">
          <AlertTriangle size={30} aria-hidden="true" />
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold">This screen ran into a problem</h1>
        <p className="text-muted mt-2">
          Something on this page stopped working. Your game is saved — reload to pick up where you
          left off, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} /> Reload
          </Button>
          <Button variant="secondary" as="a" href={HOME_HREF}>
            <Home size={16} /> Back to home
          </Button>
        </div>
        {this.state.error?.message && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-faint cursor-pointer select-none">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg border border-line bg-surface-2/50 p-3 text-xs text-muted whitespace-pre-wrap">
              {String(this.state.error.message)}
            </pre>
          </details>
        )}
      </div>
    )
  }
}
