// Game controller. Pure functions over an immutable `game` object; each mutation
// returns a new game. The store holds the current game and swaps it wholesale.
//
// The move log (`moves`) is the source of truth for Replay and the Coach: an
// append-only, timestamped record of every meaningful action. Undo/redo is kept
// separate (inverse-op stacks) so it never rewrites solving history.

import {
  CELLS,
  EMPTY,
  boxOf,
  cellIndex,
  clueCount,
  isComplete,
  unitCells,
  generate,
  difficultyMeta,
  toCompactString,
} from './sudoku'

export const MODES = {
  classic: { id: 'classic', label: 'Classic', blurb: 'A clean solve. Timer on, mistakes flagged.', timer: true, tracksStats: true },
  daily: { id: 'daily', label: 'Daily Challenge', blurb: "Everyone gets today's puzzle.", timer: true, tracksStats: true },
  timed: { id: 'timed', label: 'Timed', blurb: 'Race the clock. Speed is the point.', timer: true, tracksStats: true },
  practice: { id: 'practice', label: 'Practice', blurb: 'Learn techniques. Hints and notes encouraged.', timer: true, tracksStats: true },
  relaxed: { id: 'relaxed', label: 'Relaxed', blurb: 'No timer, no pressure. Just solve.', timer: false, tracksStats: false },
}

export const modeMeta = (id) => MODES[id] || MODES.classic

/** Note bitmask helpers (a pencil-mark set per cell, bits 0..8 = digits 1..9). */
const noteBit = (d) => 1 << (d - 1)
export const hasNote = (mask, d) => (mask & noteBit(d)) !== 0
export const notesToDigits = (mask) => {
  const out = []
  for (let d = 1; d <= 9; d++) if (mask & noteBit(d)) out.push(d)
  return out
}

/** now() indirection keeps the module testable and replay timestamps solve-relative. */
const now = () => Date.now()

/** Solve-relative elapsed ms, accounting for the running/paused split. */
export function elapsedMs(game, at = now()) {
  return game.elapsedMs + (game.runningSince ? at - game.runningSince : 0)
}

export function elapsedSeconds(game, at = now()) {
  return Math.floor(elapsedMs(game, at) / 1000)
}

/**
 * Create a fresh game. `seed` is optional; when omitted a random one is used so
 * the puzzle is reproducible from (difficulty, seed). Daily callers pass a
 * date-derived seed and mode 'daily'.
 */
export function createGame({ mode = 'classic', difficulty = 'medium', seed, id } = {}) {
  const usedSeed = String(seed || Math.random().toString(36).slice(2, 9))
  const gen = generate(difficulty, usedSeed)
  const givens = gen.puzzle.map((v) => v !== EMPTY)
  const t = now()
  return {
    id: id || `${difficulty}:${usedSeed}`,
    mode,
    difficulty,
    seed: usedSeed,
    puzzle: gen.puzzle,
    solution: gen.solution,
    cells: gen.puzzle.slice(),
    givens,
    notes: new Array(CELLS).fill(0),
    selected: gen.puzzle.findIndex((v) => v === EMPTY),
    status: 'playing', // 'playing' | 'paused' | 'complete'
    startedAt: t,
    runningSince: t,
    elapsedMs: 0,
    mistakes: 0,
    hintsUsed: 0,
    moves: [],
    undo: [],
    redo: [],
    createdAt: t,
  }
}

/** Rehydrate a game object from persisted JSON (arrays survive JSON fine). */
export function reviveGame(raw) {
  if (!raw || !Array.isArray(raw.cells)) return null
  // A persisted game resumes paused, so the clock does not jump by the time away.
  return { ...raw, status: raw.status === 'complete' ? 'complete' : 'paused', runningSince: null }
}

function logMove(game, move) {
  return [...game.moves, { t: elapsedMs(game), ...move }]
}

/** True when the board is full and equals the unique solution — never faked. */
export function isSolved(game) {
  if (!isComplete(game.cells)) return false
  for (let i = 0; i < CELLS; i++) if (game.cells[i] !== game.solution[i]) return false
  return true
}

/** Cells the player entered that disagree with the unique solution. */
export function wrongCells(game) {
  const bad = new Set()
  for (let i = 0; i < CELLS; i++) {
    if (game.givens[i]) continue
    if (game.cells[i] !== EMPTY && game.cells[i] !== game.solution[i]) bad.add(i)
  }
  return bad
}

export function remainingCount(game, digit) {
  // How many of `digit` are still missing vs the solution (for number-pad badges).
  let placed = 0
  for (let i = 0; i < CELLS; i++) if (game.cells[i] === digit) placed++
  return 9 - placed
}

function pushUndo(game, entry) {
  return { undo: [...game.undo, entry], redo: [] }
}

/* --- transient placement events (drive UI feedback; never persisted) ------- */

let EVENT_SEQ = 0
const nextEventSeq = () => (EVENT_SEQ += 1)

/** True when every cell of `idxs` is filled and matches the solution. */
function unitFullyCorrect(cells, solution, idxs) {
  for (const i of idxs) if (cells[i] === EMPTY || cells[i] !== solution[i]) return false
  return true
}

/** Row/col/box the just-placed `index` just completed (all cells correct now). */
function completedUnitsFor(cells, solution, index) {
  const r = (index / 9) | 0
  const c = index % 9
  const out = []
  if (unitFullyCorrect(cells, solution, unitCells('row', r))) out.push({ type: 'row', index: r })
  if (unitFullyCorrect(cells, solution, unitCells('col', c))) out.push({ type: 'col', index: c })
  const b = boxOf(r, c)
  if (unitFullyCorrect(cells, solution, unitCells('box', b))) out.push({ type: 'box', index: b })
  return out
}

/**
 * Enter a digit at a cell (or toggle a note when notesMode is on). Givens are
 * locked. Returns a new game. `opts`: { notesMode, autoClean }.
 */
export function inputDigit(game, index, digit, opts = {}) {
  if (game.status !== 'playing') return game
  if (index == null || game.givens[index]) return game
  const { notesMode = false, autoClean = true, viaHint = false } = opts

  if (notesMode) {
    // Notes only apply to empty cells.
    if (game.cells[index] !== EMPTY) return game
    const prevNotes = game.notes[index]
    const nextNotes = prevNotes ^ noteBit(digit)
    const notes = game.notes.slice()
    notes[index] = nextNotes
    return {
      ...game,
      notes,
      selected: index,
      moves: logMove(game, { type: 'note', index, value: digit }),
      ...pushUndo(game, { index, cell: [game.cells[index], game.cells[index]], notes: [prevNotes, nextNotes] }),
    }
  }

  const prevValue = game.cells[index]
  if (prevValue === digit) return game // no-op re-entry
  const cells = game.cells.slice()
  const notes = game.notes.slice()
  cells[index] = digit
  const prevNotes = notes[index]
  notes[index] = 0 // placing a real digit clears the cell's own pencil marks

  // Optional: remove this digit from peers' notes (row/col/box) — a QoL clean-up.
  if (autoClean) removeDigitFromPeerNotes(notes, cells, index, digit)

  const correct = digit === game.solution[index]
  const mistakes = game.mistakes + (correct ? 0 : 1)

  let next = {
    ...game,
    cells,
    notes,
    selected: index,
    mistakes,
    moves: logMove(game, { type: 'place', index, value: digit, prev: prevValue, correct }),
    ...pushUndo(game, { index, cell: [prevValue, digit], notes: [prevNotes, 0] }),
  }

  // Describe what this placement did so the UI can respond (sound, haptics,
  // cell + unit animation). Transient: useGame strips it before it is persisted.
  const solved = isSolved(next)
  const completed = correct && !solved ? completedUnitsFor(cells, game.solution, index) : []
  next.lastEvent = { kind: 'place', index, digit, correct, completed, solved, viaHint, seq: nextEventSeq() }

  if (solved) next = finish(next)
  return next
}

export function eraseCell(game, index) {
  if (game.status !== 'playing') return game
  if (index == null || game.givens[index]) return game
  const prevValue = game.cells[index]
  const prevNotes = game.notes[index]
  if (prevValue === EMPTY && prevNotes === 0) return game
  const cells = game.cells.slice()
  const notes = game.notes.slice()
  cells[index] = EMPTY
  notes[index] = 0
  return {
    ...game,
    cells,
    notes,
    selected: index,
    moves: logMove(game, { type: 'erase', index, prev: prevValue }),
    ...pushUndo(game, { index, cell: [prevValue, EMPTY], notes: [prevNotes, 0] }),
    lastEvent: { kind: 'erase', index, seq: nextEventSeq() },
  }
}

function removeDigitFromPeerNotes(notes, cells, index, digit) {
  const r = (index / 9) | 0
  const c = index % 9
  const bit = noteBit(digit)
  const clear = (i) => {
    if (notes[i] & bit) notes[i] &= ~bit
  }
  for (let k = 0; k < 9; k++) {
    clear(cellIndex(r, k))
    clear(cellIndex(k, c))
  }
  const br = ((r / 3) | 0) * 3
  const bc = ((c / 3) | 0) * 3
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) clear(cellIndex(br + dr, bc + dc))
}

export function undo(game) {
  if (game.status === 'complete' || game.undo.length === 0) return game
  const entry = game.undo[game.undo.length - 1]
  const cells = game.cells.slice()
  const notes = game.notes.slice()
  cells[entry.index] = entry.cell[0]
  notes[entry.index] = entry.notes[0]
  return {
    ...game,
    cells,
    notes,
    selected: entry.index,
    undo: game.undo.slice(0, -1),
    redo: [...game.redo, entry],
    moves: logMove(game, { type: 'undo', index: entry.index }),
    lastEvent: { kind: 'undo', index: entry.index, seq: nextEventSeq() },
  }
}

export function redo(game) {
  if (game.status === 'complete' || game.redo.length === 0) return game
  const entry = game.redo[game.redo.length - 1]
  const cells = game.cells.slice()
  const notes = game.notes.slice()
  cells[entry.index] = entry.cell[1]
  notes[entry.index] = entry.notes[1]
  let next = {
    ...game,
    cells,
    notes,
    selected: entry.index,
    redo: game.redo.slice(0, -1),
    undo: [...game.undo, entry],
    moves: logMove(game, { type: 'redo', index: entry.index }),
    lastEvent: { kind: 'redo', index: entry.index, seq: nextEventSeq() },
  }
  if (isSolved(next)) {
    next = finish(next)
    // Mark it solved so the feedback reactor yields to the completion cue.
    next.lastEvent = { ...next.lastEvent, solved: true }
  }
  return next
}

export function select(game, index) {
  return { ...game, selected: index }
}

export function pause(game) {
  if (game.status !== 'playing') return game
  return { ...game, status: 'paused', elapsedMs: elapsedMs(game), runningSince: null }
}

export function resume(game) {
  if (game.status !== 'paused') return game
  return { ...game, status: 'playing', runningSince: now() }
}

/** Record a hint being applied (the digit is placed via inputDigit by the caller). */
export function markHint(game) {
  return { ...game, hintsUsed: game.hintsUsed + 1, moves: logMove(game, { type: 'hint', index: game.selected }) }
}

/** Restart the same puzzle from scratch (keeps id/seed/solution). */
export function restart(game) {
  const t = now()
  return {
    ...game,
    cells: game.puzzle.slice(),
    notes: new Array(CELLS).fill(0),
    selected: game.puzzle.findIndex((v) => v === EMPTY),
    status: 'playing',
    startedAt: t,
    runningSince: t,
    elapsedMs: 0,
    mistakes: 0,
    hintsUsed: 0,
    moves: [],
    undo: [],
    redo: [],
  }
}

function finish(game) {
  return { ...game, status: 'complete', elapsedMs: elapsedMs(game), runningSince: null, selected: null }
}

/**
 * Build the immutable result record written to history on completion. Accuracy
 * is correct placements / total value placements (re-entries and notes excluded).
 */
export function toResult(game) {
  const placements = game.moves.filter((m) => m.type === 'place')
  const totalPlacements = placements.length
  const correctPlacements = placements.filter((m) => m.correct).length
  const accuracy = totalPlacements ? correctPlacements / totalPlacements : 1
  const meta = difficultyMeta(game.difficulty)
  return {
    id: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    difficultyRating: meta.rating,
    seed: game.seed,
    date: new Date().toISOString(),
    timeMs: game.elapsedMs,
    mistakes: game.mistakes,
    hintsUsed: game.hintsUsed,
    accuracy,
    placements: totalPlacements,
    clues: clueCount(game.puzzle),
    result: 'completed',
    // Starting board + answer travel with the record so Replay reconstructs from
    // stored data, never by regenerating (which could drift if the engine changes).
    puzzle: toCompactString(game.puzzle),
    solution: toCompactString(game.solution),
    // Compact move log for Replay (keep it small: type + cell + value + t).
    moves: game.moves.map((m) => ({ t: m.t, y: shortType(m.type), i: m.index, v: m.value ?? 0, c: m.correct ? 1 : 0 })),
  }
}

const SHORT = { place: 'p', erase: 'e', note: 'n', hint: 'h', undo: 'u', redo: 'r' }
const shortType = (t) => SHORT[t] || t
