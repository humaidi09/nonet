// Optional vibration feedback for touch devices. Gated by the player's Haptics
// setting and a no-op wherever the Vibration API is missing (most desktops and
// iOS Safari). Patterns are short and few, mapped to game events.

let enabled = true

const PATTERNS = {
  light: 12,
  medium: [18],
  strong: [26],
  error: [22, 40, 22],
  success: [16, 40, 16, 40, 30],
}

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export const haptics = {
  configure({ enabled: e } = {}) {
    if (typeof e === 'boolean') enabled = e
  },
  /** Vibrate with a named pattern (or a raw number/array). */
  buzz(name) {
    if (!enabled || !canVibrate()) return
    const pattern = PATTERNS[name] ?? name
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore — vibration is best-effort */
    }
  },
}
