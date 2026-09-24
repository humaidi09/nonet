// Small React hooks used across the app. Kept free of store imports so they can
// be used anywhere without creating cycles.

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Fire `callback` every `delay` ms. Pass delay = null to pause. The callback is
 * kept in a ref so the interval isn't torn down when it changes each render —
 * important for the game timer, whose callback closes over changing state.
 */
export function useInterval(callback, delay) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    if (delay == null) return undefined
    const id = setInterval(() => saved.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

/** Reactive matchMedia. Returns whether `query` currently matches. */
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia(query).matches) || false
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = () => setMatches(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

/** True when the OS requests reduced motion. Components AND this with settings. */
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** Named breakpoints matching the design's responsive tiers. */
export function useBreakpoint() {
  const isTablet = useMediaQuery('(min-width: 40rem)') // 640px
  const isLaptop = useMediaQuery('(min-width: 64rem)') // 1024px
  const isDesktop = useMediaQuery('(min-width: 80rem)') // 1280px
  if (isDesktop) return 'desktop'
  if (isLaptop) return 'laptop'
  if (isTablet) return 'tablet'
  return 'mobile'
}

/** Run `handler` on keydown at the document level (for board keyboard control). */
export function useKeydown(handler, active = true) {
  const saved = useRef(handler)
  useEffect(() => {
    saved.current = handler
  }, [handler])
  useEffect(() => {
    if (!active) return undefined
    const fn = (e) => saved.current(e)
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [active])
}

/** A ticking clock: returns Date.now() refreshed every `interval` ms while active. */
export function useNow(interval = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), active ? interval : null)
  return now
}

/** Toggle helper with stable callbacks. */
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  const toggle = useCallback(() => setOn((v) => !v), [])
  return [on, toggle, setOn]
}
