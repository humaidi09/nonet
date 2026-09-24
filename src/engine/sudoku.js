// Sudoku engine (C++ Sudoku-Solver core, ported to JS and verified in the
// portfolio demos). Reused here as the correctness backbone of the game:
//   * the board is a flat array of 81 cells, 0 = empty;
//   * the solver is recursive backtracking with a 9-bit candidate mask per row,
//     column and box, plus most-constrained-variable (MRV) ordering;
//   * generation fills a random complete grid, then carves clues while a
//     stop-at-2 solution counter proves the puzzle still has ONE solution.
//
// Nonet additions live at the bottom (candidate inspection) and power the hint
// engine and pencil-mark auto-fill. The core is unchanged from the verified port.

import { mulberry32, hashSeed, shuffle } from './prng'

export const SIZE = 9 // 9x9 grid
export const BOX = 3 // 3x3 subgrid
export const CELLS = 81
export const EMPTY = 0 // sentinel for an unfilled cell

const ALL = 0x1ff // bits 0-8 set: digits 1-9 all available

/** Index of the box containing (row, col): (r/3)*3 + (c/3), 0-8 left to right. */
export function boxOf(row, col) {
  return ((row / BOX) | 0) * BOX + ((col / BOX) | 0)
}

/** Flat cell index for (row, col). */
export const cellIndex = (row, col) => row * SIZE + col

/** Population count of a 9-bit mask (Kernighan's clear-the-lowest-bit loop). */
function popcount9(mask) {
  let count = 0
  while (mask) {
    mask &= mask - 1
    count++
  }
  return count
}

/** The digit (1-9) a single-bit mask stands for: bit 0 -> 1 ... bit 8 -> 9. */
function digitFromBit(bit) {
  let digit = 1
  while (bit > 1) {
    bit >>= 1
    digit++
  }
  return digit
}

/** A fresh empty grid: 81 zeros. */
export function emptyGrid() {
  return new Array(CELLS).fill(EMPTY)
}

/** Number of filled (non-empty) cells — the clue count. */
export function clueCount(cells) {
  let n = 0
  for (let i = 0; i < CELLS; i++) if (cells[i] !== EMPTY) n++
  return n
}

/** True when no cell is empty (says nothing about validity). */
export function isComplete(cells) {
  for (let i = 0; i < CELLS; i++) if (cells[i] === EMPTY) return false
  return true
}

/** Render a grid as 81 characters, '.' for empty. */
export function toCompactString(cells) {
  let out = ''
  for (let i = 0; i < CELLS; i++) out += cells[i] === EMPTY ? '.' : String(cells[i])
  return out
}

/**
 * Tolerant parser: digits 1-9 are clues; '.', '0', '_' and '*' mark empty
 * cells; every other character is decoration and is skipped. Returns an 81-cell
 * array, or null when the text does not hold exactly 81 cell characters.
 */
export function parseGrid(text) {
  const values = []
  for (const ch of text) {
    if (ch >= '1' && ch <= '9') values.push(ch.charCodeAt(0) - 48)
    else if (ch === '.' || ch === '0' || ch === '_' || ch === '*') values.push(EMPTY)
    if (values.length > CELLS) return null
  }
  return values.length === CELLS ? values : null
}

/* ------------------------------------------------------------- conflicts -- */

function markUnit(cells, unit, bad) {
  const byDigit = new Map()
  for (const i of unit) {
    const v = cells[i]
    if (v === EMPTY) continue
    const list = byDigit.get(v)
    if (list) list.push(i)
    else byDigit.set(v, [i])
  }
  for (const list of byDigit.values()) {
    if (list.length > 1) for (const i of list) bad.add(i)
  }
}

/**
 * The set of cell indices that break a Sudoku rule — a digit repeated in its
 * row, column or box. Powers the grid's live conflict highlighting.
 */
export function findConflicts(cells) {
  const bad = new Set()
  for (let r = 0; r < SIZE; r++) {
    const row = []
    const col = []
    for (let c = 0; c < SIZE; c++) {
      row.push(cellIndex(r, c))
      col.push(cellIndex(c, r))
    }
    markUnit(cells, row, bad)
    markUnit(cells, col, bad)
  }
  for (let b = 0; b < SIZE; b++) {
    const box = []
    const baseRow = ((b / BOX) | 0) * BOX
    const baseCol = (b % BOX) * BOX
    for (let dr = 0; dr < BOX; dr++) {
      for (let dc = 0; dc < BOX; dc++) box.push(cellIndex(baseRow + dr, baseCol + dc))
    }
    markUnit(cells, box, bad)
  }
  return bad
}

/* ---------------------------------------------------------------- solver -- */

function makeState(cells) {
  const state = {
    cells: cells.slice(),
    rowMask: new Array(SIZE).fill(0),
    colMask: new Array(SIZE).fill(0),
    boxMask: new Array(SIZE).fill(0),
    placements: 0,
    backtracks: 0,
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = state.cells[cellIndex(r, c)]
      if (v === EMPTY) continue
      if (v < 1 || v > 9) return null
      const bit = 1 << (v - 1)
      const b = boxOf(r, c)
      if ((state.rowMask[r] | state.colMask[c] | state.boxMask[b]) & bit) return null
      state.rowMask[r] |= bit
      state.colMask[c] |= bit
      state.boxMask[b] |= bit
    }
  }
  return state
}

function candidatesAtState(state, row, col) {
  const used = state.rowMask[row] | state.colMask[col] | state.boxMask[boxOf(row, col)]
  return ~used & ALL
}

function place(state, row, col, value) {
  const bit = 1 << (value - 1)
  state.cells[cellIndex(row, col)] = value
  state.rowMask[row] |= bit
  state.colMask[col] |= bit
  state.boxMask[boxOf(row, col)] |= bit
  state.placements++
}

function unplace(state, row, col, value) {
  const bit = 1 << (value - 1)
  state.cells[cellIndex(row, col)] = EMPTY
  state.rowMask[row] &= ~bit
  state.colMask[col] &= ~bit
  state.boxMask[boxOf(row, col)] &= ~bit
  state.backtracks++
}

function selectCell(state) {
  let fewest = 10
  let best = null
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (state.cells[cellIndex(row, col)] !== EMPTY) continue
      const candidates = candidatesAtState(state, row, col)
      const count = popcount9(candidates)
      if (count < fewest) {
        fewest = count
        best = { row, col, candidates }
        if (count === 0) return best
      }
    }
  }
  return best
}

function search(state) {
  const sel = selectCell(state)
  if (!sel) return true
  if (sel.candidates === 0) return false
  for (let m = sel.candidates; m !== 0; m &= m - 1) {
    const value = digitFromBit(m & -m)
    place(state, sel.row, sel.col, value)
    if (search(state)) return true
    unplace(state, sel.row, sel.col, value)
  }
  return false
}

function searchCounting(state, limit, counter) {
  if (counter.found >= limit) return
  const sel = selectCell(state)
  if (!sel) {
    counter.found++
    return
  }
  if (sel.candidates === 0) return
  for (let m = sel.candidates; m !== 0; m &= m - 1) {
    const value = digitFromBit(m & -m)
    place(state, sel.row, sel.col, value)
    searchCounting(state, limit, counter)
    unplace(state, sel.row, sel.col, value)
    if (counter.found >= limit) return
  }
}

export const SolveStatus = {
  Solved: 'solved',
  NoSolution: 'no-solution',
  Invalid: 'invalid',
}

export function solve(cells) {
  const emptyAtStart = CELLS - clueCount(cells)
  const state = makeState(cells)
  if (!state) {
    return { status: SolveStatus.Invalid, solution: null, stats: { placements: 0, backtracks: 0, emptyAtStart } }
  }
  const solved = search(state)
  const stats = { placements: state.placements, backtracks: state.backtracks, emptyAtStart }
  if (solved) return { status: SolveStatus.Solved, solution: state.cells.slice(), stats }
  return { status: SolveStatus.NoSolution, solution: null, stats }
}

export function countSolutions(cells, limit = 2) {
  if (limit <= 0) return 0
  const state = makeState(cells)
  if (!state) return 0
  const counter = { found: 0 }
  searchCounting(state, limit, counter)
  return counter.found
}

export function hasUniqueSolution(cells) {
  return countSolutions(cells, 2) === 1
}

/* ------------------------------------------------------------- generator -- */

// Difficulty as clues left on the board. 17 is the proven minimum for a unique
// Sudoku; generation never drops below it. Labels/estimates are Nonet's.
export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', clues: 45, rating: 1000 },
  { id: 'medium', label: 'Medium', clues: 36, rating: 1300 },
  { id: 'hard', label: 'Hard', clues: 30, rating: 1650 },
  { id: 'expert', label: 'Expert', clues: 25, rating: 2000 },
]

export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id)
export const difficultyMeta = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1]

const CLUE_TARGET = { easy: 45, medium: 36, hard: 30, expert: 25 }

export function targetClues(difficulty) {
  return CLUE_TARGET[difficulty] ?? 36
}

function fillComplete(rng) {
  const cells = emptyGrid()
  const rowMask = new Array(SIZE).fill(0)
  const colMask = new Array(SIZE).fill(0)
  const boxMask = new Array(SIZE).fill(0)

  const recurse = (index) => {
    if (index === CELLS) return true
    const row = (index / SIZE) | 0
    const col = index % SIZE
    const b = boxOf(row, col)
    const candidates = ~(rowMask[row] | colMask[col] | boxMask[b]) & ALL
    const digits = []
    for (let m = candidates; m !== 0; m &= m - 1) digits.push(digitFromBit(m & -m))
    shuffle(digits, rng)
    for (const value of digits) {
      const bit = 1 << (value - 1)
      cells[index] = value
      rowMask[row] |= bit
      colMask[col] |= bit
      boxMask[b] |= bit
      if (recurse(index + 1)) return true
      cells[index] = EMPTY
      rowMask[row] &= ~bit
      colMask[col] &= ~bit
      boxMask[b] &= ~bit
    }
    return false
  }

  recurse(0)
  return cells
}

export function fillSolution(seedText) {
  return fillComplete(mulberry32(hashSeed(seedText)))
}

/**
 * Build a puzzle guaranteed to have exactly one solution. One seeded PRNG drives
 * both the fill and the removal order, so `seedText` reproduces the whole puzzle
 * (puzzle + answer). Returns { puzzle, solution, clues, difficulty, seed, unique }.
 */
export function generate(difficulty, seedText) {
  const rng = mulberry32(hashSeed(seedText))
  const solution = fillComplete(rng)

  const puzzle = solution.slice()
  const order = Array.from({ length: CELLS }, (_, i) => i)
  shuffle(order, rng)

  const target = targetClues(difficulty)
  let clues = CELLS
  for (const idx of order) {
    if (clues <= target) break
    const removed = puzzle[idx]
    puzzle[idx] = EMPTY
    if (hasUniqueSolution(puzzle)) clues--
    else puzzle[idx] = removed
  }

  return {
    puzzle,
    solution,
    clues: clueCount(puzzle),
    difficulty,
    seed: seedText,
    unique: hasUniqueSolution(puzzle),
  }
}

/* ----------------------------------------------------- candidate helpers --
   Nonet additions. Pure functions over a board, used by the hint engine, the
   "auto-notes" toggle, and the technique lessons. They compute the same 9-bit
   candidate masks the solver uses, but exposed per cell for the UI. */

/** One 9-bit "used digits" mask per row, column and box for the given board. */
export function computeMasks(cells) {
  const rowMask = new Array(SIZE).fill(0)
  const colMask = new Array(SIZE).fill(0)
  const boxMask = new Array(SIZE).fill(0)
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = cells[cellIndex(r, c)]
      if (v === EMPTY) continue
      const bit = 1 << (v - 1)
      rowMask[r] |= bit
      colMask[c] |= bit
      boxMask[boxOf(r, c)] |= bit
    }
  }
  return { rowMask, colMask, boxMask }
}

/** Bitmask of digits still legal at (row, col) given precomputed masks. */
export function candidatesMask(masks, row, col) {
  const used = masks.rowMask[row] | masks.colMask[col] | masks.boxMask[boxOf(row, col)]
  return ~used & ALL
}

/** Expand a 9-bit mask into an ascending array of digits, e.g. 0b101 -> [1, 3]. */
export function digitsFromMask(mask) {
  const out = []
  for (let m = mask & ALL; m !== 0; m &= m - 1) out.push(digitFromBit(m & -m))
  return out
}

/** Number of set bits in a candidate mask. */
export function countBits(mask) {
  return popcount9(mask & ALL)
}

/** Legal digits (array) at an EMPTY cell of `cells`. [] if the cell is filled. */
export function candidatesFor(cells, row, col) {
  if (cells[cellIndex(row, col)] !== EMPTY) return []
  return digitsFromMask(candidatesMask(computeMasks(cells), row, col))
}

/** Cell indices of one unit. kind: 'row' | 'col' | 'box', i in 0..8. */
export function unitCells(kind, i) {
  const out = []
  if (kind === 'row') for (let c = 0; c < SIZE; c++) out.push(cellIndex(i, c))
  else if (kind === 'col') for (let r = 0; r < SIZE; r++) out.push(cellIndex(r, i))
  else {
    const baseRow = ((i / BOX) | 0) * BOX
    const baseCol = (i % BOX) * BOX
    for (let dr = 0; dr < BOX; dr++) for (let dc = 0; dc < BOX; dc++) out.push(cellIndex(baseRow + dr, baseCol + dc))
  }
  return out
}
