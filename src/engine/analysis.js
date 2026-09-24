// Analysis engine. Everything here is a pure function of the player's real
// history — stats, skill rating, the Coach's read, and the Smart-Difficulty
// recommendation. No random numbers, no meaningless scores: with no games the
// outputs are honest empty states ("play to establish your rating").

import { difficultyMeta, DIFFICULTIES } from './sudoku'

/** Rough "par" solve time per difficulty (seconds) — the yardstick for speed. */
export const PAR_SECONDS = { easy: 300, medium: 480, hard: 780, expert: 1200 }

export const TIERS = [
  { name: 'Novice', min: 0 },
  { name: 'Apprentice', min: 1050 },
  { name: 'Solver', min: 1300 },
  { name: 'Adept', min: 1600 },
  { name: 'Expert', min: 1900 },
  { name: 'Master', min: 2200 },
]

const completed = (history) => history.filter((g) => g.result === 'completed')
const bySeconds = (ms) => Math.round(ms / 1000)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * What a single completed game "demonstrates" as a rating: the puzzle's own
 * difficulty rating, adjusted for how cleanly and quickly it was solved.
 * Transparent and bounded — a hard clean solve shows more than a slow, hinted one.
 */
export function demonstratedRating(g) {
  const base = g.difficultyRating || difficultyMeta(g.difficulty).rating
  const par = PAR_SECONDS[g.difficulty] || 480
  const secs = bySeconds(g.timeMs)
  const speedAdj = clamp(((par - secs) / par) * 220, -200, 240) // faster than par -> bonus
  const accAdj = clamp((g.accuracy - 0.9) * 1200, -260, 90) // < 90% accuracy hurts
  const hintAdj = -clamp((g.hintsUsed || 0) * 45, 0, 260)
  return Math.round(base + speedAdj + accAdj + hintAdj)
}

/** Recency-weighted skill rating over completed games (newest weigh most). */
export function computeSkill(history) {
  const games = completed(history)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  if (games.length < 3) {
    return { rating: null, tier: 'Unrated', tierIndex: -1, progress: 0, next: TIERS[1], games: games.length, needed: 3 - games.length }
  }
  const recent = games.slice(-20)
  let wsum = 0
  let vsum = 0
  recent.forEach((g, i) => {
    const age = recent.length - 1 - i
    const w = Math.pow(0.88, age)
    wsum += w
    vsum += w * demonstratedRating(g)
  })
  const rating = Math.round(vsum / wsum)
  let tierIndex = 0
  for (let i = 0; i < TIERS.length; i++) if (rating >= TIERS[i].min) tierIndex = i
  const tier = TIERS[tierIndex]
  const next = TIERS[tierIndex + 1] || null
  const progress = next ? clamp((rating - tier.min) / (next.min - tier.min), 0, 1) : 1
  return { rating, tier: tier.name, tierIndex, progress, next, games: games.length }
}

/** Best (fastest) completed time overall or for a difficulty (ms) or null. */
export function personalBest(history, difficulty = null) {
  const games = completed(history).filter((g) => !difficulty || g.difficulty === difficulty)
  if (!games.length) return null
  return Math.min(...games.map((g) => g.timeMs))
}

export function recentResults(history, n = 10) {
  return history
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, n)
}

/** Aggregate statistics used by the Statistics page and Profile. */
export function computeStats(history) {
  const all = history
  const done = completed(history)
  const total = all.length
  const completedCount = done.length
  const times = done.map((g) => g.timeMs)
  const accuracies = done.map((g) => g.accuracy)
  const distribution = {}
  DIFFICULTIES.forEach((d) => (distribution[d.id] = 0))
  done.forEach((g) => (distribution[g.difficulty] = (distribution[g.difficulty] || 0) + 1))

  const bestByDifficulty = {}
  DIFFICULTIES.forEach((d) => (bestByDifficulty[d.id] = personalBest(history, d.id)))

  const totalMistakes = done.reduce((a, g) => a + (g.mistakes || 0), 0)
  const totalPlacements = done.reduce((a, g) => a + (g.placements || 0), 0)
  const totalHints = done.reduce((a, g) => a + (g.hintsUsed || 0), 0)

  return {
    total,
    completed: completedCount,
    completionRate: total ? completedCount / total : 0,
    avgTimeMs: mean(times),
    medianTimeMs: median(times),
    bestTimeMs: times.length ? Math.min(...times) : null,
    avgAccuracy: mean(accuracies),
    mistakeRate: totalPlacements ? totalMistakes / totalPlacements : 0,
    avgHints: completedCount ? totalHints / completedCount : 0,
    hintFreeRate: completedCount ? done.filter((g) => !g.hintsUsed).length / completedCount : 0,
    flawlessRate: completedCount ? done.filter((g) => !g.mistakes).length / completedCount : 0,
    distribution,
    bestByDifficulty,
    // A time-ordered series of demonstrated rating for the trend chart.
    ratingSeries: done
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((g) => ({ date: g.date, rating: demonstratedRating(g), difficulty: g.difficulty })),
  }
}

/* --------------------------------------------------------------- coach --- */

const boxOfIndex = (i) => {
  const r = (i / 9) | 0
  const c = i % 9
  return ((r / 3) | 0) * 3 + ((c / 3) | 0)
}
const BOX_LABELS = ['top-left', 'top-centre', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-centre', 'bottom-right']

/**
 * The Coach's read: concrete patterns detected from recent games plus one
 * actionable recommendation. Each pattern is only surfaced when the data
 * supports it; otherwise the coach says it needs more games.
 */
export function coachAnalysis(history) {
  const done = completed(history)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const recent = done.slice(0, 20)

  if (recent.length < 4) {
    return {
      ready: false,
      headline: 'Play a few more puzzles',
      detail: `The coach reads your last several solves. ${recent.length}/4 so far — finish a few and a real read appears here.`,
      patterns: [],
      recommendation: { text: 'Play a Classic puzzle to start building your profile.', action: 'play', lessonId: null },
      metrics: null,
    }
  }

  const accs = recent.map((g) => g.accuracy)
  const avgAcc = mean(accs)
  const avgHints = mean(recent.map((g) => g.hintsUsed || 0))
  const speedRatios = recent.map((g) => bySeconds(g.timeMs) / (PAR_SECONDS[g.difficulty] || 480))
  const medSpeed = median(speedRatios) // <1 faster than par

  const easyish = recent.filter((g) => g.difficulty === 'easy' || g.difficulty === 'medium')
  const hardish = recent.filter((g) => g.difficulty === 'hard' || g.difficulty === 'expert')

  // Mistake hotspot: which box collects the most wrong placements.
  const boxWrong = new Array(9).fill(0)
  let wrongTotal = 0
  recent.forEach((g) =>
    (g.moves || []).forEach((m) => {
      if (m.y === 'p' && m.c === 0) {
        boxWrong[boxOfIndex(m.i)]++
        wrongTotal++
      }
    }),
  )
  const hotBox = boxWrong.indexOf(Math.max(...boxWrong))

  const patterns = []
  if (medSpeed < 0.8 && avgAcc < 0.9) {
    patterns.push({
      id: 'fast-loose',
      tone: 'warn',
      title: 'Fast, but a little loose',
      detail: `You solve about ${Math.round((1 - medSpeed) * 100)}% faster than par, but accuracy sits at ${(avgAcc * 100).toFixed(0)}%. Slowing down slightly should cut mistakes.`,
    })
  }
  if (avgAcc > 0.97 && medSpeed > 1.25) {
    patterns.push({
      id: 'slow-sure',
      tone: 'info',
      title: 'Very accurate, room for pace',
      detail: `Accuracy is excellent (${(avgAcc * 100).toFixed(0)}%) but solves run ~${Math.round((medSpeed - 1) * 100)}% over par. Scanning drills build speed without risking accuracy.`,
    })
  }
  if (hardish.length >= 3 && easyish.length >= 3) {
    const easyAcc = mean(easyish.map((g) => g.accuracy))
    const hardAcc = mean(hardish.map((g) => g.accuracy))
    if (easyAcc - hardAcc > 0.08) {
      patterns.push({
        id: 'hard-wall',
        tone: 'info',
        title: 'Strong on easy, stretched on hard',
        detail: `Accuracy drops from ${(easyAcc * 100).toFixed(0)}% on easier puzzles to ${(hardAcc * 100).toFixed(0)}% on hard/expert. Intermediate techniques bridge that gap.`,
      })
    }
  }
  if (avgHints > 2) {
    patterns.push({
      id: 'hint-reliant',
      tone: 'warn',
      title: 'Leaning on hints',
      detail: `About ${avgHints.toFixed(1)} hints per solve. Learning single-candidate spotting makes most hints unnecessary.`,
    })
  }
  if (wrongTotal >= 6 && boxWrong[hotBox] / wrongTotal > 0.34) {
    patterns.push({
      id: 'hotspot',
      tone: 'info',
      title: `Mistakes cluster ${BOX_LABELS[hotBox]}`,
      detail: `${Math.round((boxWrong[hotBox] / wrongTotal) * 100)}% of recent slips land in the ${BOX_LABELS[hotBox]} box. Double-check that region before committing.`,
    })
  }
  if (!patterns.length) {
    patterns.push({
      id: 'balanced',
      tone: 'ok',
      title: 'Well balanced',
      detail: `Accuracy ${(avgAcc * 100).toFixed(0)}%, pace near par, hints low. A good moment to try a harder tier.`,
    })
  }

  // Recommendation follows the most salient pattern.
  const primary = patterns[0]
  const recMap = {
    'fast-loose': { text: 'Try Practice mode and lean on pencil marks before committing.', action: 'practice', lessonId: 'notes' },
    'slow-sure': { text: 'Run a Timed puzzle and drill scanning to build pace.', action: 'timed', lessonId: 'scanning' },
    'hard-wall': { text: 'Learn Pointing Pairs and Box/Line reduction, then retry Hard.', action: 'learn', lessonId: 'pointing-pairs' },
    'hint-reliant': { text: 'Study Naked & Hidden Singles to find moves unaided.', action: 'learn', lessonId: 'naked-single' },
    hotspot: { text: 'Play a Practice puzzle and watch that box deliberately.', action: 'practice', lessonId: 'hidden-single' },
    balanced: { text: 'Step up a difficulty — you look ready for it.', action: 'harder', lessonId: null },
  }

  return {
    ready: true,
    headline: primary.title,
    detail: primary.detail,
    patterns,
    recommendation: recMap[primary.id] || recMap.balanced,
    metrics: {
      avgAccuracy: avgAcc,
      avgHints,
      medSpeed,
      games: recent.length,
      hotBox: wrongTotal >= 6 ? hotBox : null,
    },
  }
}

/* ---------------------------------------------------- smart difficulty --- */

const DIFF_ORDER = ['easy', 'medium', 'hard', 'expert']

/**
 * Recommend the next difficulty from recent performance at the player's current
 * working level. Steps up on consistent fast+accurate solves; suggests targeted
 * practice when struggling; otherwise holds. Always explains why.
 */
export function smartDifficulty(history) {
  const done = completed(history)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  if (done.length < 3) {
    return { recommended: 'medium', reason: 'Not enough history yet — Medium is a good place to calibrate.', targeted: false, confidence: 'low' }
  }

  // The level the player has been working at most recently.
  const current = done[0].difficulty
  const atLevel = done.filter((g) => g.difficulty === current).slice(0, 5)
  const idx = DIFF_ORDER.indexOf(current)

  if (atLevel.length >= 3) {
    const avgAcc = mean(atLevel.map((g) => g.accuracy))
    const fast = mean(atLevel.map((g) => bySeconds(g.timeMs) / (PAR_SECONDS[g.difficulty] || 480))) < 0.95
    const clean = avgAcc >= 0.95
    const lowHints = mean(atLevel.map((g) => g.hintsUsed || 0)) <= 1

    if (clean && fast && lowHints && idx < DIFF_ORDER.length - 1) {
      const up = DIFF_ORDER[idx + 1]
      return {
        recommended: up,
        reason: `You are solving ${difficultyMeta(current).label} fast and clean (${(avgAcc * 100).toFixed(0)}% accuracy). Time to step up to ${difficultyMeta(up).label}.`,
        targeted: false,
        confidence: 'high',
      }
    }
    if (avgAcc < 0.85 || mean(atLevel.map((g) => g.hintsUsed || 0)) > 2.5) {
      const down = idx > 0 ? DIFF_ORDER[idx - 1] : current
      return {
        recommended: down,
        reason: `${difficultyMeta(current).label} is proving tough (${(avgAcc * 100).toFixed(0)}% accuracy). A focused practice run${down !== current ? ` at ${difficultyMeta(down).label}` : ''} will rebuild rhythm.`,
        targeted: true,
        lessonId: 'pointing-pairs',
        confidence: 'medium',
      }
    }
  }

  return {
    recommended: current,
    reason: `You are well matched to ${difficultyMeta(current).label} right now — keep consolidating before moving on.`,
    targeted: false,
    confidence: 'medium',
  }
}
