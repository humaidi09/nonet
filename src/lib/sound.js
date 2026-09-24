// A tiny Web Audio synth for game feedback. No audio files: every cue is a short,
// soft synthesized envelope, so the bundle stays tiny and the character stays
// consistent. The AudioContext is created lazily and only resumed after a real
// user gesture (browser autoplay policy). Playback is gated by the player's Sound
// setting and scaled by their master volume. Everything degrades to a no-op where
// Web Audio is unavailable.

let ctx = null
let master = null
let enabled = false
let volume = 0.7
let unlocked = false

function ensureContext() {
  if (ctx || typeof window === 'undefined') return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  return ctx
}

// A single note with a soft attack/decay envelope. Times are absolute (seconds).
function note(freq, start, dur, { type = 'sine', gain = 0.14, attack = 0.01 } = {}) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(start)
  osc.stop(start + dur + 0.03)
}

// Play a sequence of [freq, offsetSeconds, durationSeconds, opts?] steps.
function seq(steps) {
  const t0 = ctx.currentTime + 0.001
  for (const [freq, off, dur, opts] of steps) note(freq, t0 + off, dur, opts)
}

// Note frequencies (equal temperament) used by the cues below.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880
const C6 = 1046.5, E6 = 1318.51, G6 = 1567.98

// Each cue is short, soft and professional — no arcade jingles.
const CUES = {
  // A correct placement: a gentle two-note rise.
  correct: () => seq([[E5, 0, 0.09, { gain: 0.08 }], [G5, 0.05, 0.12, { gain: 0.09 }]]),
  // A wrong placement: a soft low double-thud, never harsh.
  wrong: () => seq([[196, 0, 0.15, { type: 'triangle', gain: 0.1 }], [146.83, 0.05, 0.18, { type: 'triangle', gain: 0.09 }]]),
  // A completed row / column / box: a bright ascending triad.
  unit: () => seq([[C5, 0, 0.1], [E5, 0.07, 0.11], [G5, 0.14, 0.2, { gain: 0.1 }]]),
  // Two or more units at once: a longer four-note flourish.
  combo: () => seq([[C5, 0, 0.09], [E5, 0.06, 0.09], [G5, 0.12, 0.1], [C6, 0.19, 0.24, { gain: 0.11 }]]),
  // Puzzle solved: a warm resolving major chord with a soft top note.
  complete: () => seq([[C5, 0, 0.6, { gain: 0.09 }], [E5, 0, 0.6, { gain: 0.08 }], [G5, 0, 0.6, { gain: 0.08 }], [C6, 0.12, 0.55, { gain: 0.08 }]]),
  // A new personal best: a brighter high sparkle.
  best: () => seq([[G5, 0, 0.1], [C6, 0.08, 0.1], [E6, 0.16, 0.1], [G6, 0.24, 0.28, { gain: 0.1 }]]),
  // A hint applied: a neutral, quiet down-up chime.
  hint: () => seq([[D5, 0, 0.09, { type: 'triangle', gain: 0.07 }], [A5, 0.08, 0.13, { type: 'triangle', gain: 0.07 }]]),
  // A UI button press: a very quiet click.
  button: () => note(660, ctx.currentTime + 0.001, 0.03, { type: 'triangle', gain: 0.04 }),
  // An achievement unlocked: a shimmering triad.
  achievement: () => seq([[E5, 0, 0.14], [A5 * 1.122, 0.07, 0.14], [E6, 0.14, 0.32, { gain: 0.1 }]]),
}

export const sound = {
  /** Keep the engine in sync with the player's settings. Never creates context. */
  configure({ enabled: e, volume: v } = {}) {
    if (typeof e === 'boolean') enabled = e
    if (typeof v === 'number') {
      volume = Math.max(0, Math.min(1, v))
      if (master) master.gain.value = volume
    }
  },
  /** Call from within a user gesture so audio is allowed to start. */
  unlock() {
    if (unlocked) return
    const c = ensureContext()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    unlocked = true
  },
  /** Play a named cue. No-op when sound is off or unsupported. */
  play(name) {
    if (!enabled) return
    const cue = CUES[name]
    if (!cue) return
    const c = ensureContext()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    try {
      cue()
    } catch {
      /* an occasional audio hiccup should never break the game */
    }
  },
}
