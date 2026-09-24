// Hand-rolled SVG charts. No charting dependency — these are small, calm, and
// tuned to the theme tokens so they flip with light/dark. Every chart is fluid:
// it measures its container and renders at real pixels, so axis text stays crisp.

import { useState, useLayoutEffect, useRef, useId } from 'react'
import { cx } from './primitives'

/** Difficulty -> theme colour, shared by charts and legends. */
export const DIFFICULTY_COLOR = {
  easy: 'var(--ok)',
  medium: 'var(--accent)',
  hard: 'var(--warn)',
  expert: 'var(--bad)',
}

/** Measure a container's width so charts can be fluid without distorting text. */
function useMeasure() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(ref.current)
    setWidth(ref.current.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

const niceMax = (v) => {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

/* -------------------------------------------------------------- LineChart -- */

/**
 * A single-series line with a soft gradient area. `data` is an array of numbers
 * (or {y}). Renders horizontal guide lines with labels via `formatY`.
 */
export function LineChart({ data, height = 180, formatY = (v) => v, className, tone = 'var(--accent)' }) {
  const [ref, width] = useMeasure()
  const gradId = useId()
  const values = data.map((d) => (typeof d === 'number' ? d : d.y))

  const pad = { t: 12, r: 12, b: 20, l: 36 }
  const w = Math.max(width, 0)
  const innerW = Math.max(w - pad.l - pad.r, 0)
  const innerH = height - pad.t - pad.b

  let content = null
  if (w > 0 && values.length > 0) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const lo = Math.floor(min - (max - min) * 0.15 || min - 1)
    const hi = Math.ceil(max + (max - min) * 0.15 || max + 1)
    const span = hi - lo || 1
    const x = (i) => pad.l + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW)
    const y = (v) => pad.t + innerH - ((v - lo) / span) * innerH

    const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const area = `${line} L${x(values.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`
    const ticks = [hi, lo + span / 2, lo]

    content = (
      <>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.18" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" className="fill-faint" fontSize="10">
              {formatY(Math.round(t))}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill={tone} />
      </>
    )
  }

  return (
    <div ref={ref} className={cx('w-full', className)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Trend chart">
          {content}
        </svg>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- BarChart -- */

/** Vertical bars. `data`: [{ label, value, color? }]. */
export function BarChart({ data, height = 180, formatValue = (v) => v, className }) {
  const [ref, width] = useMeasure()
  const pad = { t: 16, r: 8, b: 24, l: 8 }
  const w = Math.max(width, 0)
  const innerW = Math.max(w - pad.l - pad.r, 0)
  const innerH = height - pad.t - pad.b
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const slot = data.length ? innerW / data.length : 0
  const barW = Math.min(slot * 0.6, 56)

  return (
    <div ref={ref} className={cx('w-full', className)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Bar chart">
          {data.map((d, i) => {
            const h = (d.value / max) * innerH
            const cx0 = pad.l + slot * i + slot / 2
            const yTop = pad.t + innerH - h
            return (
              <g key={d.label}>
                <rect
                  x={cx0 - barW / 2}
                  y={yTop}
                  width={barW}
                  height={Math.max(h, d.value > 0 ? 2 : 0)}
                  rx="5"
                  fill={d.color || 'var(--accent)'}
                />
                {d.value > 0 && (
                  <text x={cx0} y={yTop - 6} textAnchor="middle" className="fill-muted" fontSize="11" fontWeight="600">
                    {formatValue(d.value)}
                  </text>
                )}
                <text x={cx0} y={height - 7} textAnchor="middle" className="fill-faint" fontSize="11">
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Donut -- */

/** Ring chart. `segments`: [{ value, color, label }]. Children render centred. */
export function Donut({ segments, size = 132, thickness = 14, children, className }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className={cx('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Distribution">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total
            const dash = frac * circ
            const el = (
              <circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += dash
            return el
          })}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  )
}

/* -------------------------------------------------------------- Sparkline -- */

export function Sparkline({ data, width = 96, height = 28, tone = 'var(--accent)', className }) {
  const values = data.map((d) => (typeof d === 'number' ? d : d.y))
  if (values.length < 2) return <div style={{ width, height }} className={className} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i) => (i / (values.length - 1)) * (width - 2) + 1
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <path d={line} fill="none" stroke={tone} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------- ActivityCalendar -- */

/**
 * A GitHub-style activity grid for the last `weeks` weeks. `counts` maps a day
 * key (YYYY-MM-DD) to a play count. Colour intensity encodes activity; today is
 * ringed. Purely visual — labels carry the meaning for screen readers via title.
 */
export function ActivityCalendar({ counts, weeks = 18, toDayKey, todayKey, className }) {
  const cell = 13
  const gap = 3
  const today = new Date()
  const dow = today.getDay()
  const days = []
  const start = new Date(today)
  start.setDate(start.getDate() - (weeks * 7 - 1 + (6 - dow)))
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  const max = Math.max(1, ...Object.values(counts))
  const tKey = todayKey()

  const shade = (n) => {
    if (!n) return 'var(--surface-2)'
    const t = 0.3 + (n / max) * 0.7
    return `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, transparent)`
  }

  const width = weeks * (cell + gap)
  const height = 7 * (cell + gap)

  return (
    <svg width={width} height={height} className={className} role="img" aria-label="Recent activity">
      {days.map((d, i) => {
        const wk = Math.floor(i / 7)
        const day = i % 7
        const key = toDayKey(d)
        const n = counts[key] || 0
        return (
          <rect
            key={key}
            x={wk * (cell + gap)}
            y={day * (cell + gap)}
            width={cell}
            height={cell}
            rx="3"
            fill={shade(n)}
            stroke={key === tKey ? 'var(--accent)' : 'transparent'}
            strokeWidth="1.5"
          >
            <title>{`${key}: ${n} ${n === 1 ? 'puzzle' : 'puzzles'}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}
