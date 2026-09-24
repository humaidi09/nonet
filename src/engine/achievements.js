// Achievements. Every one is earned by real behaviour and evaluated on actual
// completions — no participation trophies. Definitions are data; `check` is a
// pure predicate over the completion context the store assembles. New unlocks
// are returned so the store can surface them and stamp the unlock time.

const completedGames = (history) => history.filter((g) => g.result === 'completed')

/**
 * Each achievement: id, name, one-line description, lucide icon name, and a
 * `check(ctx)` predicate. ctx = { result, history, streak, longestStreak,
 * prevBest, counts }.
 *   - result:  the record for the puzzle just completed
 *   - history: full history INCLUDING result
 *   - streak:  current daily streak (after this completion)
 *   - longestStreak: the longest daily streak ever reached — streak milestones
 *     are permanent, so they're earned once you've *ever* reached the run, not
 *     only while it's live
 *   - prevBest: fastest time for this difficulty BEFORE this game (ms) or null
 *   - counts:  { completed, byDifficulty } precomputed over history
 */
export const ACHIEVEMENTS = [
  {
    id: 'first-solve',
    name: 'First light',
    description: 'Complete your first puzzle.',
    icon: 'Sparkles',
    check: (c) => c.counts.completed >= 1,
  },
  {
    id: 'flawless',
    name: 'Flawless',
    description: 'Finish a puzzle with zero mistakes.',
    icon: 'ShieldCheck',
    check: (c) => c.result.mistakes === 0,
  },
  {
    id: 'unaided',
    name: 'Unaided',
    description: 'Finish a puzzle without a single hint.',
    icon: 'Eye',
    check: (c) => c.result.hintsUsed === 0,
  },
  {
    id: 'clean-sweep',
    name: 'Clean sweep',
    description: 'No mistakes and no hints in one solve.',
    icon: 'Gem',
    check: (c) => c.result.mistakes === 0 && c.result.hintsUsed === 0,
  },
  {
    id: 'hard-earned',
    name: 'Hard-earned',
    description: 'Complete a Hard puzzle.',
    icon: 'Mountain',
    check: (c) => c.result.difficulty === 'hard' || c.result.difficulty === 'expert',
  },
  {
    id: 'expert-cleared',
    name: 'Summit',
    description: 'Complete an Expert puzzle.',
    icon: 'Trophy',
    check: (c) => c.result.difficulty === 'expert',
  },
  {
    id: 'personal-best',
    name: 'New record',
    description: 'Beat your best time for a difficulty.',
    icon: 'Timer',
    check: (c) => c.prevBest != null && c.result.timeMs < c.prevBest,
  },
  {
    id: 'quick-medium',
    name: 'Swift',
    description: 'Solve a Medium puzzle in under four minutes.',
    icon: 'Zap',
    check: (c) => c.result.difficulty === 'medium' && c.result.timeMs < 4 * 60 * 1000,
  },
  {
    id: 'streak-3',
    name: 'On a roll',
    description: 'Play three days in a row.',
    icon: 'Flame',
    check: (c) => c.longestStreak >= 3,
  },
  {
    id: 'streak-7',
    name: 'Steady hand',
    description: 'Keep a seven-day streak.',
    icon: 'CalendarCheck',
    check: (c) => c.longestStreak >= 7,
  },
  {
    id: 'streak-30',
    name: 'Devoted',
    description: 'Hold a thirty-day streak.',
    icon: 'CalendarHeart',
    check: (c) => c.longestStreak >= 30,
  },
  {
    id: 'ten-solved',
    name: 'Regular',
    description: 'Complete ten puzzles.',
    icon: 'Grid3x3',
    check: (c) => c.counts.completed >= 10,
  },
  {
    id: 'fifty-solved',
    name: 'Seasoned',
    description: 'Complete fifty puzzles.',
    icon: 'Award',
    check: (c) => c.counts.completed >= 50,
  },
  {
    id: 'all-difficulties',
    name: 'Full range',
    description: 'Complete a puzzle at every difficulty.',
    icon: 'Layers',
    check: (c) =>
      ['easy', 'medium', 'hard', 'expert'].every((d) => (c.counts.byDifficulty[d] || 0) > 0),
  },
]

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id)

/** Precompute the counts several checks need, once per evaluation. */
function buildCounts(history) {
  const done = completedGames(history)
  const byDifficulty = {}
  done.forEach((g) => (byDifficulty[g.difficulty] = (byDifficulty[g.difficulty] || 0) + 1))
  return { completed: done.length, byDifficulty }
}

/**
 * Evaluate all achievements against a completion. Returns the list of newly
 * unlocked ids (those whose predicate now holds and weren't already unlocked).
 */
export function evaluateAchievements({ result, history, streak, longestStreak, prevBest, unlocked = {} }) {
  const counts = buildCounts(history)
  const ctx = { result, history, streak, longestStreak: longestStreak ?? streak, prevBest, counts }
  const newly = []
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue
    try {
      if (a.check(ctx)) newly.push(a.id)
    } catch {
      // A single bad predicate must never break completion handling.
    }
  }
  return newly
}
