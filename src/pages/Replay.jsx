// Puzzle Replay — the product's signature surface. It reconstructs a real solve
// from the stored move log (never by regenerating) and lets you scrub through it,
// with every step annotated: correct placements, mistakes, corrections, hints,
// and the long pauses that mark a turning point. The board itself is inert here;
// the timeline is the instrument.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Film, Play as PlayIcon, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, CornerUpLeft, Lightbulb, Pencil, Eraser, Flag, Zap,
  Clock, Target, Gauge, Trophy, ArrowRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { parseGrid, EMPTY, difficultyMeta } from '@/engine/sudoku'
import { Board } from '@/components/board/Board'
import { Button, Panel, Card, Stat, Badge, Callout, EmptyState, Segmented, cx } from '@/components/ui'
import { formatTime, formatDuration, formatPercent, formatDate } from '@/lib/format'
import { useInterval, useKeydown, usePrefersReducedMotion } from '@/lib/hooks'

/* --------------------------------------------------------- reconstruction -- */
// Fold the compact move log forward into a snapshot per step. The log stores
// { t, y (type), i (index), v (value), c (correct) } with y in p/e/n/h/u/r.
// Undo/redo entries carry no restore value in the compact log, so they're left
// out of the reconstructed timeline; a completed solve always ends at the unique
// solution, which we guarantee as the final frame.

const ROW = (i) => Math.floor(i / 9) + 1
const COL = (i) => (i % 9) + 1
const cellName = (i) => `R${ROW(i)}C${COL(i)}`
const noteBit = (d) => 1 << (d - 1)

const KIND_META = {
  start: { label: 'Starting position', tone: 'neutral', icon: Film },
  correct: { label: 'Correct placement', tone: 'ok', icon: CheckCircle2 },
  correction: { label: 'Correction', tone: 'accent', icon: CornerUpLeft },
  mistake: { label: 'Mistake', tone: 'bad', icon: XCircle },
  note: { label: 'Pencil mark', tone: 'neutral', icon: Pencil },
  erase: { label: 'Erased', tone: 'neutral', icon: Eraser },
  hint: { label: 'Hint used', tone: 'warn', icon: Lightbulb },
  solved: { label: 'Solved', tone: 'ok', icon: Trophy },
}

const gridEqual = (a, b) => {
  for (let i = 0; i < 81; i++) if (a[i] !== b[i]) return false
  return true
}

function reconstruct(result) {
  const puzzle = parseGrid(result.puzzle)
  const solution = parseGrid(result.solution)
  if (!puzzle || !solution) return null
  const givens = puzzle.map((v) => v !== EMPTY)

  const cells = puzzle.slice()
  const notes = new Array(81).fill(0)
  const wrongOnce = new Set() // cells that have held a wrong value (for corrections)
  let mistakes = 0
  let hints = 0
  let prevT = 0

  const steps = [
    { kind: 'start', index: null, value: 0, t: 0, pauseMs: 0, mistakes: 0, hints: 0, cells: cells.slice(), notes: notes.slice() },
  ]

  const kept = (result.moves || []).filter((m) => m.y === 'p' || m.y === 'e' || m.y === 'n' || m.y === 'h')
  for (const m of kept) {
    let kind = 'note'
    const gap = Math.max(0, m.t - prevT)

    if (m.y === 'p') {
      cells[m.i] = m.v
      notes[m.i] = 0
      if (m.c) {
        kind = wrongOnce.has(m.i) ? 'correction' : 'correct'
        wrongOnce.delete(m.i)
      } else {
        kind = 'mistake'
        mistakes += 1
        wrongOnce.add(m.i)
      }
    } else if (m.y === 'e') {
      cells[m.i] = EMPTY
      notes[m.i] = 0
      kind = 'erase'
    } else if (m.y === 'n') {
      if (cells[m.i] === EMPTY && m.v) notes[m.i] ^= noteBit(m.v)
      kind = 'note'
    } else if (m.y === 'h') {
      hints += 1
      kind = 'hint'
    }

    steps.push({ kind, index: m.i, value: m.v || 0, t: m.t, pauseMs: gap, mistakes, hints, cells: cells.slice(), notes: notes.slice() })
    prevT = m.t
  }

  // Guarantee the final frame is the solved board (completed solves always are).
  const lastCells = steps[steps.length - 1].cells
  if (!gridEqual(lastCells, solution)) {
    steps.push({ kind: 'solved', index: null, value: 0, t: result.timeMs, pauseMs: 0, mistakes, hints, cells: solution.slice(), notes: new Array(81).fill(0) })
  } else {
    steps[steps.length - 1] = { ...steps[steps.length - 1], kind: 'solved' }
  }

  // Turning points: a long think (>= 20s) followed by a run of correct placements
  // reads as a breakthrough; a long think on its own is just a scan.
  const PAUSE = 20000
  steps.forEach((s, i) => {
    if (s.pauseMs >= PAUSE) {
      let run = 0
      for (let j = i; j < steps.length && j < i + 4; j++) {
        if (steps[j].kind === 'correct' || steps[j].kind === 'correction') run += 1
        else break
      }
      s.turning = run >= 3 ? 'breakthrough' : 'pause'
    }
  })

  return { puzzle, solution, givens, steps }
}

/* --------------------------------------------------------------- timeline -- */
// A film-strip of the solve. One tick per step, coloured by what happened and
// grown taller for longer pauses, so the rhythm of the solve is visible at a
// glance. Clicking a tick jumps there.

const TICK_TONE = {
  start: 'bg-line-strong',
  correct: 'bg-ok',
  correction: 'bg-accent',
  mistake: 'bg-bad',
  note: 'bg-line-strong',
  erase: 'bg-line-strong',
  hint: 'bg-warn',
  solved: 'bg-ok',
}

function tickHeight(pauseMs) {
  if (pauseMs >= 20000) return 'h-6'
  if (pauseMs >= 8000) return 'h-5'
  if (pauseMs >= 3000) return 'h-4'
  return 'h-3'
}

function Timeline({ steps, idx, onJump }) {
  return (
    <div className="flex items-end gap-px overflow-x-auto no-scrollbar py-1" role="group" aria-label="Solve timeline">
      {steps.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`Step ${i} — ${KIND_META[s.kind].label}`}
          aria-current={i === idx}
          title={`${formatTime(s.t)} · ${KIND_META[s.kind].label}`}
          className={cx(
            'shrink-0 grow basis-0 min-w-[3px] max-w-[9px] rounded-full transition-opacity',
            tickHeight(s.pauseMs),
            TICK_TONE[s.kind],
            i === idx ? 'opacity-100 ring-2 ring-accent ring-offset-1 ring-offset-surface' : i < idx ? 'opacity-90' : 'opacity-25 hover:opacity-60',
          )}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ page --- */

export default function Replay() {
  const { id } = useParams()
  const history = useStore((s) => s.history)
  const reduceMotion = usePrefersReducedMotion()

  const result = useMemo(() => {
    const decoded = decodeURIComponent(id || '')
    // Prefer the most recent record if a puzzle was solved more than once.
    return [...history].reverse().find((h) => h.id === decoded) || null
  }, [history, id])

  const recon = useMemo(() => (result ? reconstruct(result) : null), [result])

  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('1')

  const last = recon ? recon.steps.length - 1 : 0
  const atEnd = idx >= last

  // Reset when the puzzle changes.
  useEffect(() => {
    setIdx(0)
    setPlaying(false)
  }, [result])

  const step = (delta) => {
    setPlaying(false)
    setIdx((i) => Math.max(0, Math.min(last, i + delta)))
  }
  const jump = useCallback((i) => {
    setPlaying(false)
    setIdx(i)
  }, [])
  const togglePlay = () => {
    if (atEnd) setIdx(0)
    setPlaying((p) => !p)
  }

  const intervalMs = reduceMotion ? 900 : { '0.5': 1300, '1': 750, '2': 360 }[speed]
  useInterval(() => {
    setIdx((i) => {
      if (i >= last) {
        setPlaying(false)
        return i
      }
      return i + 1
    })
  }, playing ? intervalMs : null)

  useKeydown((e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    else if (e.key === ' ') { e.preventDefault(); togglePlay() }
    else if (e.key === 'Home') { e.preventDefault(); jump(0) }
    else if (e.key === 'End') { e.preventDefault(); jump(last) }
  }, !!recon)

  // Derived from the current snapshot. Computed before any early return so the
  // hook order stays stable; both guard against a missing reconstruction.
  const wrongSet = useMemo(() => {
    const bad = new Set()
    if (!recon) return bad
    const cur = recon.steps[Math.min(idx, recon.steps.length - 1)]
    for (let i = 0; i < 81; i++) {
      if (recon.givens[i]) continue
      if (cur.cells[i] !== EMPTY && cur.cells[i] !== recon.solution[i]) bad.add(i)
    }
    return bad
  }, [recon, idx])

  const counts = useMemo(() => {
    const acc = { correct: 0, mistakes: 0, corrections: 0 }
    if (!recon) return acc
    recon.steps.forEach((s) => {
      if (s.kind === 'correct') acc.correct += 1
      else if (s.kind === 'mistake') acc.mistakes += 1
      else if (s.kind === 'correction') acc.corrections += 1
    })
    return acc
  }, [recon])

  if (!result || !recon) {
    return (
      <div className="max-w-md mx-auto">
        <EmptyState
          icon={Film}
          title="Replay unavailable"
          action={
            <Button variant="primary" as={Link} to="/stats">
              Back to stats
            </Button>
          }
        >
          We couldn't find that solve in your history. It may have been cleared, or the link is out of date.
        </EmptyState>
      </div>
    )
  }

  const { givens, steps } = recon
  const current = steps[Math.min(idx, steps.length - 1)]
  const meta = difficultyMeta(result.difficulty)
  const km = KIND_META[current.kind]
  const StepIcon = km.icon

  const boardGame = { cells: current.cells, notes: current.notes, selected: current.index ?? null, givens }
  const replaySettings = { highlightPeers: false, highlightSame: false }

  // A single honest line about this step.
  const detail = (() => {
    if (current.kind === 'start') return 'The puzzle as it was dealt.'
    if (current.kind === 'solved') return 'Board complete and matching the unique solution.'
    const where = current.index != null ? ` at ${cellName(current.index)}` : ''
    if (current.kind === 'correct') return `Placed ${current.value}${where}.`
    if (current.kind === 'correction') return `Replaced an earlier wrong entry with ${current.value}${where}.`
    if (current.kind === 'mistake') return `Entered ${current.value}${where} — it can't be right for this cell.`
    if (current.kind === 'note') return `Toggled pencil mark ${current.value}${where}.`
    if (current.kind === 'erase') return `Cleared ${where.trim()}.`
    if (current.kind === 'hint') return `Asked for a hint${where}.`
    return ''
  })()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted text-sm">
            <Film size={16} className="text-accent" />
            <span>Solve replay</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1 capitalize">
            {meta.label} · {result.mode}
          </h1>
          <p className="text-muted mt-1 text-sm">{formatDate(result.date)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" as={Link} to={`/play?difficulty=${result.difficulty}&seed=${result.seed}`}>
            <ArrowRight size={16} /> Play this puzzle
          </Button>
        </div>
      </div>

      {/* summary metrics */}
      <Panel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat label="Final time" value={formatTime(result.timeMs)} icon={Gauge} />
          <Stat label="Accuracy" value={formatPercent(result.accuracy)} icon={Target} tone={result.accuracy >= 0.95 ? 'ok' : result.accuracy < 0.85 ? 'warn' : 'default'} />
          <Stat label="Mistakes" value={result.mistakes} tone={result.mistakes ? 'bad' : 'ok'} />
          <Stat label="Hints" value={result.hintsUsed} tone={result.hintsUsed ? 'warn' : 'ok'} />
        </div>
      </Panel>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        {/* board */}
        <div>
          <Board
            game={boardGame}
            wrongSet={wrongSet}
            hintCell={current.index ?? null}
            settings={replaySettings}
            interactive={false}
            maxWidth={520}
          />

          {/* transport */}
          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => jump(0)} aria-label="Jump to start" disabled={idx === 0}>
                  <SkipBack size={18} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous step" disabled={idx === 0}>
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="primary" size="icon" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <Pause size={18} /> : <PlayIcon size={18} />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next step" disabled={atEnd}>
                  <ChevronRight size={18} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => jump(last)} aria-label="Jump to end" disabled={atEnd}>
                  <SkipForward size={18} />
                </Button>
              </div>
              <Segmented
                size="sm"
                aria-label="Playback speed"
                value={speed}
                onChange={setSpeed}
                options={[{ value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }]}
              />
            </div>

            <div className="mt-4">
              <Timeline steps={steps} idx={idx} onJump={jump} />
              <input
                type="range"
                min={0}
                max={last}
                value={idx}
                onChange={(e) => jump(Number(e.target.value))}
                aria-label="Scrub through the solve"
                className="w-full mt-2 accent-accent"
              />
              <div className="flex justify-between text-xs text-faint tnum mt-1">
                <span>Move {idx} / {last}</span>
                <span>{formatTime(current.t)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* step read-out + legend */}
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'grid place-items-center h-9 w-9 rounded-xl shrink-0',
                  km.tone === 'ok' && 'bg-ok-soft text-ok',
                  km.tone === 'bad' && 'bg-bad-soft text-bad',
                  km.tone === 'warn' && 'bg-warn-soft text-warn',
                  km.tone === 'accent' && 'bg-accent-soft text-accent',
                  km.tone === 'neutral' && 'bg-surface-2 text-muted',
                )}
              >
                <StepIcon size={18} />
              </span>
              <div className="min-w-0">
                <div className="font-semibold leading-tight">{km.label}</div>
                {current.index != null && <div className="text-xs text-faint tnum">{cellName(current.index)}</div>}
              </div>
            </div>
            <p className="text-sm text-muted mt-3 leading-relaxed">{detail}</p>

            {current.turning === 'breakthrough' && (
              <Callout tone="ok" icon={Zap} className="mt-3">
                Breakthrough — a {formatDuration(current.pauseMs)} think opened up a run of correct placements.
              </Callout>
            )}
            {current.turning === 'pause' && (
              <Callout tone="info" icon={Clock} className="mt-3">
                A {formatDuration(current.pauseMs)} pause — scanning for the next move.
              </Callout>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Stat label="Mistakes so far" value={current.mistakes} tone={current.mistakes ? 'bad' : 'default'} />
              <Stat label="Hints so far" value={current.hints} tone={current.hints ? 'warn' : 'default'} />
            </div>
          </Panel>

          <Panel>
            <div className="text-sm font-medium text-muted mb-3">This solve</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-ok" /> Correct placements</span>
                <span className="tnum text-muted">{counts.correct}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2"><CornerUpLeft size={15} className="text-accent" /> Corrections</span>
                <span className="tnum text-muted">{counts.corrections}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2"><XCircle size={15} className="text-bad" /> Mistakes</span>
                <span className="tnum text-muted">{counts.mistakes}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Lightbulb size={15} className="text-warn" /> Hints</span>
                <span className="tnum text-muted">{result.hintsUsed}</span>
              </li>
            </ul>
            <p className="text-xs text-faint mt-3 leading-relaxed">
              Taller ticks on the timeline are longer pauses. Use ← → to step, space to play.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
