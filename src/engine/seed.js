// First-run seed data. The brief asks Nonet to "behave as though it already has
// real users and history," so on first launch we synthesize a plausible back-
// catalogue of solves. Everything is internally consistent — the move log,
// accuracy, mistakes and placements all agree — so stats, the Coach, charts,
// and Replay all work on demo data exactly as they will on real play. Later, the
// player's own solves append to the same history and take over.
//
// Deterministic (fixed master seed) so the demo is identical on every install
// and reload. Settings → Reset can clear it entirely.

import { mulberry32, hashSeed, shuffle } from './prng'
import { fillSolution, difficultyMeta, targetClues, toCompactString, EMPTY } from './sudoku'

const MASTER = 'nonet-demo-v1'

// Difficulty mix shifts toward harder puzzles as (synthetic) skill grows.
const DIFF_BY_SKILL = (skill) => {
  if (skill > 0.82) return ['medium', 'hard', 'hard', 'expert', 'expert']
  if (skill > 0.68) return ['easy', 'medium', 'medium', 'hard', 'hard', 'expert']
  if (skill > 0.55) return ['easy', 'easy', 'medium', 'medium', 'hard']
  return ['easy', 'easy', 'easy', 'medium']
}

// Base solve time (seconds) per difficulty; scaled by skill and recency.
const BASE_SECONDS = { easy: 300, medium: 470, hard: 760, expert: 1150 }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]

/**
 * Day offsets (0 = today) on which synthetic games were played. The most recent
 * six days are consecutive so the demo shows a live six-day streak; older days
 * thin out naturally.
 */
const DAY_SCHEDULE = [
  0, 0, 1, 2, 2, 3, 4, 5, // recent consecutive run (streak = 6)
  7, 8, 9, 11, 12, 12, 14, 16, 17, 19, 21, 22, 24, 26, 28, 30, 33, 36, 40, 44,
]

function otherDigit(rng, correct) {
  let d = 1 + Math.floor(rng() * 9)
  if (d === correct) d = (d % 9) + 1
  return d
}

/** Synthesize one internally-consistent completed-game record. */
function synthGame(index, dayOffset, refNow) {
  const rng = mulberry32(hashSeed(`${MASTER}:${index}`))
  // Skill rises as we approach today; older games are weaker.
  const recency = 1 - dayOffset / 46
  const skill = clamp(0.5 + recency * 0.4 + (rng() - 0.5) * 0.14, 0.4, 0.98)
  const difficulty = pick(rng, DIFF_BY_SKILL(skill))
  const meta = difficultyMeta(difficulty)

  const seedText = `${MASTER}-${difficulty}-${index}`
  const solution = fillSolution(seedText)
  const order = Array.from({ length: 81 }, (_, i) => i)
  shuffle(order, rng)
  const clues = targetClues(difficulty)
  const emptyCells = order.slice(0, 81 - clues)
  const puzzleArr = solution.slice()
  emptyCells.forEach((i) => (puzzleArr[i] = EMPTY))

  // Mistakes & hints scale down with skill, up with difficulty.
  const hardness = { easy: 0.6, medium: 1, hard: 1.5, expert: 2.1 }[difficulty]
  const mistakes = Math.max(0, Math.round((1 - skill) * 6 * hardness + (rng() - 0.5) * 2))
  const hintsUsed = rng() < 0.35 * hardness * (1 - skill) ? Math.round(rng() * 2) + 1 : 0

  // Solve order over the empty cells; the first `mistakes` of them get a wrong
  // placement first, then a correction — so accuracy is derived, never asserted.
  const solveOrder = emptyCells.slice()
  shuffle(solveOrder, rng)
  const mistakenSet = new Set(solveOrder.slice(0, mistakes))

  const timeMs = Math.round(
    BASE_SECONDS[difficulty] * 1000 * clamp(1.35 - skill * 0.7 + (rng() - 0.5) * 0.3, 0.55, 1.7),
  )

  // Build the compact move log with strictly increasing timestamps.
  const events = []
  solveOrder.forEach((i) => {
    if (mistakenSet.has(i)) {
      events.push({ y: 'p', i, v: otherDigit(rng, solution[i]), c: 0 }) // wrong
      events.push({ y: 'p', i, v: solution[i], c: 1 }) // correction
    } else {
      events.push({ y: 'p', i, v: solution[i], c: 1 })
    }
  })
  // Scatter hint markers over some correct placements.
  for (let h = 0; h < hintsUsed; h++) {
    const at = Math.floor(rng() * events.length)
    events.splice(at, 0, { y: 'h', i: events[Math.min(at, events.length - 1)].i, v: 0, c: 0 })
  }
  const span = timeMs
  const moves = events.map((e, k) => ({
    t: Math.round(((k + 1) / (events.length + 1)) * span),
    ...e,
  }))

  const placements = moves.filter((m) => m.y === 'p').length
  const correct = moves.filter((m) => m.y === 'p' && m.c === 1).length
  const accuracy = placements ? correct / placements : 1

  // A date within the given day, earlier in the day for lower indices.
  const date = new Date(refNow - dayOffset * 86400000 - Math.floor(rng() * 10 * 3600000))

  return {
    id: `${difficulty}:${seedText}`,
    mode: dayOffset <= 6 && rng() < 0.4 ? 'daily' : pick(rng, ['classic', 'classic', 'timed', 'practice']),
    difficulty,
    difficultyRating: meta.rating,
    seed: seedText,
    date: date.toISOString(),
    timeMs,
    mistakes,
    hintsUsed,
    accuracy,
    placements,
    clues,
    result: 'completed',
    puzzle: toCompactString(puzzleArr),
    solution: toCompactString(solution),
    moves,
    synthetic: true,
  }
}

/** The synthetic history, newest last (analysis sorts as needed). */
export function seedHistory(refNow = Date.now()) {
  const games = DAY_SCHEDULE.map((off, i) => synthGame(i, off, refNow))
  return games.sort((a, b) => new Date(a.date) - new Date(b.date))
}

const LEADER_NAMES = [
  'mira_k', 'tenagram', 'nightsolver', 'quiet_nine', 'boxline', 'akira.s',
  'penciled', 'gridwalker', 'thirtysec', 'lumen', 'r_castle', 'oda',
  'the_scanner', 'candace', 'nomistakes',
]

/**
 * A plausible demo leaderboard for a given daily date/difficulty. Deterministic
 * per (date, difficulty). The player's own result is inserted live by the store.
 */
export function seedDailyLeaderboard(dateStr, difficulty = 'medium') {
  const rng = mulberry32(hashSeed(`${MASTER}:lb:${dateStr}:${difficulty}`))
  const names = LEADER_NAMES.slice()
  shuffle(names, rng)
  const base = BASE_SECONDS[difficulty] || 470
  const rows = names.slice(0, 12).map((name) => ({
    name,
    timeMs: Math.round(base * 1000 * clamp(0.5 + rng() * 0.9, 0.45, 1.5)),
    mistakes: rng() < 0.5 ? 0 : Math.floor(rng() * 3),
  }))
  return rows.sort((a, b) => a.timeMs - b.timeMs)
}

export const SEED_MASTER = MASTER
