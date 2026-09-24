// ThemeProvider: runs first-run seeding once, keeps the DOM theme in sync with
// the stored preference (including live OS changes when set to 'system'), and
// applies the large-text accessibility scale. Renders nothing of its own.

import { useEffect } from 'react'
import { useStore, applyTheme } from '@/store/useStore'

export function ThemeProvider({ children }) {
  const theme = useStore((s) => s.settings.theme)
  const largeText = useStore((s) => s.settings.largeText)
  const initFirstRun = useStore((s) => s.initFirstRun)

  // Seed on first launch and apply the persisted theme immediately.
  useEffect(() => {
    initFirstRun()
  }, [initFirstRun])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the OS when the preference is 'system'.
  useEffect(() => {
    if (theme !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('nonet-large', largeText)
  }, [largeText])

  return children
}
