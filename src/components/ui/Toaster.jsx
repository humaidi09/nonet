// Toaster — renders the transient notifications raised through the toast store.
// Bottom-centre on mobile (clear of the tab bar and number pad), bottom-right on
// desktop. Announced politely to assistive tech; entrance/exit motion is minimal
// and collapses to a fade when the player prefers reduced motion. Mounted once,
// in AppShell.

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Sparkles, Info, X } from 'lucide-react'
import { useToasts } from '@/lib/toast'
import { cx } from './primitives'

const TONE = {
  accent: { icon: Sparkles, cls: 'text-accent', ring: 'border-accent/30' },
  ok: { icon: CheckCircle2, cls: 'text-ok', ring: 'border-ok/30' },
  warn: { icon: AlertTriangle, cls: 'text-warn', ring: 'border-warn/30' },
  bad: { icon: AlertTriangle, cls: 'text-bad', ring: 'border-bad/30' },
  info: { icon: Info, cls: 'text-accent', ring: 'border-line-strong' },
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  const reduce = useReducedMotion()

  const enter = reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
  const from = reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed z-50 inset-x-0 bottom-24 flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const tone = TONE[t.tone] || TONE.accent
          const Icon = t.icon || tone.icon
          return (
            <motion.div
              key={t.id}
              layout
              initial={from}
              animate={enter}
              exit={leave}
              transition={{ duration: reduce ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              onClick={() => dismiss(t.id)}
              className={cx(
                'pointer-events-auto flex items-center gap-3 w-full max-w-sm cursor-pointer rounded-xl border bg-surface/95 bar-blur px-4 py-3 shadow-lg shadow-black/20',
                tone.ring,
              )}
            >
              <span className={cx('grid place-items-center h-8 w-8 shrink-0 rounded-lg bg-surface-2', tone.cls)}>
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight truncate">{t.title}</div>
                {t.message && <div className="text-xs text-muted mt-0.5 leading-snug">{t.message}</div>}
              </div>
              <X size={15} className="shrink-0 text-faint" aria-hidden="true" />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
