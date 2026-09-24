// The single place that turns game events into sensory feedback. One config hook
// keeps the sound + haptics engines synced to the player's settings and unlocks
// audio on the first interaction; a second hook reacts to the game's transient
// `lastEvent` and fires the right cue, haptic and toast — so pages never
// re-implement "what happens when a row completes".

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { unitCells } from '@/engine/sudoku'
import { usePrefersReducedMotion } from './hooks'
import { sound } from './sound'
import { haptics } from './haptics'
import { toast } from './toast'

const UNIT_LABEL = { row: 'Row', col: 'Column', box: 'Box' }

/** Union of every cell index in the just-completed units (for the board sweep). */
function sweepCells(completed) {
  const s = new Set()
  for (const u of completed) for (const i of unitCells(u.type, u.index)) s.add(i)
  return s
}

/**
 * App-level: keep the audio + haptics engines configured from settings, and arm
 * a one-time listener that unlocks audio on the first user gesture (autoplay).
 * Mounted once, in AppShell, so feedback is ready everywhere.
 */
export function useFeedbackConfig() {
  const sound_ = useStore((s) => s.settings.sound)
  const volume = useStore((s) => s.settings.volume)
  const haptic = useStore((s) => s.settings.haptics)

  useEffect(() => {
    sound.configure({ enabled: !!sound_, volume: volume ?? 0.7 })
  }, [sound_, volume])

  useEffect(() => {
    haptics.configure({ enabled: !!haptic })
  }, [haptic])

  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}

/**
 * React to the live game's `lastEvent`: placements, mistakes and unit completions
 * get the full cue/haptic/toast treatment, while erase/undo/redo get a quiet
 * acknowledgement. Puzzle completion is owned by the Play page (it holds the
 * richer summary), so `solved` events are skipped here. Returns a `flash`
 * descriptor the board animates: { index, kind: 'correct' | 'wrong', sweep?, seq }.
 */
export function useGameFeedback(game, settings) {
  const reduceMotion = usePrefersReducedMotion()
  const animate = settings.animations && !reduceMotion
  const [flash, setFlash] = useState(null)
  const seenRef = useRef(0)

  useEffect(() => {
    const ev = game.lastEvent
    if (!ev || ev.seq === seenRef.current) return
    seenRef.current = ev.seq

    // Erase / undo / redo: the board answers every action with a quiet click and
    // a light tap — no toast, no flash. (A redo that completes the puzzle is
    // marked solved; the completion cue owns that moment, so we stay silent.)
    if (ev.kind === 'erase' || ev.kind === 'undo' || ev.kind === 'redo') {
      if (!ev.solved) {
        sound.play('button')
        haptics.buzz('light')
      }
      return
    }

    if (ev.kind !== 'place' || ev.solved) return

    // Whether a wrong entry is revealed mid-solve follows the mistake mode: only
    // 'onEntry' surfaces it immediately (matches the board's wrong-cell flags).
    const revealWrong = settings.mistakeMode === 'onEntry'

    if (!ev.correct) {
      if (revealWrong) {
        sound.play('wrong')
        haptics.buzz('error')
        if (animate) setFlash({ index: ev.index, kind: 'wrong', seq: ev.seq })
      }
      return
    }

    const units = ev.completed || []

    // Sound + haptic: a hint gets its own cue; otherwise the placement's
    // celebration scales with how many units it just finished.
    if (ev.viaHint) {
      sound.play('hint')
      haptics.buzz('light')
    } else if (units.length >= 2) {
      sound.play('combo')
      haptics.buzz('success')
    } else if (units.length === 1) {
      sound.play('unit')
      haptics.buzz('medium')
    } else {
      sound.play('correct')
      haptics.buzz('light')
    }

    // Toast: a completed unit is worth announcing however it was finished.
    if (units.length >= 2) {
      toast({
        tone: 'accent',
        title: units.length >= 3 ? 'Triple complete' : 'Double complete',
        message: `${units.map((u) => UNIT_LABEL[u.type]).join(' + ')} solved at once`,
      })
    } else if (units.length === 1) {
      toast({ tone: 'ok', title: `${UNIT_LABEL[units[0].type]} complete` })
    }

    if (animate) {
      setFlash({ index: ev.index, kind: 'correct', sweep: units.length ? sweepCells(units) : null, seq: ev.seq })
    }
  }, [game.lastEvent, animate, settings.mistakeMode])

  return { flash }
}
