// Global store (Zustand + persist). Single source of truth for profile,
// settings, history, daily results, achievements, and the in-progress game.
//
// Design rules that keep the product honest:
//   * Derived facts (skill rating, stats, coach reads) are NOT stored — they are
//     computed from `history` on demand, so they can never drift from reality.
//   * Completion is the only thing that writes history, and it writes the exact
//     result the engine produced (never a fabricated one).
//   * Theme preference mirrors to a dedicated localStorage key so the pre-paint
//     script in index.html can apply it before first render (no flash).

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { toResult } from '../engine/game'
import { personalBest, computeSkill } from '../engine/analysis'
import { evaluateAchievements } from '../engine/achievements'
import { seedHistory } from '../engine/seed'
import { toDayKey, todayKey, fromDayKey } from '../lib/format'

const THEME_KEY = 'nonet:theme'
const PERSIST_KEY = 'nonet'
const PERSIST_VERSION = 2

/* --------------------------------------------------------------- theming --- */

/** Resolve 'system' to a concrete theme using the OS preference. */
export function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply a theme preference to <html> and mirror it for the pre-paint script. */
export function applyTheme(pref) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.setAttribute('data-theme', resolved)
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* storage may be unavailable; theme still applies for this session */
  }
}

/* --------------------------------------------------------------- streaks --- */

/** Unique local day keys (newest-first) on which a puzzle was completed. */
function playDays(history) {
  const set = new Set()
  history.forEach((g) => {
    if (g.result === 'completed') set.add(toDayKey(new Date(g.date)))
  })
  return [...set].sort((a, b) => fromDayKey(b) - fromDayKey(a))
}

/**
 * Current and longest consecutive-day streaks from history. The current streak
 * counts today (or, if nothing yet today, yesterday) and walks backward while
 * days stay consecutive.
 */
export function computeStreak(history) {
  const days = playDays(history)
  if (!days.length) return { current: 0, longest: 0, lastPlayedDate: null }

  const DAY = 86400000
  const today = fromDayKey(todayKey())
  let current = 0
  const newest = fromDayKey(days[0])
  if (newest === today || newest === today - DAY) {
    current = 1
    for (let i = 1; i < days.length; i++) {
      if (fromDayKey(days[i - 1]) - fromDayKey(days[i]) === DAY) current++
      else break
    }
  }

  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (fromDayKey(days[i - 1]) - fromDayKey(days[i]) === DAY) run++
    else run = 1
    if (run > longest) longest = run
  }

  return { current, longest, lastPlayedDate: days[0] }
}

/* -------------------------------------------------------------- defaults --- */

const defaultProfile = () => ({
  username: 'Player',
  avatar: 'indigo', // one of a small set of generated monogram styles
  createdAt: new Date().toISOString(),
  streak: { current: 0, longest: 0, lastPlayedDate: null },
})

const defaultSettings = () => ({
  theme: 'dark', // 'light' | 'dark' | 'system' — dark by default to match the portfolio
  sound: true, // soft synthesized cues on placement, completion and milestones
  volume: 0.7, // master volume for sound cues (0..1)
  haptics: true, // vibration feedback on supported touch devices
  animations: true,
  // How mistakes are surfaced: 'off' (never), 'onEntry' (flag immediately),
  // 'onComplete' (only check at the end). Never hides the truth — just timing.
  mistakeMode: 'onEntry',
  highlightPeers: true, // shade the selected cell's row/col/box
  highlightSame: true, // shade cells sharing the selected number
  autoNotes: true, // clear a placed digit from peers' pencil marks
  showRemaining: true, // number-pad "how many left" badges
  keyboardInput: true,
  largeText: false, // accessibility: bump board + UI text
  confirmRestart: true,
})

/* ---------------------------------------------------------------- store ---- */

export const useStore = create(
  persist(
    (set, get) => ({
      profile: defaultProfile(),
      settings: defaultSettings(),
      history: [],
      daily: {}, // { 'YYYY-MM-DD': { completed, timeMs, mistakes, difficulty, accuracy } }
      achievements: {}, // { id: { at } }
      lessonsCompleted: {}, // { lessonId: { at } } — Learning Centre progress
      currentGame: null, // serializable in-progress game (see engine/game.js)
      lastResultId: null, // id of the most recent completion (for the Result page)
      meta: { seeded: false, version: PERSIST_VERSION },

      /* --- first run ------------------------------------------------------- */
      initFirstRun() {
        const state = get()
        applyTheme(state.settings.theme)
        if (state.meta.seeded) return
        const history = seedHistory()
        set({
          history,
          profile: { ...state.profile, streak: computeStreak(history) },
          meta: { ...state.meta, seeded: true },
        })
      },

      /* --- settings -------------------------------------------------------- */
      setSetting(key, value) {
        set((s) => ({ settings: { ...s.settings, [key]: value } }))
        if (key === 'theme') applyTheme(value)
      },
      setProfile(patch) {
        set((s) => ({ profile: { ...s.profile, ...patch } }))
      },

      /* --- learning centre ------------------------------------------------- */
      completeLesson(id) {
        set((s) =>
          s.lessonsCompleted[id]
            ? s
            : { lessonsCompleted: { ...s.lessonsCompleted, [id]: { at: new Date().toISOString() } } },
        )
      },

      /* --- game lifecycle -------------------------------------------------- */
      // The live game object is owned by the Play page; the store just persists
      // it so "Continue" survives reloads. Callers pass the plain game object.
      setCurrentGame(game) {
        set({ currentGame: game })
      },
      clearCurrentGame() {
        set({ currentGame: null })
      },

      /**
       * Commit a completed game to history and update everything that depends on
       * real results: streak, daily record, achievements, personal-best context.
       * Returns { result, prevBest, newAchievements, skillBefore, skillAfter,
       * streak } for the Result page. Writes nothing derived.
       */
      completeGame(game) {
        const state = get()
        const result = toResult(game)
        const prevBest = personalBest(state.history, result.difficulty)
        const history = [...state.history, result]
        const streak = computeStreak(history)
        const skillBefore = computeSkill(state.history)
        const skillAfter = computeSkill(history)

        // Daily record (only for the daily mode).
        let daily = state.daily
        if (game.mode === 'daily') {
          const key = todayKey()
          const existing = daily[key]
          // Keep the better attempt if the day was already completed.
          if (!existing || result.timeMs < existing.timeMs) {
            daily = {
              ...daily,
              [key]: {
                completed: true,
                timeMs: result.timeMs,
                mistakes: result.mistakes,
                difficulty: result.difficulty,
                accuracy: result.accuracy,
                id: result.id,
              },
            }
          }
        }

        const newAchievements = evaluateAchievements({
          result,
          history,
          streak: streak.current,
          longestStreak: streak.longest,
          prevBest,
          unlocked: state.achievements,
        })
        const achievements = { ...state.achievements }
        const at = new Date().toISOString()
        newAchievements.forEach((id) => (achievements[id] = { at }))

        set({
          history,
          daily,
          achievements,
          profile: { ...state.profile, streak },
          currentGame: null,
          lastResultId: result.id,
        })

        return { result, prevBest, newAchievements, skillBefore, skillAfter, streak }
      },

      /* --- data management ------------------------------------------------- */
      resetData({ reseed = false } = {}) {
        const history = reseed ? seedHistory() : []
        set({
          history,
          daily: {},
          achievements: {},
          lessonsCompleted: {},
          currentGame: null,
          lastResultId: null,
          profile: { ...defaultProfile(), username: get().profile.username, streak: computeStreak(history) },
          meta: { seeded: true, version: PERSIST_VERSION },
        })
      },
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Merge in settings added by a newer version without discarding the
      // player's saved choices (sound volume + haptics arrived in v2).
      migrate: (persisted) =>
        persisted
          ? { ...persisted, settings: { ...defaultSettings(), ...(persisted.settings || {}) } }
          : persisted,
      // Persist everything meaningful; nothing here is transient/UI-only.
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        history: s.history,
        daily: s.daily,
        achievements: s.achievements,
        lessonsCompleted: s.lessonsCompleted,
        currentGame: s.currentGame,
        lastResultId: s.lastResultId,
        meta: s.meta,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-apply the persisted theme once state is back (belt-and-braces with
        // the pre-paint script) so a stale <html> class never lingers.
        if (state?.settings?.theme) applyTheme(state.settings.theme)
      },
    },
  ),
)

/* --------------------------------------------------- convenience selectors -- */
// Stable primitive/selector hooks; components pick only what they need so they
// don't re-render on unrelated store changes.

export const useSettings = () => useStore((s) => s.settings)
export const useProfile = () => useStore((s) => s.profile)
export const useHistory = () => useStore((s) => s.history)
export const useAchievementsMap = () => useStore((s) => s.achievements)
export const useLessonsCompleted = () => useStore((s) => s.lessonsCompleted)
export const useDaily = () => useStore((s) => s.daily)
export const useCurrentGame = () => useStore((s) => s.currentGame)
