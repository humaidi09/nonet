// A small transient-notification store, deliberately separate from the persisted
// game store — toasts are ephemeral UI and are never saved. Components read
// `useToasts()`; anywhere (even outside React) can raise one with `toast(...)`.

import { create } from 'zustand'

let nextId = 1

export const useToasts = create((set, get) => ({
  toasts: [],
  push(t) {
    const id = nextId++
    const item = { id, tone: 'accent', ttl: 2200, ...t }
    // Keep at most three on screen so the corner never fills up.
    set((s) => ({ toasts: [...s.toasts, item].slice(-3) }))
    if (item.ttl > 0) setTimeout(() => get().dismiss(id), item.ttl)
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  clear() {
    set({ toasts: [] })
  },
}))

/** Raise a toast from anywhere. Pass a string for a bare title, or an object. */
export function toast(t) {
  return useToasts.getState().push(typeof t === 'string' ? { title: t } : t)
}
