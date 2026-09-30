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

const DEFAULT_TECHNIQUES = {
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

// Live binding. applyTechniques() may replace this with owner-edited hint copy.
// The KEYS are an engine contract — the solver only ever emits 'naked-single',
// 'hidden-single', or 'reveal' — so only the display text (label/blurb/lesson) is
// editable; the three keys always exist and unknown keys are ignored.
export let TECHNIQUES = DEFAULT_TECHNIQUES

const techStr = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

/**
 * Merge owner-edited hint copy onto the defaults. Accepts either a list of
 * { key|id, label, blurb, lesson } rows or a keyed object. Only the three
 * contract keys are kept; each always retains a full {label, lesson, blurb}.
 */
export function applyTechniques(rows) {
  if (!rows || typeof rows !== 'object') return
  const byKey = new Map()
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue
      const key = techStr(r.key ?? r.id, '')
      if (key) byKey.set(key, r)
    }
  } else {
    for (const [k, v] of Object.entries(rows)) {
      if (v && typeof v === 'object') byKey.set(k, v)
    }
  }
  let changed = false
  const merged = {}
  for (const [key, def] of Object.entries(DEFAULT_TECHNIQUES)) {
    const r = byKey.get(key)
    if (!r) {
      merged[key] = def
      continue
    }
    changed = true
    merged[key] = {
      label: techStr(r.label, def.label),
      lesson: techStr(r.lesson, def.lesson),
      blurb: techStr(r.blurb, def.blurb),
    }
  }
  if (changed) TECHNIQUES = merged
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
