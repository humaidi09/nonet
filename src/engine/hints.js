// Hint engine. Returns a genuinely correct next step, preferring the human
// technique a player would actually use so hints teach rather than just reveal.
// Order: naked single -> hidden single -> (fallback) reveal from the known
// unique solution. Never fabricates a move.

import {
  SIZE,
  EMPTY,
  cellIndex,
  boxOf,
  computeMasks,
  candidatesMask,
  digitsFromMask,
  countBits,
  unitCells,
} from './sudoku'

export const TECHNIQUES = {
  'naked-single': {
    label: 'Naked single',
    lesson: 'naked-single',
    blurb: 'Only one digit can legally go in this cell.',
  },
  'hidden-single': {
    label: 'Hidden single',
    lesson: 'hidden-single',
    blurb: 'Within a unit, this digit fits in only one cell.',
  },
  reveal: {
    label: 'Revealed',
    lesson: 'scanning',
    blurb: 'This one needs an advanced technique — here is the answer for this cell.',
  },
}

const rc = (index) => ({ row: (index / SIZE) | 0, col: index % SIZE })

/** Find a naked single: an empty cell whose candidate mask has exactly one bit. */
function findNakedSingle(cells, masks) {
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== EMPTY) continue
    const { row, col } = rc(i)
    const mask = candidatesMask(masks, row, col)
    if (countBits(mask) === 1) {
      return { technique: 'naked-single', cell: i, row, col, digit: digitsFromMask(mask)[0] }
    }
  }
  return null
}

/** Find a hidden single: a digit with exactly one legal home in some unit. */
function findHiddenSingle(cells, masks) {
  const kinds = ['row', 'col', 'box']
  for (const kind of kinds) {
    for (let u = 0; u < SIZE; u++) {
      const unit = unitCells(kind, u)
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1)
        let home = -1
        let placed = false
        for (const idx of unit) {
          if (cells[idx] === d) {
            placed = true
            break
          }
          if (cells[idx] !== EMPTY) continue
          const { row, col } = rc(idx)
          if (candidatesMask(masks, row, col) & bit) {
            if (home === -1) home = idx
            else {
              home = -2 // more than one home -> not hidden single
              break
            }
          }
        }
        if (!placed && home >= 0) {
          const { row, col } = rc(home)
          return {
            technique: 'hidden-single',
            cell: home,
            row,
            col,
            digit: d,
            unitKind: kind,
            unitIndex: u,
          }
        }
      }
    }
  }
  return null
}

/** Most-constrained empty cell (fewest candidates) — the natural cell to reveal. */
function mostConstrained(cells, masks) {
  let best = -1
  let fewest = 10
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== EMPTY) continue
    const { row, col } = rc(i)
    const n = countBits(candidatesMask(masks, row, col))
    if (n < fewest) {
      fewest = n
      best = i
    }
  }
  return best
}

/**
 * A correct next step for `cells`, given the puzzle's unique `solution`.
 * Returns null only when the board is already complete. The returned object:
 *   { technique, cell, row, col, digit, unitKind?, unitIndex?, meta }
 */
export function getHint(cells, solution) {
  const masks = computeMasks(cells)

  const naked = findNakedSingle(cells, masks)
  if (naked) return { ...naked, meta: TECHNIQUES[naked.technique] }

  const hidden = findHiddenSingle(cells, masks)
  if (hidden) return { ...hidden, meta: TECHNIQUES[hidden.technique] }

  // No basic single available — reveal the correct digit for the tightest cell.
  const idx = mostConstrained(cells, masks)
  if (idx < 0) return null
  const { row, col } = rc(idx)
  const digit = solution ? solution[idx] : null
  return { technique: 'reveal', cell: idx, row, col, digit, meta: TECHNIQUES.reveal }
}

/** All naked singles on the board (used by the Learning Centre examples). */
export function allNakedSingles(cells) {
  const masks = computeMasks(cells)
  const out = []
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== EMPTY) continue
    const { row, col } = rc(i)
    const mask = candidatesMask(masks, row, col)
    if (countBits(mask) === 1) out.push({ cell: i, row, col, digit: digitsFromMask(mask)[0] })
  }
  return out
}
