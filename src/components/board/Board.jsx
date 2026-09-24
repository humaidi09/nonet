// The board. The typographic signature lives here: givens are set in the display
// face (the "printed" clues), your entries in the body face (clearly yours), and
// pencil marks in tiny tabular figures. Highlighting (selection, peers, same
// number) and mistakes are all driven by settings; mistakes are never shown by
// colour alone — a wrong entry also carries a corner marker and an aria-label.

import { memo, useRef, useState, useLayoutEffect } from 'react'
import { EMPTY, SIZE, boxOf } from '@/engine/sudoku'
import { hasNote } from '@/engine/game'
import { cx } from '@/components/ui'

const rowOf = (i) => (i / SIZE) | 0
const colOf = (i) => i % SIZE

/** Precompute per-cell highlight flags for the current selection. */
function highlightFlags(selected, cells, settings) {
  const peers = new Uint8Array(81)
  const same = new Uint8Array(81)
  if (selected == null || selected < 0) return { peers, same }
  const sr = rowOf(selected)
  const sc = colOf(selected)
  const sb = boxOf(sr, sc)
  const selVal = cells[selected]
  for (let i = 0; i < 81; i++) {
    if (settings.highlightPeers) {
      if (rowOf(i) === sr || colOf(i) === sc || boxOf(rowOf(i), colOf(i)) === sb) peers[i] = 1
    }
    if (settings.highlightSame && selVal !== EMPTY && cells[i] === selVal) same[i] = 1
  }
  return { peers, same }
}

const Cell = memo(function Cell({
  index, value, given, notes, selected, peer, same, wrong, conflict, hintTarget, onSelect, interactive, digitPx, notePx, flash, sweep,
}) {
  const r = rowOf(index)
  const c = colOf(index)

  // Box grid: thicker rule on the 3rd column/row of each box (not the outer edge).
  const style = {
    borderRight: c === 8 ? 'none' : `${c % 3 === 2 ? 2 : 1}px solid ${c % 3 === 2 ? 'var(--board-box)' : 'var(--board-line)'}`,
    borderBottom: r === 8 ? 'none' : `${r % 3 === 2 ? 2 : 1}px solid ${r % 3 === 2 ? 'var(--board-box)' : 'var(--board-line)'}`,
  }

  let bg = 'transparent'
  if (wrong) bg = 'var(--bad-soft)'
  else if (selected) bg = 'var(--cell-sel)'
  else if (same) bg = 'var(--cell-same)'
  else if (peer) bg = 'var(--cell-peer)'

  const label = `Row ${r + 1}, column ${c + 1}${value !== EMPTY ? `, ${value}${given ? (conflict ? ' (given, conflicts)' : ' (given)') : wrong ? ' (incorrect)' : conflict ? ' (conflicts)' : ''}` : ', empty'}`

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      tabIndex={-1}
      onClick={interactive ? () => onSelect(index) : undefined}
      className={cx(
        'relative grid place-items-center aspect-square transition-colors duration-100',
        interactive ? 'cursor-pointer' : 'cursor-default',
        hintTarget && 'z-10',
      )}
      style={{ ...style, backgroundColor: bg }}
    >
      {/* unit-completion sweep wash */}
      {sweep && (
        <span className="absolute inset-0 animate-sweep pointer-events-none" aria-hidden="true" />
      )}

      {/* hint ring */}
      {hintTarget && (
        <span className="absolute inset-0.5 rounded-md ring-2 ring-accent animate-ripple pointer-events-none" />
      )}

      {value !== EMPTY ? (
        <span
          className={cx(
            'leading-none tabular-nums select-none',
            given ? 'font-display font-semibold text-given' : 'font-sans font-medium',
            !given && (wrong ? 'text-bad' : conflict ? 'text-warn' : 'text-entry'),
            flash === 'correct' && 'animate-place',
            flash === 'wrong' && 'animate-shake',
          )}
          style={{ fontSize: digitPx }}
        >
          {value}
        </span>
      ) : notes ? (
        <span className="grid grid-cols-3 grid-rows-3 w-full h-full p-[8%] leading-none">
          {Array.from({ length: 9 }, (_, k) => {
            const d = k + 1
            const on = hasNote(notes, d)
            return (
              <span
                key={d}
                className={cx('grid place-items-center tabular-nums', same && value === EMPTY ? '' : '', on ? 'text-faint' : 'text-transparent')}
                style={{ fontSize: notePx }}
              >
                {d}
              </span>
            )
          })}
        </span>
      ) : null}

      {/* non-colour mistake marker */}
      {wrong && (
        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-bad" aria-hidden="true" />
      )}

      {/* non-colour conflict marker: this digit repeats in its row, column or box */}
      {conflict && !wrong && (
        <span className="absolute bottom-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />
      )}
    </button>
  )
})

/**
 * Board. `wrongSet` is a Set of indices to flag as incorrect (the caller decides
 * based on mistake-mode). `hintCell` optionally rings a cell. `interactive`
 * gates click/selection (the Home mini-board is interactive too).
 */
export function Board({
  game, wrongSet, conflictSet, hintCell = null, onSelect, settings, interactive = true, className, maxWidth = 560, flash = null,
}) {
  const ref = useRef(null)
  const [px, setPx] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver((e) => setPx(e[0].contentRect.width))
    ro.observe(ref.current)
    setPx(ref.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { cells, notes, selected, givens } = game
  const { peers, same } = highlightFlags(selected, cells, settings)
  const flashIndex = flash ? flash.index : -1
  const flashKind = flash ? flash.kind : null
  const flashSweep = flash && flash.sweep ? flash.sweep : null
  const cellPx = px / 9
  const digitPx = Math.round(cellPx * 0.54)
  const notePx = Math.round(cellPx * 0.24)

  return (
    <div className={cx('w-full mx-auto', className)} style={{ maxWidth }}>
      <div
        ref={ref}
        role="grid"
        aria-label="Sudoku board"
        className="grid grid-cols-9 w-full aspect-square rounded-xl border-2 border-board-box overflow-hidden bg-cell select-none"
        style={{ touchAction: 'manipulation' }}
      >
        {cells.map((value, i) => (
          <Cell
            key={i}
            index={i}
            value={value}
            given={givens[i]}
            notes={value === EMPTY ? notes[i] : 0}
            selected={selected === i}
            peer={peers[i] === 1}
            same={same[i] === 1 && selected !== i}
            wrong={wrongSet ? wrongSet.has(i) : false}
            conflict={conflictSet ? conflictSet.has(i) : false}
            hintTarget={hintCell === i}
            flash={flashIndex === i ? flashKind : null}
            sweep={flashSweep ? flashSweep.has(i) : false}
            onSelect={onSelect}
            interactive={interactive}
            digitPx={digitPx}
            notePx={notePx}
          />
        ))}
      </div>
    </div>
  )
}
