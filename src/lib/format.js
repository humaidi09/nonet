// Formatting helpers. Pure, dependency-free, and shared across every page so
// time, dates, and numbers read identically everywhere.

const pad2 = (n) => String(n).padStart(2, '0')

/** Milliseconds -> clock. Under an hour: M:SS. An hour or more: H:MM:SS. */
export function formatTime(ms) {
  if (ms == null) return '—'
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

/** Compact duration for prose, e.g. "6m 12s" or "48s". */
export function formatDuration(ms) {
  if (ms == null) return '—'
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}s`
  return `${m}m ${pad2(s)}s`
}

export function formatPercent(x, digits = 0) {
  if (x == null || Number.isNaN(x)) return '—'
  return `${(x * 100).toFixed(digits)}%`
}

export function formatNumber(n) {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Short absolute date, e.g. "Sep 14" (adds year when not the current year). */
export function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`
}

/** Human day label relative to today: Today / Yesterday / N days ago / date. */
export function formatRelativeDay(iso) {
  const then = toDayKey(new Date(iso))
  const today = todayKey()
  if (then === today) return 'Today'
  const diff = Math.round((fromDayKey(today) - fromDayKey(then)) / 86400000)
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `${diff} days ago`
  return formatDate(iso)
}

export function formatTimeOfDay(iso) {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${pad2(m)} ${ap}`
}

/* --- day keys (local calendar days, used for streaks and daily challenge) --- */

/** Local calendar day as 'YYYY-MM-DD' (not UTC — streaks follow the player's day). */
export function toDayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Parse a 'YYYY-MM-DD' key back to a local-midnight timestamp (ms). */
export function fromDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function todayKey() {
  return toDayKey(new Date())
}

/** A friendly long form of a day key, e.g. "Sunday, Sep 14". */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function formatDayKeyLong(key) {
  const d = new Date(fromDayKey(key))
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}
