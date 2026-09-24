// UI kit — the shared visual vocabulary. Quiet, precise, and consistent so the
// signature elements (the board, the Coach, the replay) can carry the boldness.
// All colours come from the semantic theme tokens, so everything flips cleanly
// between light and dark.

import { forwardRef } from 'react'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

/* ------------------------------------------------------------------ Button -- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors ' +
  'select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-accent whitespace-nowrap'

const BTN_VARIANTS = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-strong',
  secondary: 'bg-surface text-text border border-line hover:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  soft: 'bg-accent-soft text-accent hover:brightness-95',
  danger: 'bg-bad text-white hover:brightness-110',
}

const BTN_SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
}

export const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'secondary', size = 'md', className, full, ...props },
  ref,
) {
  return (
    <As
      ref={ref}
      className={cx(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], full && 'w-full', className)}
      {...props}
    />
  )
})

/* ------------------------------------------------------------------- Card --- */

export function Card({ className, as: As = 'div', ...props }) {
  return (
    <As
      className={cx('bg-surface border border-line rounded-card', className)}
      {...props}
    />
  )
}

/** Card with standard padding — the default container for content blocks. */
export function Panel({ className, ...props }) {
  return <Card className={cx('p-5 sm:p-6', className)} {...props} />
}

export function SectionHeader({ title, hint, action, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-4 mb-3', className)}>
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------- Stat --- */

/** A single labelled metric. `tone` tints the value for status figures. */
export function Stat({ label, value, sub, tone = 'default', icon: Icon, className }) {
  const toneClass = {
    default: 'text-text',
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
  }[tone]
  return (
    <div className={cx('min-w-0', className)}>
      <div className="flex items-center gap-1.5 text-muted text-xs font-medium uppercase tracking-wide">
        {Icon && <Icon size={13} strokeWidth={2.2} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={cx('mt-1 font-display text-2xl sm:text-[1.75rem] leading-none tnum', toneClass)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ Badge --- */

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
}

export function Badge({ tone = 'neutral', className, icon: Icon, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- Callout --- */

const CALLOUT_TONES = {
  info: 'bg-accent-soft/60 border-accent/30 text-text',
  ok: 'bg-ok-soft border-ok/30 text-text',
  warn: 'bg-warn-soft border-warn/30 text-text',
  bad: 'bg-bad-soft border-bad/40 text-text',
}

/** An inline message block. Icon + text, never colour alone (a11y). */
export function Callout({ tone = 'info', icon: Icon, title, children, className }) {
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3.5', CALLOUT_TONES[tone], className)}>
      {Icon && <Icon size={18} strokeWidth={2.2} className="shrink-0 mt-0.5" />}
      <div className="min-w-0 text-sm leading-relaxed">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- EmptyState -- */

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div className={cx('flex flex-col items-center text-center py-12 px-6', className)}>
      {Icon && (
        <div className="mb-4 grid place-items-center h-14 w-14 rounded-2xl bg-surface-2 text-faint">
          <Icon size={26} strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1.5 text-sm text-muted max-w-sm">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------- form inputs -- */

export function Toggle({ checked, onChange, label, description, id }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative shrink-0 h-6 w-11 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  )
}

/** Segmented control — the app's primary way to pick among a few options. */
export function Segmented({ options, value, onChange, size = 'md', className, 'aria-label': ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('inline-flex bg-surface-2 rounded-xl p-1 gap-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              'rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Select({ value, onChange, options, id, className, 'aria-label': ariaLabel }) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-10 rounded-xl border border-line bg-surface px-3 pr-8 text-sm text-text',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Field({ label, htmlFor, hint, children, className }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function TextInput({ className, ...props }) {
  return (
    <input
      className={cx(
        'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-text placeholder:text-faint',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      {...props}
    />
  )
}

/* ----------------------------------------------------------------- misc ---- */

export function ProgressBar({ value, tone = 'accent', className, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const bar = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone]
  return (
    <div
      className={cx('h-2 rounded-full bg-surface-2 overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Divider({ className }) {
  return <hr className={cx('border-0 border-t border-line', className)} />
}

export function Spinner({ size = 20, className }) {
  return (
    <svg
      className={cx('animate-spin text-accent', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Neutral loading placeholder. */
export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-surface-2', className)} />
}
